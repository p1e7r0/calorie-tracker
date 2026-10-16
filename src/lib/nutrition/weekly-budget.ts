import { addDays, daysBetween } from "./days";
import { weekStart } from "./weeks";

export type WeeklyBudget = {
  weekStart: string;
  budgetKcal: number;
  eatenKcal: number;
  remainingKcal: number;
  daysLeft: number;
  suggestedTodayKcal: number;
};

export function weeklyBudget({
  day,
  targetKcal,
  dailyKcal,
}: {
  day: string;
  targetKcal: number;
  dailyKcal: readonly { day: string; kcal: number }[];
}): WeeklyBudget {
  const start = weekStart(day);
  const end = addDays(start, 6);
  const inWeek = dailyKcal.filter((entry) => entry.day >= start && entry.day <= end);
  const eatenKcal = inWeek.reduce((sum, entry) => sum + entry.kcal, 0);
  const eatenBeforeDay = inWeek.filter((entry) => entry.day < day).reduce((sum, entry) => sum + entry.kcal, 0);
  const budgetKcal = targetKcal * 7;
  const daysLeft = daysBetween(day, end) + 1;
  return {
    weekStart: start,
    budgetKcal,
    eatenKcal,
    remainingKcal: budgetKcal - eatenKcal,
    daysLeft,
    suggestedTodayKcal: Math.max(0, Math.round((budgetKcal - eatenBeforeDay) / daysLeft / 10) * 10),
  };
}
