import "server-only";
import { and, asc, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { database } from "@/db";
import { diaryEntry, favoriteRecipe, food, recipe, recipeIngredient } from "@/db/schema";
import { extrasFromRow, scaleExtras, sumExtras } from "@/lib/nutrition/extra-nutrients";
import { computeRecipeNutrition, recipeServingCount } from "@/lib/nutrition/recipe";
import { allowedTypos, searchWords } from "@/lib/search";
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
      fiber: food.fiber,
      sugars: food.sugars,
      saturatedFat: food.saturatedFat,
      salt: food.salt,
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
  servingGrams: number | null;
};

async function toLoggableRecipes(userId: string, rows: RecipeRow[]): Promise<LoggableRecipe[]> {
  if (rows.length === 0) return [];
  const recipeIds = rows.map((row) => row.id);
  const [ingredients, favorites, lastQuantities] = await Promise.all([
    loadRecipeIngredients(recipeIds),
    database
      .select({ recipeId: favoriteRecipe.recipeId })
      .from(favoriteRecipe)
      .where(and(eq(favoriteRecipe.userId, userId), inArray(favoriteRecipe.recipeId, recipeIds))),
    database
      .selectDistinctOn([diaryEntry.recipeId], {
        recipeId: diaryEntry.recipeId,
        grams: diaryEntry.grams,
        servings: diaryEntry.servings,
      })
      .from(diaryEntry)
      .where(and(eq(diaryEntry.userId, userId), inArray(diaryEntry.recipeId, recipeIds)))
      .orderBy(diaryEntry.recipeId, desc(diaryEntry.createdAt)),
  ]);
  const favoriteIds = new Set(favorites.map((favorite) => favorite.recipeId));
  const lastQuantityByRecipe = new Map(lastQuantities.map((row) => [row.recipeId, row]));

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
      servingGrams: row.servingGrams,
    });
    return {
      type: "recipe",
      id: row.id,
      name: row.name,
      per100: nutrition.per100g,
      perServing: nutrition.perServing,
      servings: nutrition.servings,
      finalWeightG: nutrition.finalWeightG,
      servingWeightG: nutrition.servingWeightG,
      hasCookedWeight: Boolean(row.cookedWeightG),
      hasServingWeight: Boolean(row.servingGrams),
      lastServings: lastQuantityByRecipe.get(row.id)?.servings ?? null,
      lastGrams: lastQuantityByRecipe.get(row.id)?.grams ?? null,
      isFavorite: favoriteIds.has(row.id),
    };
  });
}

const recipeColumns = {
  id: recipe.id,
  name: recipe.name,
  servings: recipe.servings,
  cookedWeightG: recipe.cookedWeightG,
  servingGrams: recipe.servingGrams,
};

export async function listLoggableRecipes(userId: string, query?: string) {
  const words = searchWords(query ?? "");
  const rows = await database
    .select(recipeColumns)
    .from(recipe)
    .where(
      and(
        eq(recipe.ownerId, userId),
        isNull(recipe.archivedAt),
        ...words.map(
          (word) => sql`fuzzy_word_match(search_text(${recipe.name}), search_text(${word}), ${allowedTypos(word)})`,
        ),
      ),
    )
    .orderBy(
      ...(words.length > 0 ? [sql`similarity(search_text(${recipe.name}), search_text(${words.join(" ")})) desc`] : []),
      recipe.name,
    );
  return toLoggableRecipes(userId, rows);
}

export async function loggableRecipesByIds(userId: string, recipeIds: string[]) {
  if (recipeIds.length === 0) return [];
  const rows = await database
    .select(recipeColumns)
    .from(recipe)
    .where(and(eq(recipe.ownerId, userId), isNull(recipe.archivedAt), inArray(recipe.id, recipeIds)));
  const order = new Map(recipeIds.map((recipeId, index) => [recipeId, index]));
  rows.sort((first, second) => (order.get(first.id) ?? 0) - (order.get(second.id) ?? 0));
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

export async function getRecipeForEditing(userId: string, recipeId: string) {
  const [row] = await database
    .select()
    .from(recipe)
    .where(and(eq(recipe.id, recipeId), eq(recipe.ownerId, userId), isNull(recipe.archivedAt)));
  if (!row) return null;
  const [ingredients, favorite] = await Promise.all([
    loadRecipeIngredients([row.id]),
    database
      .select({ recipeId: favoriteRecipe.recipeId })
      .from(favoriteRecipe)
      .where(and(eq(favoriteRecipe.userId, userId), eq(favoriteRecipe.recipeId, row.id))),
  ]);
  return {
    id: row.id,
    name: row.name,
    servings: row.servings,
    cookedWeightG: row.cookedWeightG,
    servingGrams: row.servingGrams,
    notes: row.notes,
    isFavorite: favorite.length > 0,
    ingredients: ingredients.map((ingredient) => ({
      foodId: ingredient.foodId,
      name: ingredient.brand ? `${ingredient.name}, ${ingredient.brand}` : ingredient.name,
      unit: ingredient.unit,
      grams: ingredient.grams,
      per100: { kcal: ingredient.kcal, protein: ingredient.protein, carbs: ingredient.carbs, fat: ingredient.fat },
    })),
  };
}

export type RecipeForEditing = NonNullable<Awaited<ReturnType<typeof getRecipeForEditing>>>;

export async function getRecipeExtras(recipeId: string) {
  const [row] = await database
    .select({ servings: recipe.servings, cookedWeightG: recipe.cookedWeightG, servingGrams: recipe.servingGrams })
    .from(recipe)
    .where(eq(recipe.id, recipeId));
  if (!row) return null;
  const ingredients = await loadRecipeIngredients([recipeId]);
  const rawWeightG = ingredients.reduce((sum, ingredient) => sum + ingredient.grams, 0);
  const finalWeightG = row.cookedWeightG && row.cookedWeightG > 0 ? row.cookedWeightG : rawWeightG;
  return {
    total: sumExtras(ingredients.map((ingredient) => scaleExtras(extrasFromRow(ingredient), ingredient.grams))),
    finalWeightG,
    servings: recipeServingCount({ finalWeightG, servings: row.servings, servingGrams: row.servingGrams }),
  };
}
