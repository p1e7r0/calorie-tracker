"use server";

import { and, eq, inArray } from "drizzle-orm";
import { refresh } from "next/cache";
import { z } from "zod";
import { database } from "@/db";
import { diaryEntry } from "@/db/schema";
import { requireUserId } from "@/lib/auth/session";
import { isCopyOntoItself } from "@/lib/nutrition/copy-meal";
import { isIsoDate } from "@/lib/nutrition/days";
import { mealTypes } from "@/lib/nutrition/meals";
import {
  multiplyNutrients,
  type Nutrients,
  roundNutrients,
  scaleNutrients,
} from "@/lib/nutrition/nutrients";
import { recipePortionNutrients } from "@/lib/nutrition/recipe";
import { extrasFromRow, multiplyExtras, roundExtras, scaleExtras } from "@/lib/nutrition/extra-nutrients";
import {
  copyMealEntries,
  entryItemSchema,
  insertDiaryEntries,
  recipeNutritionFromLoggable,
  recipePortionExtras,
} from "@/server/diary-entries";
import { getVisibleFood } from "@/server/foods";
import { getLoggableRecipe } from "@/server/recipes";

export type ActionResult<T = undefined> = { ok: true; data: T } | { ok: false; error: string };

const isoDate = z.string().refine(isIsoDate, "Data non valida");
const meal = z.enum(mealTypes);
const quantity = z.number().positive().max(10_000);

const addEntrySchema = z.object({
  day: isoDate,
  meal,
  item: entryItemSchema,
});

export type AddEntryInput = z.input<typeof addEntrySchema>;

function failure(error: unknown): { ok: false; error: string } {
  if (error instanceof z.ZodError) return { ok: false, error: "Controlla i valori inseriti." };
  if (error instanceof Error) return { ok: false, error: error.message };
  return { ok: false, error: "Qualcosa non ha funzionato. Riprova." };
}

export async function addDiaryEntry(input: AddEntryInput): Promise<ActionResult<{ id: string }>> {
  try {
    const userId = await requireUserId();
    const { day, meal: mealType, item } = addEntrySchema.parse(input);
    const [created] = await insertDiaryEntries(userId, day, mealType, [item]);
    refresh();
    return { ok: true, data: { id: created.id } };
  } catch (error) {
    return failure(error);
  }
}

const updateEntrySchema = z.object({
  id: z.uuid(),
  meal,
  grams: quantity.nullish(),
  servings: z.number().positive().max(100).nullish(),
  kcal: z.number().min(0).max(20_000).nullish(),
  portionLabel: z.string().trim().max(200).nullish(),
});

export type UpdateEntryInput = z.input<typeof updateEntrySchema>;

export async function updateDiaryEntry(input: UpdateEntryInput): Promise<ActionResult> {
  try {
    const userId = await requireUserId();
    const update = updateEntrySchema.parse(input);
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

    await database
      .update(diaryEntry)
      .set({ meal: update.meal, grams, servings, portionLabel, ...roundNutrients(nutrients), ...roundExtras(extras) })
      .where(and(eq(diaryEntry.id, entry.id), eq(diaryEntry.userId, userId)));
    refresh();
    return { ok: true, data: undefined };
  } catch (error) {
    return failure(error);
  }
}

export type DeletedEntry = typeof diaryEntry.$inferSelect;

export async function deleteDiaryEntry(id: string): Promise<ActionResult<DeletedEntry>> {
  try {
    const userId = await requireUserId();
    const entryId = z.uuid().parse(id);
    const [deleted] = await database
      .delete(diaryEntry)
      .where(and(eq(diaryEntry.id, entryId), eq(diaryEntry.userId, userId)))
      .returning();
    if (!deleted) throw new Error("Voce non trovata.");
    refresh();
    return { ok: true, data: deleted };
  } catch (error) {
    return failure(error);
  }
}

export async function deleteDiaryEntries(ids: string[]): Promise<ActionResult<{ deleted: number }>> {
  try {
    const userId = await requireUserId();
    const entryIds = z.array(z.uuid()).min(1).max(100).parse(ids);
    const deleted = await database
      .delete(diaryEntry)
      .where(and(eq(diaryEntry.userId, userId), inArray(diaryEntry.id, entryIds)))
      .returning({ id: diaryEntry.id });
    if (deleted.length === 0) throw new Error("Voci non trovate.");
    refresh();
    return { ok: true, data: { deleted: deleted.length } };
  } catch (error) {
    return failure(error);
  }
}

export async function restoreDiaryEntry(entry: DeletedEntry): Promise<ActionResult> {
  try {
    const userId = await requireUserId();
    const day = isoDate.parse(entry.day);
    const mealType = meal.parse(entry.meal);
    await database
      .insert(diaryEntry)
      .values({
        userId,
        day,
        meal: mealType,
        kind: z.enum(["food", "recipe", "quick"]).parse(entry.kind),
        foodId: entry.foodId ? z.uuid().parse(entry.foodId) : null,
        recipeId: entry.recipeId ? z.uuid().parse(entry.recipeId) : null,
        label: z.string().max(200).parse(entry.label),
        grams: entry.grams,
        servings: entry.servings,
        portionLabel: entry.portionLabel,
        kcal: z.number().min(0).parse(entry.kcal),
        protein: entry.protein,
        carbs: entry.carbs,
        fat: entry.fat,
        ...extrasFromRow(entry),
      })
      .onConflictDoNothing();
    refresh();
    return { ok: true, data: undefined };
  } catch (error) {
    return failure(error);
  }
}

export async function duplicateDiaryEntry(id: string): Promise<ActionResult<{ id: string }>> {
  try {
    const userId = await requireUserId();
    const entryId = z.uuid().parse(id);
    const [source] = await database
      .select()
      .from(diaryEntry)
      .where(and(eq(diaryEntry.id, entryId), eq(diaryEntry.userId, userId)));
    if (!source) throw new Error("Voce non trovata.");
    const [created] = await database
      .insert(diaryEntry)
      .values({
        userId: source.userId,
        day: source.day,
        meal: source.meal,
        kind: source.kind,
        foodId: source.foodId,
        recipeId: source.recipeId,
        label: source.label,
        grams: source.grams,
        servings: source.servings,
        portionLabel: source.portionLabel,
        kcal: source.kcal,
        protein: source.protein,
        carbs: source.carbs,
        fat: source.fat,
        ...extrasFromRow(source),
      })
      .returning({ id: diaryEntry.id });
    refresh();
    return { ok: true, data: { id: created.id } };
  } catch (error) {
    return failure(error);
  }
}

const copyMealSchema = z.object({
  fromDay: isoDate,
  fromMeal: meal,
  toDay: isoDate,
  toMeal: meal,
});

export async function copyMeal(input: z.input<typeof copyMealSchema>): Promise<ActionResult<{ entryIds: string[] }>> {
  try {
    const userId = await requireUserId();
    const copy = copyMealSchema.parse(input);
    if (isCopyOntoItself(copy)) throw new Error("Scegli un altro giorno o un altro pasto da cui copiare.");
    const created = await copyMealEntries(userId, copy);
    if (created.length > 0) refresh();
    return { ok: true, data: { entryIds: created.map((entry) => entry.id) } };
  } catch (error) {
    return failure(error);
  }
}
