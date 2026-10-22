"use server";

import { and, eq } from "drizzle-orm";
import { refresh } from "next/cache";
import { z } from "zod";
import { database } from "@/db";
import { diaryEntry } from "@/db/schema";
import { requireUserId } from "@/lib/auth/session";
import { isCopyOntoItself } from "@/lib/nutrition/copy-meal";
import { isIsoDate, todayIsoDate } from "@/lib/nutrition/days";
import { type MealType, mealTypes } from "@/lib/nutrition/meals";
import { extrasFromRow } from "@/lib/nutrition/extra-nutrients";
import {
  copyMealEntries,
  editDiaryEntry,
  type EntryUpdate,
  entryItemSchema,
  insertDiaryEntries,
  removeDiaryEntries,
} from "@/server/diary-entries";
import { setIncompleteDay } from "@/server/incomplete-days";

export type ActionResult<T = undefined> = { ok: true; data: T } | { ok: false; error: string };

const isoDate = z.string().refine(isIsoDate, "Data non valida");
const meal = z.enum(mealTypes);

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

export type UpdateEntryInput = EntryUpdate & { meal: MealType };

export async function updateDiaryEntry(input: UpdateEntryInput): Promise<ActionResult> {
  try {
    const userId = await requireUserId();
    await editDiaryEntry(userId, input);
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
    const [deleted] = await removeDiaryEntries(userId, [z.uuid().parse(id)]);
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
    const deleted = await removeDiaryEntries(userId, ids);
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

const incompleteDaySchema = z.object({
  day: isoDate.refine((day) => day <= todayIsoDate(), "Data non valida"),
  incomplete: z.boolean(),
});

export async function markIncompleteDay(
  input: z.input<typeof incompleteDaySchema>,
): Promise<ActionResult<{ incomplete: boolean }>> {
  try {
    const userId = await requireUserId();
    const { day, incomplete } = incompleteDaySchema.parse(input);
    await setIncompleteDay(userId, day, incomplete);
    refresh();
    return { ok: true, data: { incomplete } };
  } catch (error) {
    return failure(error);
  }
}
