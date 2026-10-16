"use server";

import { eq } from "drizzle-orm";
import { refresh } from "next/cache";
import { z } from "zod";
import { database } from "@/db";
import { measurement, profile } from "@/db/schema";
import { requireUserId } from "@/lib/auth/session";
import { isIsoDate, todayIsoDate } from "@/lib/nutrition/days";
import { ageOn, computeDailyTargets } from "@/lib/nutrition/goals";
import { getAdaptiveGoal } from "@/server/adaptive-goal";
import { getProfileWithLatestWeight } from "@/server/profile";
import type { ActionResult } from "./diary";

const profileSchema = z.object({
  sex: z.enum(["male", "female"]),
  birthDate: z.string().refine(isIsoDate, "Data di nascita non valida."),
  heightCm: z.number().min(100, "Altezza non valida.").max(250, "Altezza non valida."),
  weightKg: z.number().min(25).max(400).nullish(),
  activityLevel: z.enum(["sedentary", "light", "moderate", "active", "very_active"]),
  goal: z.enum(["lose", "maintain", "gain"]),
  weeklyRateKg: z.number().min(0.1).max(1),
  customTargets: z
    .object({
      kcal: z.number().int().min(800).max(6000),
      proteinG: z.number().int().min(0).max(500),
      carbsG: z.number().int().min(0).max(1000),
      fatG: z.number().int().min(0).max(400),
    })
    .nullish(),
});

export type ProfileInput = z.input<typeof profileSchema>;

export async function saveProfile(input: ProfileInput): Promise<ActionResult<{ kcal: number }>> {
  try {
    const userId = await requireUserId();
    const parsed = profileSchema.parse(input);
    const today = todayIsoDate();
    const age = ageOn(parsed.birthDate, today);
    if (age < 14 || age > 110) throw new Error("Data di nascita non valida.");

    const { latestWeight } = await getProfileWithLatestWeight(userId);
    const weightKg = parsed.weightKg ?? latestWeight?.weightKg;
    if (!weightKg) throw new Error("Inserisci il tuo peso attuale.");
    if (parsed.weightKg && parsed.weightKg !== latestWeight?.weightKg) {
      await database.insert(measurement).values({ userId, measuredOn: today, weightKg: parsed.weightKg });
    }

    const computed = computeDailyTargets({
      sex: parsed.sex,
      weightKg,
      heightCm: parsed.heightCm,
      age,
      activityLevel: parsed.activityLevel,
      goal: parsed.goal,
      weeklyRateKg: parsed.weeklyRateKg,
    });
    const targets = parsed.customTargets ?? {
      kcal: computed.kcal,
      proteinG: computed.proteinG,
      carbsG: computed.carbsG,
      fatG: computed.fatG,
    };
    const values = {
      sex: parsed.sex,
      birthDate: parsed.birthDate,
      heightCm: parsed.heightCm,
      activityLevel: parsed.activityLevel,
      goal: parsed.goal,
      weeklyRateKg: parsed.weeklyRateKg,
      targetKcal: targets.kcal,
      targetProteinG: targets.proteinG,
      targetCarbsG: targets.carbsG,
      targetFatG: targets.fatG,
      targetsCustomized: Boolean(parsed.customTargets),
    };
    await database
      .insert(profile)
      .values({ userId, ...values })
      .onConflictDoUpdate({ target: profile.userId, set: values });
    refresh();
    return { ok: true, data: { kcal: targets.kcal } };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { ok: false, error: error.issues[0]?.message ?? "Controlla i valori inseriti." };
    }
    return { ok: false, error: error instanceof Error ? error.message : "Qualcosa non ha funzionato. Riprova." };
  }
}

export async function applyAdaptiveGoal(): Promise<ActionResult<{ kcal: number }>> {
  try {
    const userId = await requireUserId();
    const { suggestion } = await getAdaptiveGoal(userId, todayIsoDate());
    if (!suggestion) throw new Error("Servono più dati per stimare il tuo fabbisogno.");
    await database
      .update(profile)
      .set({
        targetKcal: suggestion.kcal,
        targetProteinG: suggestion.proteinG,
        targetCarbsG: suggestion.carbsG,
        targetFatG: suggestion.fatG,
        targetsCustomized: true,
      })
      .where(eq(profile.userId, userId));
    refresh();
    return { ok: true, data: { kcal: suggestion.kcal } };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Qualcosa non ha funzionato. Riprova." };
  }
}
