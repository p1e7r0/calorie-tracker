import { partialDayKcal } from "../nutrition/adaptive";
import { addDays } from "../nutrition/days";

export const rechargeMinimumKcal = 300;
export const rechargeBankStartDay = "2026-11-16";

export const rechargeOutcomes = ["used", "declined"] as const;
export type RechargeOutcome = (typeof rechargeOutcomes)[number];

export type RechargeEvent = { day: string; outcome: RechargeOutcome; bonusKcal: number };

export type RechargeStatus = "locked" | "unlocked" | "postponed" | "active" | "declined";

export type RechargeState = {
  status: RechargeStatus;
  sinceDay: string;
  bankedKcal: number;
  missingKcal: number;
  bonusKcal: number;
  dayKcal: number;
};

export function rechargeState({
  day,
  targetKcal,
  dailyKcal,
  incompleteDays = [],
  events,
  postponedOn = null,
}: {
  day: string;
  targetKcal: number;
  dailyKcal: readonly { day: string; kcal: number }[];
  incompleteDays?: readonly string[];
  events: readonly RechargeEvent[];
  postponedOn?: string | null;
}): RechargeState {
  const todayEvent = events.find((event) => event.day === day) ?? null;
  if (todayEvent) {
    const bonusKcal = todayEvent.outcome === "used" ? todayEvent.bonusKcal : 0;
    return {
      status: todayEvent.outcome === "used" ? "active" : "declined",
      sinceDay: day,
      bankedKcal: bonusKcal,
      missingKcal: 0,
      bonusKcal,
      dayKcal: targetKcal + bonusKcal,
    };
  }
  const lastEvent = events
    .filter((event) => event.day < day)
    .reduce<RechargeEvent | null>((latest, event) => (latest && latest.day > event.day ? latest : event), null);
  const sinceDay = lastEvent && lastEvent.day >= rechargeBankStartDay ? lastEvent.day : rechargeBankStartDay;
  const kcalByDay = new Map(dailyKcal.map((entry) => [entry.day, entry.kcal]));
  const markedIncomplete = new Set(incompleteDays);
  let bankedKcal = 0;
  for (let current = sinceDay; current < day; current = addDays(current, 1)) {
    const eaten = kcalByDay.get(current);
    if (eaten === undefined || eaten < partialDayKcal || markedIncomplete.has(current)) continue;
    const bonus = lastEvent && current === lastEvent.day && lastEvent.outcome === "used" ? lastEvent.bonusKcal : 0;
    bankedKcal += targetKcal + bonus - eaten;
  }
  bankedKcal = Math.round(bankedKcal);
  const missingKcal = Math.max(0, rechargeMinimumKcal - bankedKcal);
  const status: RechargeStatus = missingKcal > 0 ? "locked" : postponedOn === day ? "postponed" : "unlocked";
  return {
    status,
    sinceDay,
    bankedKcal,
    missingKcal,
    bonusKcal: 0,
    dayKcal: targetKcal + Math.max(0, bankedKcal),
  };
}

export function isRechargeAvailable(state: RechargeState) {
  return state.status === "unlocked" || state.status === "postponed";
}

export function rechargeAllowanceKcal(state: RechargeState, targetKcal: number) {
  return state.status === "active" || isRechargeAvailable(state) ? state.dayKcal : targetKcal;
}

export function dayTargetKcal(state: RechargeState, targetKcal: number) {
  return state.status === "active" ? state.dayKcal : targetKcal;
}
