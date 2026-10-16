import "server-only";
import { adaptiveWindowDays, estimateMaintenance } from "@/lib/nutrition/adaptive";
import { targetsFromMaintenance } from "@/lib/nutrition/goals";
import { listMeasurements } from "./measurements";
import { getProfileWithLatestWeight } from "./profile";
import { getDailyTotals } from "./statistics";

export async function getAdaptiveGoal(userId: string, today: string) {
  const [dailyTotals, measurements, { profile, latestWeight }] = await Promise.all([
    getDailyTotals(userId, today, adaptiveWindowDays + 1),
    listMeasurements(userId),
    getProfileWithLatestWeight(userId),
  ]);
  const estimate = estimateMaintenance({
    dailyIntakes: dailyTotals.map((totals) => ({ day: totals.day, value: totals.kcal })),
    weights: measurements.map((row) => ({ day: row.measuredOn, value: row.weightKg })),
    today,
  });
  const suggestion =
    estimate.status === "ready" && profile?.sex && latestWeight
      ? targetsFromMaintenance({
          maintenanceKcal: estimate.maintenanceKcal,
          sex: profile.sex,
          weightKg: latestWeight.weightKg,
          goal: profile.goal,
          weeklyRateKg: profile.weeklyRateKg,
        })
      : null;
  return {
    estimate,
    suggestion,
    goal: profile?.goal ?? null,
    weeklyRateKg: profile?.weeklyRateKg ?? null,
    currentTargetKcal: profile?.targetKcal ?? null,
  };
}

export type AdaptiveGoal = Awaited<ReturnType<typeof getAdaptiveGoal>>;
