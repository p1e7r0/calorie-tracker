import "server-only";
import { and, asc, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { database } from "@/db";
import { diaryEntry } from "@/db/schema";
import type { MealCopy } from "@/lib/nutrition/copy-meal";
import {
  emptyExtraNutrients,
  extrasFromRow,
  multiplyExtras,
  roundExtras,
  scaleExtras,
} from "@/lib/nutrition/extra-nutrients";
import { type MealType, mealTypes } from "@/lib/nutrition/meals";
import { multiplyNutrients, type Nutrients, roundNutrients, scaleNutrients } from "@/lib/nutrition/nutrients";
import { recipePortionNutrients, type RecipeNutrition } from "@/lib/nutrition/recipe";
import { getVisibleFood } from "./foods";
import { getLoggableRecipe, getRecipeExtras } from "./recipes";

const quantity = z.number().positive().max(10_000);

export const entryItemSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("food"),
    foodId: z.uuid(),
    grams: quantity,
    portionLabel: z.string().max(80).nullish(),
  }),
  z.object({
    type: z.literal("recipe"),
    recipeId: z.uuid(),
    grams: quantity.nullish(),
    servings: z.number().positive().max(100).nullish(),
  }),
  z.object({
    type: z.literal("quick"),
    label: z.string().trim().max(80).nullish(),
    kcal: z.number().min(0).max(20_000),
    protein: z.number().min(0).max(2_000).nullish(),
    carbs: z.number().min(0).max(2_000).nullish(),
    fat: z.number().min(0).max(2_000).nullish(),
  }),
]);

export type EntryItem = z.infer<typeof entryItemSchema>;

export function recipeNutritionFromLoggable(recipe: NonNullable<Awaited<ReturnType<typeof getLoggableRecipe>>>) {
  return {
    total: multiplyNutrients(recipe.perServing, recipe.servings),
    rawWeightG: recipe.finalWeightG,
    finalWeightG: recipe.finalWeightG,
    per100g: recipe.per100,
    perServing: recipe.perServing,
    servings: recipe.servings,
  } satisfies RecipeNutrition;
}

export async function resolveEntryValues(userId: string, item: EntryItem) {
  if (item.type === "food") {
    const foodRow = await getVisibleFood(userId, item.foodId);
    if (!foodRow) throw new Error("Alimento non trovato.");
    const per100: Nutrients = {
      kcal: foodRow.kcal,
      protein: foodRow.protein,
      carbs: foodRow.carbs,
      fat: foodRow.fat,
    };
    return {
      kind: "food" as const,
      foodId: foodRow.id,
      recipeId: null,
      label: foodRow.brand ? `${foodRow.name}, ${foodRow.brand}` : foodRow.name,
      grams: item.grams,
      servings: null,
      portionLabel: item.portionLabel ?? null,
      nutrients: scaleNutrients(per100, item.grams),
      extras: scaleExtras(extrasFromRow(foodRow), item.grams),
    };
  }

  if (item.type === "recipe") {
    const recipe = await getLoggableRecipe(userId, item.recipeId);
    if (!recipe) throw new Error("Ricetta non trovata.");
    const nutrition = recipeNutritionFromLoggable(recipe);
    const portion = item.grams ? { grams: item.grams } : { servings: item.servings ?? 1 };
    return {
      kind: "recipe" as const,
      foodId: null,
      recipeId: recipe.id,
      label: recipe.name,
      grams: item.grams ?? null,
      servings: item.grams ? null : (item.servings ?? 1),
      portionLabel: null,
      nutrients: recipePortionNutrients(nutrition, portion),
      extras: await recipePortionExtras(recipe.id, portion),
    };
  }

  return {
    kind: "quick" as const,
    foodId: null,
    recipeId: null,
    label: item.label || "Kcal veloci",
    grams: null,
    servings: null,
    portionLabel: null,
    nutrients: {
      kcal: item.kcal,
      protein: item.protein ?? 0,
      carbs: item.carbs ?? 0,
      fat: item.fat ?? 0,
    },
    extras: emptyExtraNutrients,
  };
}

export async function recipePortionExtras(recipeId: string, portion: { grams: number } | { servings: number }) {
  const recipeExtras = await getRecipeExtras(recipeId);
  if (!recipeExtras) return emptyExtraNutrients;
  const factor =
    "grams" in portion
      ? recipeExtras.finalWeightG > 0
        ? portion.grams / recipeExtras.finalWeightG
        : 0
      : portion.servings / recipeExtras.servings;
  return multiplyExtras(recipeExtras.total, factor);
}

export async function insertDiaryEntries(
  userId: string,
  day: string,
  meal: MealType,
  items: readonly EntryItem[],
  source: (typeof diaryEntry.$inferInsert)["source"] = "app",
) {
  const resolved = await Promise.all(items.map((item) => resolveEntryValues(userId, item)));
  if (resolved.length === 0) return [];
  return database
    .insert(diaryEntry)
    .values(
      resolved.map(({ nutrients, extras, ...values }) => ({
        ...values,
        ...roundNutrients(nutrients),
        ...roundExtras(extras),
        userId,
        day,
        meal,
        source,
      })),
    )
    .returning();
}

export async function copyMealEntries(
  userId: string,
  { fromDay, fromMeal, toDay, toMeal }: MealCopy,
  source: (typeof diaryEntry.$inferInsert)["source"] = "app",
) {
  const sourceEntries = await database
    .select()
    .from(diaryEntry)
    .where(and(eq(diaryEntry.userId, userId), eq(diaryEntry.day, fromDay), eq(diaryEntry.meal, fromMeal)))
    .orderBy(asc(diaryEntry.createdAt));
  if (sourceEntries.length === 0) return [];
  return database
    .insert(diaryEntry)
    .values(
      sourceEntries.map((entry) => ({
        userId,
        day: toDay,
        meal: toMeal,
        kind: entry.kind,
        foodId: entry.foodId,
        recipeId: entry.recipeId,
        label: entry.label,
        grams: entry.grams,
        servings: entry.servings,
        portionLabel: entry.portionLabel,
        kcal: entry.kcal,
        protein: entry.protein,
        carbs: entry.carbs,
        fat: entry.fat,
        ...extrasFromRow(entry),
        source,
      })),
    )
    .returning();
}

export const entryUpdateSchema = z.object({
  id: z.uuid(),
  meal: z.enum(mealTypes).nullish(),
  grams: quantity.nullish(),
  servings: z.number().positive().max(100).nullish(),
  kcal: z.number().min(0).max(20_000).nullish(),
  portionLabel: z.string().trim().max(200).nullish(),
});

export type EntryUpdate = z.input<typeof entryUpdateSchema>;

export async function editDiaryEntry(userId: string, input: EntryUpdate) {
  const update = entryUpdateSchema.parse(input);
  const [entry] = await database
    .select()
    .from(diaryEntry)
    .where(and(eq(diaryEntry.id, update.id), eq(diaryEntry.userId, userId)));
  if (!entry) throw new Error("Voce non trovata.");

  const snapshot: Nutrients = {
    kcal: entry.kcal,
    protein: entry.protein,
    carbs: entry.carbs,
    fat: entry.fat,
  };
  let nutrients = snapshot;
  let extras = extrasFromRow(entry);
  let grams = entry.grams;
  let servings = entry.servings;
  let portionLabel = entry.portionLabel;

  if (entry.kind === "quick") {
    if (update.kcal !== null && update.kcal !== undefined) {
      nutrients = entry.kcal > 0 ? multiplyNutrients(snapshot, update.kcal / entry.kcal) : { ...snapshot, kcal: update.kcal };
      extras = entry.kcal > 0 ? multiplyExtras(extras, update.kcal / entry.kcal) : extras;
    }
  } else if (entry.kind === "food" && update.grams) {
    const foodRow = entry.foodId ? await getVisibleFood(userId, entry.foodId) : null;
    nutrients = foodRow
      ? scaleNutrients(foodRow, update.grams)
      : multiplyNutrients(snapshot, entry.grams ? update.grams / entry.grams : 1);
    extras = foodRow
      ? scaleExtras(extrasFromRow(foodRow), update.grams)
      : multiplyExtras(extras, entry.grams ? update.grams / entry.grams : 1);
    if (update.portionLabel !== undefined) portionLabel = update.portionLabel || null;
    else if (update.grams !== entry.grams) portionLabel = null;
    grams = update.grams;
  } else if (entry.kind === "recipe" && (update.grams || update.servings)) {
    const recipe = entry.recipeId ? await getLoggableRecipe(userId, entry.recipeId) : null;
    const portion = update.grams ? { grams: update.grams } : { servings: update.servings! };
    if (recipe) {
      nutrients = recipePortionNutrients(recipeNutritionFromLoggable(recipe), portion);
      extras = await recipePortionExtras(recipe.id, portion);
    } else {
      const previous = entry.grams ?? entry.servings ?? 1;
      const next = update.grams ?? update.servings ?? 1;
      nutrients = multiplyNutrients(snapshot, next / previous);
      extras = multiplyExtras(extras, next / previous);
    }
    grams = update.grams ?? null;
    servings = update.grams ? null : (update.servings ?? null);
  }

  const [updated] = await database
    .update(diaryEntry)
    .set({
      meal: update.meal ?? entry.meal,
      grams,
      servings,
      portionLabel,
      ...roundNutrients(nutrients),
      ...roundExtras(extras),
    })
    .where(and(eq(diaryEntry.id, entry.id), eq(diaryEntry.userId, userId)))
    .returning();
  return updated;
}

export async function removeDiaryEntries(userId: string, entryIds: readonly string[]) {
  const ids = z.array(z.uuid()).min(1).max(100).parse(entryIds);
  return database
    .delete(diaryEntry)
    .where(and(eq(diaryEntry.userId, userId), inArray(diaryEntry.id, ids)))
    .returning();
}
