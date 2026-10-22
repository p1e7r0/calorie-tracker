import "server-only";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { database } from "@/db";
import { measurement, profile } from "@/db/schema";
import { isIsoDate, todayIsoDate } from "@/lib/nutrition/days";
import { ageOn, computeDailyTargets } from "@/lib/nutrition/goals";
import { targetWeightBounds } from "@/lib/nutrition/target-weight";
import { weekStart } from "@/lib/nutrition/weeks";
import { getAdaptiveGoal } from "./adaptive-goal";
import { getProfileWithLatestWeight } from "./profile";

export const profileSchema = z.object({
  sex: z.enum(["male", "female"]),
  birthDate: z.string().refine(isIsoDate, "Data di nascita non valida."),
  heightCm: z.number().min(100, "Altezza non valida.").max(250, "Altezza non valida."),
  weightKg: z.number().min(25).max(400).nullish(),
  activityLevel: z.enum(["sedentary", "light", "moderate", "active", "very_active"]),
  goal: z.enum(["lose", "maintain", "gain"]),
  weeklyRateKg: z.number().min(0.1).max(1),
  targetWeightKg: z
    .number()
    .min(targetWeightBounds.minimum, "Peso obiettivo non valido.")
    .max(targetWeightBounds.maximum, "Peso obiettivo non valido.")
    .nullish(),
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

export async function writeProfile(userId: string, input: ProfileInput) {
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
    targetWeightKg: parsed.goal === "maintain" ? null : (parsed.targetWeightKg ?? null),
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
  return targets;
}

export async function applyAdaptiveTargets(userId: string) {
  const today = todayIsoDate();
  const [{ suggestion }, [current]] = await Promise.all([
    getAdaptiveGoal(userId, today),
    database
      .select({
        kcal: profile.targetKcal,
        proteinG: profile.targetProteinG,
        carbsG: profile.targetCarbsG,
        fatG: profile.targetFatG,
        customized: profile.targetsCustomized,
      })
      .from(profile)
      .where(eq(profile.userId, userId)),
  ]);
  if (!suggestion || !current) throw new Error("Servono più dati per stimare il tuo fabbisogno.");
  await database
    .update(profile)
    .set({
      targetKcal: suggestion.kcal,
      targetProteinG: suggestion.proteinG,
      targetCarbsG: suggestion.carbsG,
      targetFatG: suggestion.fatG,
      targetsCustomized: true,
      lastCheckInWeek: weekStart(today),
    })
    .where(eq(profile.userId, userId));
  return { applied: suggestion, previous: current };
}
