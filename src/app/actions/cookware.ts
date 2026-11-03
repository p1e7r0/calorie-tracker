"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { requireUserId } from "@/lib/auth/session";
import { type CookwareInput, editCookware, insertCookware, removeCookware } from "@/server/cookware";
import type { ActionResult } from "./diary";

function failure(error: unknown): { ok: false; error: string } {
  if (error instanceof z.ZodError) return { ok: false, error: error.issues[0]?.message ?? "Controlla i valori." };
  if (error instanceof Error) return { ok: false, error: error.message };
  return { ok: false, error: "Qualcosa non ha funzionato. Riprova." };
}

export async function createCookware(input: CookwareInput): Promise<ActionResult<{ id: string }>> {
  try {
    const userId = await requireUserId();
    const created = await insertCookware(userId, input);
    refresh();
    return { ok: true, data: { id: created.id } };
  } catch (error) {
    return failure(error);
  }
}

export async function updateCookware(input: CookwareInput & { cookwareId: string }): Promise<ActionResult> {
  try {
    const userId = await requireUserId();
    const { cookwareId, ...values } = input;
    await editCookware(userId, cookwareId, values);
    refresh();
    return { ok: true, data: undefined };
  } catch (error) {
    return failure(error);
  }
}

export async function deleteCookware(cookwareId: string): Promise<ActionResult> {
  try {
    const userId = await requireUserId();
    await removeCookware(userId, cookwareId);
    refresh();
    return { ok: true, data: undefined };
  } catch (error) {
    return failure(error);
  }
}
