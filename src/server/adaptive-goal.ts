import "server-only";
import { adaptiveWindowDays, estimateMaintenance } from "@/lib/nutrition/adaptive";
import { isCheckInDue, previousWeekSummary } from "@/lib/nutrition/check-in";
import { addDays } from "@/lib/nutrition/days";
import { targetsFromMaintenance } from "@/lib/nutrition/goals";
import { listIncompleteDays } from "./incomplete-days";
import { listMeasurements } from "./measurements";
import { getProfileWithLatestWeight } from "./profile";
import { getDailyTotals } from "./statistics";

async function loadAdaptiveGoal(userId: string, today: string) {
  const [dailyTotals, measurements, { profile, latestWeight }, incompleteDays] = await Promise.all([
    getDailyTotals(userId, today, adaptiveWindowDays + 1),
    listMeasurements(userId),
    getProfileWithLatestWeight(userId),
    listIncompleteDays(userId, addDays(today, -adaptiveWindowDays), today),
  ]);
  const estimate = estimateMaintenance({
    dailyIntakes: dailyTotals.map((totals) => ({ day: totals.day, value: totals.kcal })),
    weights: measurements.map((row) => ({ day: row.measuredOn, value: row.weightKg })),
    today,
    incompleteDays,
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
    adaptiveGoal: {
      estimate,
      suggestion,
      goal: profile?.goal ?? null,
      weeklyRateKg: profile?.weeklyRateKg ?? null,
      currentTargetKcal: profile?.targetKcal ?? null,
    },
    dailyTotals,
    incompleteDays,
    lastCheckInWeek: profile?.lastCheckInWeek ?? null,
  };
}

export async function getAdaptiveGoal(userId: string, today: string) {
  return (await loadAdaptiveGoal(userId, today)).adaptiveGoal;
}

export type AdaptiveGoal = Awaited<ReturnType<typeof getAdaptiveGoal>>;

export async function getWeeklyCheckIn(userId: string, today: string) {
  const { adaptiveGoal, dailyTotals, incompleteDays, lastCheckInWeek } = await loadAdaptiveGoal(userId, today);
  if (adaptiveGoal.estimate.status !== "ready" || !isCheckInDue({ today, lastCheckInWeek })) return null;
  return { ...adaptiveGoal, summary: previousWeekSummary(dailyTotals, today, incompleteDays) };
}

export type WeeklyCheckIn = NonNullable<Awaited<ReturnType<typeof getWeeklyCheckIn>>>;

export async function getWeeklyPushSummary(userId: string, today: string) {
  const { adaptiveGoal, dailyTotals, incompleteDays } = await loadAdaptiveGoal(userId, today);
  return {
    summary: previousWeekSummary(dailyTotals, today, incompleteDays),
    maintenanceKcal: adaptiveGoal.estimate.status === "ready" ? adaptiveGoal.estimate.maintenanceKcal : null,
  };
}
