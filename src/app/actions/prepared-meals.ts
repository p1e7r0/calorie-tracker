"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { requireUserId } from "@/lib/auth/session";
import { isIsoDate } from "@/lib/nutrition/days";
import { mealTypes } from "@/lib/nutrition/meals";
import {
  consumePreparedMeal,
  editPreparedMeal,
  insertPreparedMeal,
  type PreparedMealInput,
  type PreparedMealUpdate,
  removePreparedMeal,
  restorePreparedMealPortion,
} from "@/server/prepared-meals";
import type { ActionResult } from "./diary";

function failure(error: unknown): { ok: false; error: string } {
  if (error instanceof z.ZodError) return { ok: false, error: error.issues[0]?.message ?? "Controlla i valori." };
  if (error instanceof Error) return { ok: false, error: error.message };
  return { ok: false, error: "Qualcosa non ha funzionato. Riprova." };
}

export async function createPreparedMeal(input: PreparedMealInput): Promise<ActionResult<{ id: string }>> {
  try {
    const userId = await requireUserId();
    const id = await insertPreparedMeal(userId, input);
    refresh();
    return { ok: true, data: { id } };
  } catch (error) {
    return failure(error);
  }
}

export async function updatePreparedMeal(input: PreparedMealUpdate): Promise<ActionResult> {
  try {
    const userId = await requireUserId();
    await editPreparedMeal(userId, input);
    refresh();
    return { ok: true, data: undefined };
  } catch (error) {
    return failure(error);
  }
}

export async function deletePreparedMeal(preparedMealId: string): Promise<ActionResult> {
  try {
    const userId = await requireUserId();
    await removePreparedMeal(userId, preparedMealId);
    refresh();
    return { ok: true, data: undefined };
  } catch (error) {
    return failure(error);
  }
}

const logPreparedMealSchema = z.object({
  preparedMealId: z.uuid(),
  day: z.string().refine(isIsoDate, "Data non valida"),
  meal: z.enum(mealTypes),
});

export async function logPreparedMeal(
  input: z.input<typeof logPreparedMealSchema>,
): Promise<ActionResult<{ entryIds: string[]; portionsLeft: number }>> {
  try {
    const userId = await requireUserId();
    const { entries, portionsLeft } = await consumePreparedMeal(userId, logPreparedMealSchema.parse(input));
    refresh();
    return { ok: true, data: { entryIds: entries.map((entry) => entry.id), portionsLeft } };
  } catch (error) {
    return failure(error);
  }
}

export async function undoPreparedMealLog(input: { preparedMealId: string; entryIds: string[] }): Promise<ActionResult> {
  try {
    const userId = await requireUserId();
    await restorePreparedMealPortion(userId, input);
    refresh();
    return { ok: true, data: undefined };
  } catch (error) {
    return failure(error);
  }
}
