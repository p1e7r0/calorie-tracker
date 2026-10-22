"use server";

import { and, count, eq } from "drizzle-orm";
import { refresh } from "next/cache";
import { z } from "zod";
import { database } from "@/db";
import { cookware } from "@/db/schema";
import { requireUserId } from "@/lib/auth/session";
import type { ActionResult } from "./diary";

const maximumCookwareCount = 50;

const cookwareSchema = z.object({
  name: z.string().trim().min(1, "Dai un nome alla pentola.").max(60, "Usa un nome più corto."),
  weightG: z
    .number("Scrivi il peso della pentola vuota.")
    .positive("Il peso della pentola deve essere maggiore di zero.")
    .max(20_000, "Il peso della pentola non può superare 20 kg."),
});

function failure(error: unknown): { ok: false; error: string } {
  if (error instanceof z.ZodError) return { ok: false, error: error.issues[0]?.message ?? "Controlla i valori." };
  if (error instanceof Error) return { ok: false, error: error.message };
  return { ok: false, error: "Qualcosa non ha funzionato. Riprova." };
}

export async function createCookware(input: z.input<typeof cookwareSchema>): Promise<ActionResult<{ id: string }>> {
  try {
    const userId = await requireUserId();
    const values = cookwareSchema.parse(input);
    const [{ value: existing }] = await database
      .select({ value: count() })
      .from(cookware)
      .where(eq(cookware.userId, userId));
    if (existing >= maximumCookwareCount) throw new Error(`Puoi salvare al massimo ${maximumCookwareCount} pentole.`);
    const [created] = await database
      .insert(cookware)
      .values({ userId, ...values })
      .returning({ id: cookware.id });
    refresh();
    return { ok: true, data: { id: created.id } };
  } catch (error) {
    return failure(error);
  }
}

const updateCookwareSchema = cookwareSchema.extend({ cookwareId: z.uuid() });

export async function updateCookware(input: z.input<typeof updateCookwareSchema>): Promise<ActionResult> {
  try {
    const userId = await requireUserId();
    const { cookwareId, ...values } = updateCookwareSchema.parse(input);
    const updated = await database
      .update(cookware)
      .set(values)
      .where(and(eq(cookware.id, cookwareId), eq(cookware.userId, userId)))
      .returning({ id: cookware.id });
    if (updated.length === 0) throw new Error("Pentola non trovata.");
    refresh();
    return { ok: true, data: undefined };
  } catch (error) {
    return failure(error);
  }
}

export async function deleteCookware(cookwareId: string): Promise<ActionResult> {
  try {
    const userId = await requireUserId();
    const deleted = await database
      .delete(cookware)
      .where(and(eq(cookware.id, z.uuid().parse(cookwareId)), eq(cookware.userId, userId)))
      .returning({ id: cookware.id });
    if (deleted.length === 0) throw new Error("Pentola non trovata.");
    refresh();
    return { ok: true, data: undefined };
  } catch (error) {
    return failure(error);
  }
}
