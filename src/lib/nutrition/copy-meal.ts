import { addDays } from "./days";
import type { MealType } from "./meals";

export function entryCountLabel(count: number) {
  return count === 1 ? "1 voce" : `${count} voci`;
}

export function copiedEntriesLabel(count: number) {
  return count === 1 ? "1 voce copiata" : `${count} voci copiate`;
}

export function defaultCopySourceDay(day: string, today: string) {
  const previousDay = addDays(day, -1);
  return previousDay > today ? today : previousDay;
}

export type MealCopy = { fromDay: string; fromMeal: MealType; toDay: string; toMeal: MealType };

export function isCopyOntoItself({ fromDay, fromMeal, toDay, toMeal }: MealCopy) {
  return fromDay === toDay && fromMeal === toMeal;
}
