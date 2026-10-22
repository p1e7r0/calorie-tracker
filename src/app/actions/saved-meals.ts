"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { requireUserId } from "@/lib/auth/session";
import { isIsoDate } from "@/lib/nutrition/days";
import { mealTypes } from "@/lib/nutrition/meals";
import { insertDiaryEntries } from "@/server/diary-entries";
import {
  editSavedMeal,
  getSavedMeal,
  markSavedMealUsed,
  removeSavedMeal,
  type SaveMealFromDiaryInput,
  saveMealFromEntries,
  savedMealEntryItems,
  type SavedMealUpdate,
} from "@/server/saved-meals";
import type { ActionResult } from "./diary";

const isoDate = z.string().refine(isIsoDate, "Data non valida");
const meal = z.enum(mealTypes);

function failure(error: unknown): { ok: false; error: string } {
  if (error instanceof z.ZodError) return { ok: false, error: error.issues[0]?.message ?? "Controlla i valori." };
  if (error instanceof Error) return { ok: false, error: error.message };
  return { ok: false, error: "Qualcosa non ha funzionato. Riprova." };
}

export async function saveMealFromDiary(
  input: SaveMealFromDiaryInput,
): Promise<ActionResult<{ id: string; itemCount: number }>> {
  try {
    const userId = await requireUserId();
    const { id, itemCount } = await saveMealFromEntries(userId, input);
    refresh();
    return { ok: true, data: { id, itemCount } };
  } catch (error) {
    return failure(error);
  }
}

const logSavedMealSchema = z.object({ savedMealId: z.uuid(), day: isoDate, meal });

export async function logSavedMeal(
  input: z.input<typeof logSavedMealSchema>,
): Promise<ActionResult<{ entryIds: string[] }>> {
  try {
    const userId = await requireUserId();
    const { savedMealId, day, meal: mealType } = logSavedMealSchema.parse(input);
    const saved = await getSavedMeal(userId, savedMealId);
    if (!saved) throw new Error("Pasto salvato non trovato.");
    if (saved.items.length === 0) throw new Error("Questo pasto salvato è vuoto.");

    const logged = await insertDiaryEntries(userId, day, mealType, savedMealEntryItems(saved));
    await markSavedMealUsed(saved.id);
    refresh();
    return { ok: true, data: { entryIds: logged.map((entry) => entry.id) } };
  } catch (error) {
    return failure(error);
  }
}

export async function updateSavedMeal(input: SavedMealUpdate): Promise<ActionResult> {
  try {
    const userId = await requireUserId();
    await editSavedMeal(userId, input);
    refresh();
    return { ok: true, data: undefined };
  } catch (error) {
    return failure(error);
  }
}

export async function deleteSavedMeal(savedMealId: string): Promise<ActionResult> {
  try {
    const userId = await requireUserId();
    await removeSavedMeal(userId, savedMealId);
    refresh();
    return { ok: true, data: undefined };
  } catch (error) {
    return failure(error);
  }
}
