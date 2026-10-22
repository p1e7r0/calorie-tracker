"use server";

import { eq } from "drizzle-orm";
import { refresh } from "next/cache";
import { z } from "zod";
import { database } from "@/db";
import { profile } from "@/db/schema";
import { requireUserId } from "@/lib/auth/session";
import { todayIsoDate } from "@/lib/nutrition/days";
import { weekStart } from "@/lib/nutrition/weeks";
import { applyAdaptiveTargets, type ProfileInput, writeProfile } from "@/server/profile-writes";
import type { ActionResult } from "./diary";

export type { ProfileInput };

export async function saveProfile(input: ProfileInput): Promise<ActionResult<{ kcal: number }>> {
  try {
    const userId = await requireUserId();
    const targets = await writeProfile(userId, input);
    refresh();
    return { ok: true, data: { kcal: targets.kcal } };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { ok: false, error: error.issues[0]?.message ?? "Controlla i valori inseriti." };
    }
    return { ok: false, error: error instanceof Error ? error.message : "Qualcosa non ha funzionato. Riprova." };
  }
}

export type SavedTargets = z.infer<typeof savedTargetsSchema>;

const storedTarget = z.number().int().min(0).max(20000).nullable();

const savedTargetsSchema = z.object({
  kcal: storedTarget,
  proteinG: storedTarget,
  carbsG: storedTarget,
  fatG: storedTarget,
  customized: z.boolean(),
});

export async function applyAdaptiveGoal(): Promise<ActionResult<{ kcal: number; previous: SavedTargets }>> {
  try {
    const userId = await requireUserId();
    const { applied, previous } = await applyAdaptiveTargets(userId);
    refresh();
    return { ok: true, data: { kcal: applied.kcal, previous } };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Qualcosa non ha funzionato. Riprova." };
  }
}

export async function restoreTargets(input: SavedTargets): Promise<ActionResult<null>> {
  try {
    const userId = await requireUserId();
    const previous = savedTargetsSchema.parse(input);
    await database
      .update(profile)
      .set({
        targetKcal: previous.kcal,
        targetProteinG: previous.proteinG,
        targetCarbsG: previous.carbsG,
        targetFatG: previous.fatG,
        targetsCustomized: previous.customized,
      })
      .where(eq(profile.userId, userId));
    refresh();
    return { ok: true, data: null };
  } catch {
    return { ok: false, error: "Non sono riuscito a ripristinare l'obiettivo. Riprova." };
  }
}

export async function dismissWeeklyCheckIn(): Promise<ActionResult<null>> {
  try {
    const userId = await requireUserId();
    const lastCheckInWeek = weekStart(todayIsoDate());
    await database
      .insert(profile)
      .values({ userId, lastCheckInWeek })
      .onConflictDoUpdate({ target: profile.userId, set: { lastCheckInWeek } });
    refresh();
    return { ok: true, data: null };
  } catch {
    return { ok: false, error: "Qualcosa non ha funzionato. Riprova." };
  }
}
