import "server-only";
import { and, asc, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { database } from "@/db";
import { diaryEntry, favoriteRecipe, food, recipe, recipeIngredient } from "@/db/schema";
import {
  emptyExtraNutrients,
  type ExtraNutrients,
  multiplyExtras,
  scaleExtras,
  sumExtras,
} from "@/lib/nutrition/extra-nutrients";
import type { Nutrients } from "@/lib/nutrition/nutrients";
import { computeRecipeNutrition, recipeServingCount } from "@/lib/nutrition/recipe";
import { allowedTypos, searchWords } from "@/lib/search";
import type { LoggableRecipe } from "./loggable";

const subRecipe = alias(recipe, "sub_recipe");

export async function loadRecipeIngredients(recipeIds: string[]) {
  if (recipeIds.length === 0) return [];
  return database
    .select({
      id: recipeIngredient.id,
      recipeId: recipeIngredient.recipeId,
      foodId: recipeIngredient.foodId,
      subRecipeId: recipeIngredient.subRecipeId,
      subRecipeArchived: sql<boolean>`${subRecipe.archivedAt} is not null`,
      grams: recipeIngredient.grams,
      position: recipeIngredient.position,
      name: sql<string>`coalesce(${food.name}, ${subRecipe.name})`,
      brand: food.brand,
      unit: sql<"g" | "ml">`coalesce(${food.unit}, 'g')`,
      kcal: sql<number>`coalesce(${food.kcal}, ${recipeIngredient.kcal}, 0)`,
      protein: sql<number>`coalesce(${food.protein}, ${recipeIngredient.protein}, 0)`,
      carbs: sql<number>`coalesce(${food.carbs}, ${recipeIngredient.carbs}, 0)`,
      fat: sql<number>`coalesce(${food.fat}, ${recipeIngredient.fat}, 0)`,
      fiber: sql<number | null>`case when ${food.id} is null then ${recipeIngredient.fiber} else ${food.fiber} end`,
      sugars: sql<number | null>`case when ${food.id} is null then ${recipeIngredient.sugars} else ${food.sugars} end`,
      saturatedFat: sql<
        number | null
      >`case when ${food.id} is null then ${recipeIngredient.saturatedFat} else ${food.saturatedFat} end`,
      salt: sql<number | null>`case when ${food.id} is null then ${recipeIngredient.salt} else ${food.salt} end`,
    })
    .from(recipeIngredient)
    .leftJoin(food, eq(food.id, recipeIngredient.foodId))
    .leftJoin(subRecipe, eq(subRecipe.id, recipeIngredient.subRecipeId))
    .where(inArray(recipeIngredient.recipeId, recipeIds))
    .orderBy(asc(recipeIngredient.position));
}

function ingredientPer100(ingredient: { kcal: number; protein: number; carbs: number; fat: number }) {
  return {
    kcal: Number(ingredient.kcal),
    protein: Number(ingredient.protein),
    carbs: Number(ingredient.carbs),
    fat: Number(ingredient.fat),
  };
}

function nullableNumber(value: number | null) {
  return value === null ? null : Number(value);
}

function ingredientExtras(ingredient: ExtraNutrients) {
  return {
    fiber: nullableNumber(ingredient.fiber),
    sugars: nullableNumber(ingredient.sugars),
    saturatedFat: nullableNumber(ingredient.saturatedFat),
    salt: nullableNumber(ingredient.salt),
  };
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
        .map((ingredient) => ({ grams: ingredient.grams, per100: ingredientPer100(ingredient) })),
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
      id: ingredient.id,
      foodId: ingredient.foodId,
      subRecipeId: ingredient.subRecipeId,
      subRecipeArchived: ingredient.subRecipeArchived,
      name: ingredient.brand ? `${ingredient.name}, ${ingredient.brand}` : ingredient.name,
      unit: ingredient.unit,
      grams: ingredient.grams,
      per100: ingredientPer100(ingredient),
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
    total: sumExtras(ingredients.map((ingredient) => scaleExtras(ingredientExtras(ingredient), ingredient.grams))),
    finalWeightG,
    servings: recipeServingCount({ finalWeightG, servings: row.servings, servingGrams: row.servingGrams }),
  };
}

export async function subRecipeValues(userId: string, recipeIds: string[]) {
  const loggable = await loggableRecipesByIds(userId, recipeIds);
  const values = new Map<string, Nutrients & ExtraNutrients>();
  for (const item of loggable) {
    const extras = await getRecipeExtras(item.id);
    const per100Extras = multiplyExtras(
      extras?.total ?? emptyExtraNutrients,
      item.finalWeightG > 0 ? 100 / item.finalWeightG : 0,
    );
    values.set(item.id, { ...item.per100, ...per100Extras });
  }
  return values;
}
