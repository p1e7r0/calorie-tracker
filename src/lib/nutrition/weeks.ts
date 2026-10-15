import { addDays } from "./days";

export function weekStart(isoDate: string) {
  const weekday = new Date(`${isoDate}T12:00:00Z`).getUTCDay();
  const offsetFromMonday = (weekday + 6) % 7;
  return addDays(isoDate, -offsetFromMonday);
}

export function averageByWeek<T extends { day: string }>(items: readonly T[], read: (item: T) => number) {
  const groups = new Map<string, number[]>();
  for (const item of items) {
    const key = weekStart(item.day);
    groups.set(key, [...(groups.get(key) ?? []), read(item)]);
  }
  return [...groups.entries()]
    .sort(([first], [second]) => first.localeCompare(second))
    .map(([week, values]) => ({
      week,
      average: values.reduce((sum, value) => sum + value, 0) / values.length,
      count: values.length,
    }));
}
