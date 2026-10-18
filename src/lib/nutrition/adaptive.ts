import { addDays, daysBetween } from "./days";
import { kcalPerKilogramOfBodyWeight } from "./goals";

export const adaptiveWindowDays = 28;
export const requiredLoggedDays = 14;
export const requiredWeightSpanDays = 14;
const partialDayKcal = 600;
const plausibleMaintenance = { minimum: 1000, maximum: 6000 };

type DatedValue = { day: string; value: number };

export type MaintenanceEstimate =
  | {
      status: "insufficient";
      loggedDays: number;
      weightSpanDays: number;
      excludedIncompleteDays: number;
    }
  | {
      status: "implausible";
      loggedDays: number;
      weightSpanDays: number;
      excludedIncompleteDays: number;
    }
  | {
      status: "ready";
      maintenanceKcal: number;
      averageIntakeKcal: number;
      weeklyWeightChangeKg: number;
      loggedDays: number;
      weightSpanDays: number;
      excludedIncompleteDays: number;
    };

export function weightSlopePerDay(weights: readonly DatedValue[]) {
  if (weights.length < 2) return 0;
  const origin = weights[0].day;
  const points = weights.map((weight) => ({ x: daysBetween(origin, weight.day), y: weight.value }));
  const meanX = points.reduce((sum, point) => sum + point.x, 0) / points.length;
  const meanY = points.reduce((sum, point) => sum + point.y, 0) / points.length;
  const covariance = points.reduce((sum, point) => sum + (point.x - meanX) * (point.y - meanY), 0);
  const variance = points.reduce((sum, point) => sum + (point.x - meanX) ** 2, 0);
  return variance === 0 ? 0 : covariance / variance;
}

export function estimateMaintenance({
  dailyIntakes,
  weights,
  today,
  incompleteDays = [],
}: {
  dailyIntakes: readonly DatedValue[];
  weights: readonly DatedValue[];
  today: string;
  incompleteDays?: readonly string[];
}): MaintenanceEstimate {
  const fromDay = addDays(today, -adaptiveWindowDays);
  const toDay = addDays(today, -1);
  const inWindow = (point: DatedValue) => point.day >= fromDay && point.day <= toDay;

  const markedIncomplete = new Set(incompleteDays.filter((day) => day >= fromDay && day <= toDay));
  const excludedIncompleteDays = markedIncomplete.size;
  const intakes = dailyIntakes
    .filter(inWindow)
    .filter((intake) => intake.value >= partialDayKcal && !markedIncomplete.has(intake.day));
  const windowWeights = [...weights.filter((weight) => weight.day >= fromDay && weight.day <= today)].sort(
    (first, second) => first.day.localeCompare(second.day),
  );
  const weightSpanDays =
    windowWeights.length >= 2 ? daysBetween(windowWeights[0].day, windowWeights[windowWeights.length - 1].day) : 0;
  const loggedDays = intakes.length;

  if (loggedDays < requiredLoggedDays || weightSpanDays < requiredWeightSpanDays) {
    return { status: "insufficient", loggedDays, weightSpanDays, excludedIncompleteDays };
  }

  const averageIntakeKcal = intakes.reduce((sum, intake) => sum + intake.value, 0) / loggedDays;
  const slope = weightSlopePerDay(windowWeights);
  const maintenanceKcal = averageIntakeKcal - slope * kcalPerKilogramOfBodyWeight;

  if (maintenanceKcal < plausibleMaintenance.minimum || maintenanceKcal > plausibleMaintenance.maximum) {
    return { status: "implausible", loggedDays, weightSpanDays, excludedIncompleteDays };
  }

  return {
    status: "ready",
    maintenanceKcal: Math.round(maintenanceKcal / 10) * 10,
    averageIntakeKcal: Math.round(averageIntakeKcal),
    weeklyWeightChangeKg: Math.round(slope * 7 * 100) / 100,
    loggedDays,
    weightSpanDays,
    excludedIncompleteDays,
  };
}
