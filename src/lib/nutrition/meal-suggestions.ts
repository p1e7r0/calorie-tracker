import { daysBetween } from "./days";
import { mealTypes, type MealType } from "./meals";

export type PastUse = { itemKey: string; day: string; meal: MealType };

export const suggestionWindowDays = 60;
const halfLifeDays = 14;
const otherMealWeight = 0.3;

export function rankMealSuggestions(uses: PastUse[], today: string, limit = 15): Record<MealType, string[]> {
  const scores = new Map<string, { byMeal: Record<MealType, number>; lastDay: string }>();
  for (const use of uses) {
    const age = daysBetween(use.day, today);
    if (age < 0 || age > suggestionWindowDays) continue;
    const recency = 0.5 ** (age / halfLifeDays);
    const current = scores.get(use.itemKey) ?? {
      byMeal: { breakfast: 0, lunch: 0, dinner: 0, snack: 0 },
      lastDay: use.day,
    };
    for (const meal of mealTypes) {
      current.byMeal[meal] += recency * (meal === use.meal ? 1 : otherMealWeight);
    }
    if (use.day > current.lastDay) current.lastDay = use.day;
    scores.set(use.itemKey, current);
  }

  const ranked = {} as Record<MealType, string[]>;
  for (const meal of mealTypes) {
    ranked[meal] = [...scores.entries()]
      .sort(
        ([firstKey, first], [secondKey, second]) =>
          second.byMeal[meal] - first.byMeal[meal] ||
          second.lastDay.localeCompare(first.lastDay) ||
          firstKey.localeCompare(secondKey),
      )
      .slice(0, limit)
      .map(([itemKey]) => itemKey);
  }
  return ranked;
}
