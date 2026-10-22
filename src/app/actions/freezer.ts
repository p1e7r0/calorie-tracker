"use server";

import { and, eq, sql } from "drizzle-orm";
import { refresh } from "next/cache";
import { z } from "zod";
import { database } from "@/db";
import { freezerBatch } from "@/db/schema";
import { requireUserId } from "@/lib/auth/session";
import { isIsoDate, todayIsoDate } from "@/lib/nutrition/days";
import { maxFreezerPortions } from "@/lib/nutrition/freezer";
import { mealTypes } from "@/lib/nutrition/meals";
import { insertFreezerBatch, logFreezerPortion } from "@/server/freezer";
import type { ActionResult } from "./diary";

const frozenOn = z
  .string()
  .refine(isIsoDate, "Data non valida.")
  .refine((day) => day <= todayIsoDate(), "La data di congelamento non può essere nel futuro.");
const portions = z
  .number()
  .int("Le porzioni devono essere un numero intero.")
  .min(1, "Metti almeno una porzione.")
  .max(maxFreezerPortions, `Al massimo ${maxFreezerPortions} porzioni.`);

function failure(error: unknown): { ok: false; error: string } {
  if (error instanceof z.ZodError) return { ok: false, error: error.issues[0]?.message ?? "Controlla i valori." };
  if (error instanceof Error) return { ok: false, error: error.message };
  return { ok: false, error: "Qualcosa non ha funzionato. Riprova." };
}

const quantity = z.number().positive("La porzione deve pesare più di zero.").max(10_000);

const createSchema = z.object({
  item: z.discriminatedUnion("type", [
    z.object({ type: z.literal("food"), foodId: z.uuid(), grams: quantity }),
    z.object({
      type: z.literal("recipe"),
      recipeId: z.uuid(),
      grams: quantity.nullish(),
      servings: z.number().positive("La porzione deve essere più di zero.").max(100).nullish(),
    }),
  ]),
  portions,
  frozenOn,
});

export async function createFreezerBatch(input: z.input<typeof createSchema>): Promise<ActionResult<{ id: string }>> {
  try {
    const userId = await requireUserId();
    const { item, portions: count, frozenOn: day } = createSchema.parse(input);
    const created = await insertFreezerBatch(userId, item, count, day);
    refresh();
    return { ok: true, data: { id: created.id } };
  } catch (error) {
    return failure(error);
  }
}

const logSchema = z.object({
  batchId: z.uuid(),
  day: z.string().refine(isIsoDate, "Data non valida."),
  meal: z.enum(mealTypes),
});

export async function logFreezerBatchPortion(input: z.input<typeof logSchema>): Promise<ActionResult<{ id: string }>> {
  try {
    const userId = await requireUserId();
    const { batchId, day, meal } = logSchema.parse(input);
    const created = await logFreezerPortion(userId, batchId, day, meal);
    if (!created) throw new Error("Nel congelatore non ne resta più.");
    refresh();
    return { ok: true, data: { id: created.id } };
  } catch (error) {
    return failure(error);
  }
}

const updateSchema = z.object({
  batchId: z.uuid(),
  label: z.string().trim().min(1, "Dai un nome.").max(80, "Il nome è troppo lungo."),
  frozenOn,
  portionsLeft: z
    .number()
    .int("Le porzioni devono essere un numero intero.")
    .min(0)
    .max(maxFreezerPortions, `Al massimo ${maxFreezerPortions} porzioni.`),
});

export async function updateFreezerBatch(input: z.input<typeof updateSchema>): Promise<ActionResult> {
  try {
    const userId = await requireUserId();
    const { batchId, label, frozenOn: day, portionsLeft } = updateSchema.parse(input);
    const updated = await database
      .update(freezerBatch)
      .set({ label, frozenOn: day, portionsLeft, portions: sql`greatest(${freezerBatch.portions}, ${portionsLeft})` })
      .where(and(eq(freezerBatch.id, batchId), eq(freezerBatch.userId, userId)))
      .returning({ id: freezerBatch.id });
    if (updated.length === 0) throw new Error("Lotto non trovato.");
    refresh();
    return { ok: true, data: undefined };
  } catch (error) {
    return failure(error);
  }
}

export async function deleteFreezerBatch(batchId: string): Promise<ActionResult> {
  try {
    const userId = await requireUserId();
    const deleted = await database
      .delete(freezerBatch)
      .where(and(eq(freezerBatch.id, z.uuid().parse(batchId)), eq(freezerBatch.userId, userId)))
      .returning({ id: freezerBatch.id });
    if (deleted.length === 0) throw new Error("Lotto non trovato.");
    refresh();
    return { ok: true, data: undefined };
  } catch (error) {
    return failure(error);
  }
}
