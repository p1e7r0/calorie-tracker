import { addDays, daysBetween } from "./days";

export type DatedValue = { day: string; value: number };

export function lastValuePerDay(points: readonly DatedValue[]): DatedValue[] {
  const byDay = new Map<string, number>();
  for (const point of points) byDay.set(point.day, point.value);
  return [...byDay.entries()]
    .map(([day, value]) => ({ day, value }))
    .sort((first, second) => first.day.localeCompare(second.day));
}

export function movingAverage(points: readonly DatedValue[], windowDays = 7): DatedValue[] {
  const sorted = [...points].sort((first, second) => first.day.localeCompare(second.day));
  return sorted.map((point) => {
    const windowStart = addDays(point.day, -(windowDays - 1));
    const inWindow = sorted.filter((candidate) => candidate.day >= windowStart && candidate.day <= point.day);
    const total = inWindow.reduce((sum, candidate) => sum + candidate.value, 0);
    return { day: point.day, value: total / inWindow.length };
  });
}

export function changeOverDays(points: readonly DatedValue[], days: number) {
  const sorted = [...points].sort((first, second) => first.day.localeCompare(second.day));
  const latest = sorted.at(-1);
  if (!latest) return null;
  const reference =
    [...sorted].reverse().find((point) => daysBetween(point.day, latest.day) >= days) ?? sorted[0];
  if (reference.day === latest.day) return null;
  return { change: latest.value - reference.value, fromDay: reference.day };
}

export function dailySeries(fromDay: string, toDay: string) {
  const days: string[] = [];
  for (let day = fromDay; day <= toDay; day = addDays(day, 1)) days.push(day);
  return days;
}
