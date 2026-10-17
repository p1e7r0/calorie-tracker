import { estimateMaintenance } from "./adaptive";
import { addDays } from "./days";
import { weekStart } from "./weeks";

type DatedValue = { day: string; value: number };

export type WeeklySummary = {
  weekStart: string;
  loggedDays: number;
  averageKcal: number;
  averageProteinG: number;
};

export function previousWeekSummary(
  dailyTotals: readonly { day: string; kcal: number; protein: number }[],
  today: string,
): WeeklySummary | null {
  const fromDay = addDays(weekStart(today), -7);
  const toDay = addDays(weekStart(today), -1);
  const loggedTotals = dailyTotals.filter((totals) => totals.day >= fromDay && totals.day <= toDay && totals.kcal > 0);
  if (loggedTotals.length === 0) return null;
  return {
    weekStart: fromDay,
    loggedDays: loggedTotals.length,
    averageKcal: loggedTotals.reduce((sum, totals) => sum + totals.kcal, 0) / loggedTotals.length,
    averageProteinG: loggedTotals.reduce((sum, totals) => sum + totals.protein, 0) / loggedTotals.length,
  };
}

export function isCheckInDue({ today, lastCheckInWeek }: { today: string; lastCheckInWeek: string | null }) {
  return lastCheckInWeek !== weekStart(today);
}

export function maintenanceHistory({
  dailyIntakes,
  weights,
  today,
  weeks,
}: {
  dailyIntakes: readonly DatedValue[];
  weights: readonly DatedValue[];
  today: string;
  weeks: number;
}) {
  const currentWeek = weekStart(today);
  return Array.from({ length: weeks }, (_, index) => {
    const day = index === weeks - 1 ? today : addDays(currentWeek, -7 * (weeks - 1 - index));
    const estimate = estimateMaintenance({ dailyIntakes, weights, today: day });
    return { day, maintenanceKcal: estimate.status === "ready" ? estimate.maintenanceKcal : null };
  });
}
