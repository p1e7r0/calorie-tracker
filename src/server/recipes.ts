import "server-only";
import { and, asc, desc, eq, inArray, isNotNull, isNull, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { database } from "@/db";
import { diaryEntry, favoriteRecipe, food, recipe, recipeIngredient } from "@/db/schema";
import { extrasFromRow } from "@/lib/nutrition/extra-nutrients";
import { emptyNutrients } from "@/lib/nutrition/nutrients";
import {
  computeRecipeNutrition,
  type RecipeGraphIngredient,
  type RecipeGraphNode,
  resolveRecipes,
} from "@/lib/nutrition/recipe";
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
      grams: recipeIngredient.grams,
      position: recipeIngredient.position,
      name: sql<string>`coalesce(${food.name}, ${subRecipe.name})`,
      brand: food.brand,
      unit: sql<"g" | "ml">`coalesce(${food.unit}, 'g')`,
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
    .leftJoin(food, eq(food.id, recipeIngredient.foodId))
    .leftJoin(subRecipe, eq(subRecipe.id, recipeIngredient.subRecipeId))
    .where(inArray(recipeIngredient.recipeId, recipeIds))
    .orderBy(asc(recipeIngredient.position));
}

type IngredientRow = Awaited<ReturnType<typeof loadRecipeIngredients>>[number];

function toGraphIngredient(ingredient: IngredientRow): RecipeGraphIngredient {
  if (ingredient.subRecipeId) return { grams: ingredient.grams, subRecipeId: ingredient.subRecipeId };
  return {
    grams: ingredient.grams,
    per100: {
      kcal: ingredient.kcal ?? 0,
      protein: ingredient.protein ?? 0,
      carbs: ingredient.carbs ?? 0,
      fat: ingredient.fat ?? 0,
    },
    extras: extrasFromRow(ingredient),
  };
}

const maximumNestingDepth = 20;

async function loadRecipeGraph(recipeIds: string[], knownRows: RecipeRow[] = []) {
  const rows = new Map(knownRows.map((row) => [row.id, row]));
  const ingredients: IngredientRow[] = [];
  let pending = [...new Set(recipeIds)];
  const loaded = new Set<string>();
  for (let depth = 0; pending.length > 0 && depth < maximumNestingDepth; depth += 1) {
    const missingRows = pending.filter((recipeId) => !rows.has(recipeId));
    const [levelIngredients, levelRows] = await Promise.all([
      loadRecipeIngredients(pending),
      missingRows.length > 0
        ? database.select(recipeColumns).from(recipe).where(inArray(recipe.id, missingRows))
        : Promise.resolve([]),
    ]);
    for (const row of levelRows) rows.set(row.id, row);
    for (const recipeId of pending) loaded.add(recipeId);
    ingredients.push(...levelIngredients);
    pending = [
      ...new Set(
        levelIngredients
          .map((ingredient) => ingredient.subRecipeId)
          .filter((recipeId): recipeId is string => recipeId !== null && !loaded.has(recipeId)),
      ),
    ];
  }
  const nodes = new Map<string, RecipeGraphNode>();
  for (const row of rows.values()) {
    nodes.set(row.id, {
      cookedWeightG: row.cookedWeightG,
      servings: row.servings,
      servingGrams: row.servingGrams,
      ingredients: ingredients.filter((ingredient) => ingredient.recipeId === row.id).map(toGraphIngredient),
    });
  }
  return { ingredients, resolved: resolveRecipes(nodes) };
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
  const [{ resolved }, favorites, lastQuantities] = await Promise.all([
    loadRecipeGraph(recipeIds, rows),
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
    const nutrition = resolved.get(row.id)?.nutrition ?? computeRecipeNutrition({ ingredients: [] });
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
  const [{ ingredients, resolved }, favorite] = await Promise.all([
    loadRecipeGraph([row.id], [row]),
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
    ingredients: ingredients
      .filter((ingredient) => ingredient.recipeId === row.id)
      .map((ingredient) => {
        const graphIngredient = toGraphIngredient(ingredient);
        return {
          foodId: ingredient.foodId,
          subRecipeId: ingredient.subRecipeId,
          name: ingredient.brand ? `${ingredient.name}, ${ingredient.brand}` : ingredient.name,
          unit: ingredient.unit,
          grams: ingredient.grams,
          per100:
            "per100" in graphIngredient
              ? graphIngredient.per100
              : (resolved.get(graphIngredient.subRecipeId)?.nutrition.per100g ?? emptyNutrients),
        };
      }),
  };
}

export type RecipeForEditing = NonNullable<Awaited<ReturnType<typeof getRecipeForEditing>>>;

export async function getRecipeExtras(recipeId: string) {
  const { resolved } = await loadRecipeGraph([recipeId]);
  const recipeValues = resolved.get(recipeId);
  if (!recipeValues) return null;
  return {
    total: recipeValues.extras,
    finalWeightG: recipeValues.nutrition.finalWeightG,
    servings: recipeValues.nutrition.servings,
  };
}

export async function subRecipeEdges(userId: string) {
  const rows = await database
    .select({ recipeId: recipeIngredient.recipeId, subRecipeId: recipeIngredient.subRecipeId })
    .from(recipeIngredient)
    .innerJoin(recipe, eq(recipe.id, recipeIngredient.recipeId))
    .where(and(eq(recipe.ownerId, userId), isNotNull(recipeIngredient.subRecipeId)));
  const edges = new Map<string, string[]>();
  for (const row of rows) {
    if (!row.subRecipeId) continue;
    edges.set(row.recipeId, [...(edges.get(row.recipeId) ?? []), row.subRecipeId]);
  }
  return edges;
}
