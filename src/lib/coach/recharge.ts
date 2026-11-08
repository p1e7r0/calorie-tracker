import { addDays } from "../nutrition/days";
import { weeklyBudget } from "../nutrition/weekly-budget";
import { weekStart } from "../nutrition/weeks";

export const rechargeDayKcal = 2000;

export type RechargeStatus = "locked" | "unlocked" | "active" | "used";

export type RechargeState = {
  status: RechargeStatus;
  dayKcal: number;
  rechargeDay: string | null;
  bankedKcal: number;
  missingKcal: number;
};

export function rechargeState({
  day,
  targetKcal,
  dailyKcal,
  incompleteDays = [],
  rechargeDays,
}: {
  day: string;
  targetKcal: number;
  dailyKcal: readonly { day: string; kcal: number }[];
  incompleteDays?: readonly string[];
  rechargeDays: readonly string[];
}): RechargeState {
  const start = weekStart(day);
  const end = addDays(start, 6);
  const rechargeDay = rechargeDays.find((candidate) => candidate >= start && candidate <= end) ?? null;
  const beforeDay = weeklyBudget({
    day,
    targetKcal,
    dailyKcal: dailyKcal.filter((entry) => entry.day < day),
    incompleteDays: incompleteDays.filter((incompleteDay) => incompleteDay < day),
  });
  const pastDays = 7 - beforeDay.daysLeft;
  const bankedKcal = Math.round(targetKcal * pastDays - beforeDay.eatenKcal);
  const extraKcal = rechargeDayKcal - targetKcal;
  const missingKcal = Math.max(0, Math.round(extraKcal - bankedKcal));
  const status: RechargeStatus =
    rechargeDay === day ? "active" : rechargeDay !== null ? "used" : missingKcal === 0 ? "unlocked" : "locked";
  return { status, dayKcal: rechargeDayKcal, rechargeDay, bankedKcal, missingKcal };
}

export function rechargeAllowanceKcal(state: RechargeState, targetKcal: number) {
  return state.status === "active" || state.status === "unlocked" ? Math.max(targetKcal, state.dayKcal) : targetKcal;
}

export function dayTargetKcal(state: RechargeState, targetKcal: number) {
  return state.status === "active" ? Math.max(targetKcal, state.dayKcal) : targetKcal;
}
