"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { requireUserId } from "@/lib/auth/session";
import { type MeasurementInput, removeMeasurement, writeMeasurement } from "@/server/measurements";
import type { ActionResult } from "./diary";

export type { MeasurementInput };

function failure(error: unknown): { ok: false; error: string } {
  if (error instanceof z.ZodError) return { ok: false, error: error.issues[0]?.message ?? "Controlla i valori." };
  if (error instanceof Error) return { ok: false, error: error.message };
  return { ok: false, error: "Qualcosa non ha funzionato. Riprova." };
}

export async function saveMeasurement(input: MeasurementInput): Promise<ActionResult> {
  try {
    const userId = await requireUserId();
    await writeMeasurement(userId, input);
    refresh();
    return { ok: true, data: undefined };
  } catch (error) {
    return failure(error);
  }
}

export async function deleteMeasurement(id: string): Promise<ActionResult> {
  try {
    const userId = await requireUserId();
    await removeMeasurement(userId, id);
    refresh();
    return { ok: true, data: undefined };
  } catch (error) {
    return failure(error);
  }
}
