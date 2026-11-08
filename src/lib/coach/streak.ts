import { addDays } from "../nutrition/days";

export const streakMilestoneDays = 5;
export const minimumBrokenStreakDays = 3;
const lookbackDays = 400;

export type ProteinStreak = {
  days: number;
  startDay: string | null;
  todayReached: boolean;
  milestone: number | null;
  brokenDays: number | null;
};

function streakEndingOn(
  lastDay: string,
  proteinByDay: ReadonlyMap<string, number>,
  targetProteinG: number,
  skippedDays: ReadonlySet<string>,
) {
  let days = 0;
  let startDay: string | null = null;
  for (let day = lastDay, step = 0; step < lookbackDays; day = addDays(day, -1), step += 1) {
    if (skippedDays.has(day)) continue;
    if ((proteinByDay.get(day) ?? 0) < targetProteinG) break;
    days += 1;
    startDay = day;
  }
  return { days, startDay };
}

export function proteinStreak({
  today,
  dailyProtein,
  targetProteinG,
  incompleteDays = [],
}: {
  today: string;
  dailyProtein: readonly { day: string; protein: number }[];
  targetProteinG: number;
  incompleteDays?: readonly string[];
}): ProteinStreak {
  const proteinByDay = new Map(dailyProtein.map((entry) => [entry.day, entry.protein]));
  const skippedDays = new Set(incompleteDays.filter((day) => day < today));
  const todayReached = (proteinByDay.get(today) ?? 0) >= targetProteinG;
  const completed = streakEndingOn(addDays(today, -1), proteinByDay, targetProteinG, skippedDays);
  const days = completed.days + (todayReached ? 1 : 0);
  const startDay = completed.startDay ?? (todayReached ? today : null);

  let brokenDays: number | null = null;
  if (completed.days === 0) {
    let lastCountedDay = addDays(today, -1);
    while (skippedDays.has(lastCountedDay)) lastCountedDay = addDays(lastCountedDay, -1);
    const previous = streakEndingOn(addDays(lastCountedDay, -1), proteinByDay, targetProteinG, skippedDays);
    if (previous.days >= minimumBrokenStreakDays) brokenDays = previous.days;
  }

  return {
    days,
    startDay,
    todayReached,
    milestone: days > 0 && days % streakMilestoneDays === 0 ? days : null,
    brokenDays,
  };
}
