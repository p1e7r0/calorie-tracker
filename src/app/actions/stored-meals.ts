"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { requireUserId } from "@/lib/auth/session";
import {
  createStoredMeal as insertStoredMeal,
  editStoredMeal,
  type LogStoredMealPortionInput,
  logStoredMealPortion,
  removeStoredMeal,
  type StoredMealInput,
  type StoredMealUpdate,
  type StoreMealFromDiaryInput,
  storeMealFromDiary,
  undoStoredMealPortion,
} from "@/server/stored-meals";
import type { ActionResult } from "./diary";

function failure(error: unknown): { ok: false; error: string } {
  if (error instanceof z.ZodError) return { ok: false, error: error.issues[0]?.message ?? "Controlla i valori." };
  if (error instanceof Error) return { ok: false, error: error.message };
  return { ok: false, error: "Qualcosa non ha funzionato. Riprova." };
}

export async function createStoredMeal(input: StoredMealInput): Promise<ActionResult<{ id: string }>> {
  try {
    const userId = await requireUserId();
    const id = await insertStoredMeal(userId, input);
    refresh();
    return { ok: true, data: { id } };
  } catch (error) {
    return failure(error);
  }
}

export async function storeMealFromDiaryMeal(
  input: StoreMealFromDiaryInput,
): Promise<ActionResult<{ id: string; itemCount: number }>> {
  try {
    const userId = await requireUserId();
    const stored = await storeMealFromDiary(userId, input);
    refresh();
    return { ok: true, data: stored };
  } catch (error) {
    return failure(error);
  }
}

export async function updateStoredMeal(input: StoredMealUpdate): Promise<ActionResult> {
  try {
    const userId = await requireUserId();
    await editStoredMeal(userId, input);
    refresh();
    return { ok: true, data: undefined };
  } catch (error) {
    return failure(error);
  }
}

export async function deleteStoredMeal(storedMealId: string): Promise<ActionResult> {
  try {
    const userId = await requireUserId();
    await removeStoredMeal(userId, storedMealId);
    refresh();
    return { ok: true, data: undefined };
  } catch (error) {
    return failure(error);
  }
}

export async function logStoredMeal(
  input: LogStoredMealPortionInput,
): Promise<ActionResult<{ entryIds: string[]; remainingPortions: number }>> {
  try {
    const userId = await requireUserId();
    const { entries, remainingPortions } = await logStoredMealPortion(userId, input);
    refresh();
    return { ok: true, data: { entryIds: entries.map((entry) => entry.id), remainingPortions } };
  } catch (error) {
    return failure(error);
  }
}

export async function undoStoredMeal(input: { storedMealId: string; entryIds: string[] }): Promise<ActionResult> {
  try {
    const userId = await requireUserId();
    await undoStoredMealPortion(userId, input);
    refresh();
    return { ok: true, data: undefined };
  } catch (error) {
    return failure(error);
  }
}
