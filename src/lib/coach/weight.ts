import { addDays, daysBetween } from "../nutrition/days";
import { projectTargetWeight } from "../nutrition/target-weight";
import { type DatedValue, lastValuePerDay } from "../nutrition/trends";

export const waterSpikeKg = 0.5;
const stableTrendKg = 0.1;

export type WeightTrendDirection = "down" | "stable" | "up";
export type ArrivalReason = "observed" | "not-enough-data" | "stalled" | "moving-away" | "reached" | "no-data";

export type CoachWeight = {
  lastWeighIn: { day: string; kg: number } | null;
  changeFromPrevious: { kg: number; previousDay: string } | null;
  average7Kg: number | null;
  weeklyTrendKg: number | null;
  trend: WeightTrendDirection | null;
  likelyWater: boolean;
  target: {
    kg: number;
    arrivalDay: string | null;
    reason: ArrivalReason;
    shiftDays: number | null;
  } | null;
};

function average(points: readonly DatedValue[]) {
  if (points.length === 0) return null;
  return points.reduce((sum, point) => sum + point.value, 0) / points.length;
}

function between(points: readonly DatedValue[], fromDay: string, toDay: string) {
  return points.filter((point) => point.day >= fromDay && point.day <= toDay);
}

export function coachWeight({
  weights,
  today,
  targetKg,
  plannedWeeklyRateKg,
  previousArrivalDay,
}: {
  weights: readonly DatedValue[];
  today: string;
  targetKg: number | null;
  plannedWeeklyRateKg: number;
  previousArrivalDay: string | null;
}): CoachWeight {
  const daily = lastValuePerDay(weights.filter((weight) => weight.day <= today));
  const last = daily.at(-1) ?? null;
  const previous = daily.at(-2) ?? null;
  const average7Kg = last ? average(between(daily, addDays(last.day, -6), last.day)) : null;
  const previousAverage = last ? average(between(daily, addDays(last.day, -13), addDays(last.day, -7))) : null;
  const weeklyTrendKg = average7Kg !== null && previousAverage !== null ? average7Kg - previousAverage : null;
  const trend: WeightTrendDirection | null =
    weeklyTrendKg === null
      ? null
      : weeklyTrendKg <= -stableTrendKg
        ? "down"
        : weeklyTrendKg >= stableTrendKg
          ? "up"
          : "stable";
  const changeFromPrevious = last && previous ? { kg: last.value - previous.value, previousDay: previous.day } : null;
  const likelyWater =
    changeFromPrevious !== null && changeFromPrevious.kg >= waterSpikeKg - 1e-9 && trend !== null && trend !== "up";

  return {
    lastWeighIn: last ? { day: last.day, kg: last.value } : null,
    changeFromPrevious,
    average7Kg,
    weeklyTrendKg,
    trend,
    likelyWater,
    target: targetKg === null ? null : arrival({ daily, today, targetKg, plannedWeeklyRateKg, previousArrivalDay }),
  };
}

function arrival({
  daily,
  today,
  targetKg,
  plannedWeeklyRateKg,
  previousArrivalDay,
}: {
  daily: readonly DatedValue[];
  today: string;
  targetKg: number;
  plannedWeeklyRateKg: number;
  previousArrivalDay: string | null;
}): NonNullable<CoachWeight["target"]> {
  const currentKg = daily.at(-1)?.value;
  if (currentKg === undefined) return { kg: targetKg, arrivalDay: null, reason: "no-data", shiftDays: null };
  const projection = projectTargetWeight({
    weights: daily,
    today,
    goal: targetKg < currentKg ? "lose" : "gain",
    plannedWeeklyRateKg,
    targetKg,
  });
  if (projection.status === "reached") return { kg: targetKg, arrivalDay: null, reason: "reached", shiftDays: null };
  if (projection.status !== "projected") return { kg: targetKg, arrivalDay: null, reason: "no-data", shiftDays: null };
  if (projection.rateSource !== "observed") {
    return { kg: targetKg, arrivalDay: null, reason: projection.plannedReason ?? "not-enough-data", shiftDays: null };
  }
  return {
    kg: targetKg,
    arrivalDay: projection.expectedDay,
    reason: "observed",
    shiftDays: previousArrivalDay ? daysBetween(previousArrivalDay, projection.expectedDay) : null,
  };
}
