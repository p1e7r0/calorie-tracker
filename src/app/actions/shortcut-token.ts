"use server";

import { refresh } from "next/cache";
import { requireUserId } from "@/lib/auth/session";
import { createApiToken, deleteApiTokens } from "@/server/api-tokens";
import type { ActionResult } from "./diary";

function failure(error: unknown): { ok: false; error: string } {
  if (error instanceof Error && error.message.startsWith("Sessione")) return { ok: false, error: error.message };
  console.error(error);
  return { ok: false, error: "Non è stato possibile aggiornare il token. Riprova." };
}

export async function createShortcutToken(): Promise<ActionResult<{ token: string }>> {
  try {
    const userId = await requireUserId();
    const token = await createApiToken(userId);
    refresh();
    return { ok: true, data: { token } };
  } catch (error) {
    return failure(error);
  }
}

export async function revokeShortcutToken(): Promise<ActionResult> {
  try {
    const userId = await requireUserId();
    await deleteApiTokens(userId);
    refresh();
    return { ok: true, data: undefined };
  } catch (error) {
    return failure(error);
  }
}
