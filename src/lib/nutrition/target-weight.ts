import { requiredWeightSpanDays, weightSlopePerDay } from "./adaptive";
import { addDays, daysBetween, formatDayWithArticle } from "./days";
import { formatDecimal, formatSignedDecimal } from "./format";
import type { GoalType } from "./goals";
import { type DatedValue, lastValuePerDay, movingAverage } from "./trends";

export const targetWeightBounds = { minimum: 30, maximum: 300 };
export const observedRateWindowDays = 28;
const requiredObservedWeighIns = 3;
const reachedToleranceKg = 0.1;
const stalledWeeklyRateKg = 0.05;

export type PlannedRateReason = "not-enough-data" | "stalled" | "moving-away";

export type TargetWeightProjection =
  | { status: "maintain"; targetKg: number }
  | { status: "no-data"; targetKg: number }
  | { status: "reached"; targetKg: number; currentKg: number }
  | {
      status: "projected";
      targetKg: number;
      currentKg: number;
      remainingKg: number;
      weeklyChangeKg: number;
      rateSource: "observed" | "planned";
      plannedReason: PlannedRateReason | null;
      observedWeeklyChangeKg: number | null;
      expectedDay: string;
    };

export function observedWeeklyChange(weights: readonly DatedValue[], today: string) {
  const fromDay = addDays(today, -observedRateWindowDays);
  const recent = lastValuePerDay(weights.filter((weight) => weight.day >= fromDay && weight.day <= today));
  if (recent.length < requiredObservedWeighIns) return null;
  if (daysBetween(recent[0].day, recent[recent.length - 1].day) < requiredWeightSpanDays) return null;
  return weightSlopePerDay(recent) * 7;
}

export function projectTargetWeight({
  weights,
  today,
  goal,
  plannedWeeklyRateKg,
  targetKg,
}: {
  weights: readonly DatedValue[];
  today: string;
  goal: GoalType;
  plannedWeeklyRateKg: number;
  targetKg: number;
}): TargetWeightProjection {
  if (goal === "maintain") return { status: "maintain", targetKg };
  const trend = movingAverage(lastValuePerDay(weights.filter((weight) => weight.day <= today))).at(-1);
  if (!trend) return { status: "no-data", targetKg };

  const currentKg = trend.value;
  const direction = goal === "lose" ? -1 : 1;
  const remainingKg = (targetKg - currentKg) * direction;
  if (remainingKg < reachedToleranceKg) return { status: "reached", targetKg, currentKg };

  const observedWeeklyChangeKg = observedWeeklyChange(weights, today);
  const observedTowardTarget = observedWeeklyChangeKg === null ? null : observedWeeklyChangeKg * direction;
  const plannedReason: PlannedRateReason | null =
    observedTowardTarget === null
      ? "not-enough-data"
      : observedTowardTarget <= -stalledWeeklyRateKg
        ? "moving-away"
        : observedTowardTarget < stalledWeeklyRateKg
          ? "stalled"
          : null;
  const weeklyRateTowardTarget = plannedReason === null ? observedTowardTarget! : Math.abs(plannedWeeklyRateKg);
  const weeksLeft = remainingKg / weeklyRateTowardTarget;

  return {
    status: "projected",
    targetKg,
    currentKg,
    remainingKg,
    weeklyChangeKg: weeklyRateTowardTarget * direction,
    rateSource: plannedReason === null ? "observed" : "planned",
    plannedReason,
    observedWeeklyChangeKg,
    expectedDay: addDays(today, Math.ceil(weeksLeft * 7)),
  };
}

const plannedRateFormatter = new Intl.NumberFormat("it-IT", { maximumFractionDigits: 2 });

function formatWeeklyChange(value: number, precise: boolean) {
  if (!precise) return `${formatSignedDecimal(value)} kg a settimana`;
  const sign = value > 0 ? "+" : value < 0 ? "−" : "";
  return `${sign}${plannedRateFormatter.format(Math.abs(value))} kg a settimana`;
}

export function describeTargetWeightProjection(projection: TargetWeightProjection, today: string) {
  const target = `${formatDecimal(projection.targetKg)} kg`;
  if (projection.status === "maintain") return `Peso obiettivo ${target}.`;
  if (projection.status === "no-data") {
    return `Peso obiettivo ${target}. Aggiungi una misurazione per sapere quanto ti manca.`;
  }
  if (projection.status === "reached") return `Hai raggiunto il peso obiettivo di ${target}.`;

  const remainingKg = formatDecimal(projection.remainingKg);
  const remaining = `${remainingKg === "1" ? "Ti manca" : "Ti mancano"} ${remainingKg} kg.`;
  const expected = formatDayWithArticle(projection.expectedDay, today);
  if (projection.rateSource === "observed") {
    return `${remaining} Al ritmo attuale (${formatWeeklyChange(projection.weeklyChangeKg, false)}) arrivi a ${target} verso ${expected}.`;
  }
  const planned = `al ritmo che hai scelto (${formatWeeklyChange(projection.weeklyChangeKg, true)}) arriveresti a ${target} verso ${expected}`;
  if (projection.plannedReason === "moving-away") {
    const observed = formatSignedDecimal(projection.observedWeeklyChangeKg ?? 0);
    return `${remaining} Nelle ultime settimane il peso si allontana dall'obiettivo (${observed} kg a settimana): ${planned}.`;
  }
  if (projection.plannedReason === "stalled") {
    return `${remaining} Nelle ultime settimane il peso è stabile: ${planned}.`;
  }
  return `${remaining} Servono più pesate per conoscere il tuo ritmo reale: ${planned}.`;
}
