import "server-only";
import { and, asc, eq, inArray, isNull, sql } from "drizzle-orm";
import { database } from "@/db";
import { favoriteRecipe, food, recipe, recipeIngredient } from "@/db/schema";
import { computeRecipeNutrition } from "@/lib/nutrition/recipe";
import type { LoggableRecipe } from "./loggable";

export async function loadRecipeIngredients(recipeIds: string[]) {
  if (recipeIds.length === 0) return [];
  return database
    .select({
      id: recipeIngredient.id,
      recipeId: recipeIngredient.recipeId,
      foodId: recipeIngredient.foodId,
      grams: recipeIngredient.grams,
      position: recipeIngredient.position,
      name: food.name,
      brand: food.brand,
      unit: food.unit,
      kcal: food.kcal,
      protein: food.protein,
      carbs: food.carbs,
      fat: food.fat,
    })
    .from(recipeIngredient)
    .innerJoin(food, eq(food.id, recipeIngredient.foodId))
    .where(inArray(recipeIngredient.recipeId, recipeIds))
    .orderBy(asc(recipeIngredient.position));
}

type RecipeRow = {
  id: string;
  name: string;
  servings: number;
  cookedWeightG: number | null;
};

async function toLoggableRecipes(userId: string, rows: RecipeRow[]): Promise<LoggableRecipe[]> {
  if (rows.length === 0) return [];
  const recipeIds = rows.map((row) => row.id);
  const [ingredients, favorites] = await Promise.all([
    loadRecipeIngredients(recipeIds),
    database
      .select({ recipeId: favoriteRecipe.recipeId })
      .from(favoriteRecipe)
      .where(and(eq(favoriteRecipe.userId, userId), inArray(favoriteRecipe.recipeId, recipeIds))),
  ]);
  const favoriteIds = new Set(favorites.map((favorite) => favorite.recipeId));

  return rows.map((row) => {
    const nutrition = computeRecipeNutrition({
      ingredients: ingredients
        .filter((ingredient) => ingredient.recipeId === row.id)
        .map((ingredient) => ({
          grams: ingredient.grams,
          per100: {
            kcal: ingredient.kcal,
            protein: ingredient.protein,
            carbs: ingredient.carbs,
            fat: ingredient.fat,
          },
        })),
      cookedWeightG: row.cookedWeightG,
      servings: row.servings,
    });
    return {
      type: "recipe",
      id: row.id,
      name: row.name,
      per100: nutrition.per100g,
      perServing: nutrition.perServing,
      servings: nutrition.servings,
      finalWeightG: nutrition.finalWeightG,
      hasCookedWeight: Boolean(row.cookedWeightG),
      isFavorite: favoriteIds.has(row.id),
    };
  });
}

const recipeColumns = {
  id: recipe.id,
  name: recipe.name,
  servings: recipe.servings,
  cookedWeightG: recipe.cookedWeightG,
};

export async function listLoggableRecipes(userId: string, query?: string) {
  const words = (query ?? "").trim().split(/\s+/).filter(Boolean);
  const rows = await database
    .select(recipeColumns)
    .from(recipe)
    .where(
      and(
        eq(recipe.ownerId, userId),
        isNull(recipe.archivedAt),
        ...words.map((word) => sql`search_text(${recipe.name}) like '%' || search_text(${word}) || '%'`),
      ),
    )
    .orderBy(recipe.name);
  return toLoggableRecipes(userId, rows);
}

export async function getLoggableRecipe(userId: string, recipeId: string) {
  const rows = await database
    .select(recipeColumns)
    .from(recipe)
    .where(and(eq(recipe.id, recipeId), eq(recipe.ownerId, userId), isNull(recipe.archivedAt)));
  const [loggable] = await toLoggableRecipes(userId, rows);
  return loggable ?? null;
}
