import { mealLabels, type MealType } from "@/lib/nutrition/meals";
import { type Nutrients, roundNutrients } from "@/lib/nutrition/nutrients";

export const claudeClientName = "Claude";

export const claudeRedirectUri = "https://claude.ai/api/mcp/auth_callback";

export const connectorInstructions = `Bilancia is the user's personal calorie tracker. The user speaks Italian: answer in Italian.
When the user tells you what they ate or drank:
1. Split the description into single foods. Call search_foods once per food with a short, generic Italian name (for example «pasta di semola», «parmigiano», «mela», «olio d'oliva»), or the product name for branded items.
2. Pick the best match. Prefer the user's own foods, favorites and foods with lastGrams, and recipes when the user names one of their dishes. Pay attention to raw versus cooked items.
3. Decide the quantity in grams: use the amount the user gave, a named portion of the food, lastGrams, or a typical Italian portion (a spoon of oil is 10 g, an apple 150 g, a plate of dry pasta 80 g).
4. Call log_meal once per meal with every item. Only when nothing in the catalog fits, use a quick item with your own estimate of kcal and macros, and a short Italian label.
5. Reply with a short summary of what you logged (quantities and kcal) and the kcal left for the day.
Days are ISO dates in the Europe/Rome time zone and default to today. Meals are breakfast (colazione), lunch (pranzo), dinner (cena) and snack (spuntini); when the user does not say which, log_meal picks one from the current time.
Ask before logging only when the description is really ambiguous. To fix a mistake, call get_day and then delete_entry, and log the item again.`;

type PortionOption = { label: string; grams: number };

export type FoodCandidate = {
  id: string;
  name: string;
  brand: string | null;
  unit: "g" | "ml";
  per100: Nutrients;
  portions: PortionOption[];
  lastGrams: number | null;
  isFavorite: boolean;
  isOwn: boolean;
};

export type RecipeCandidate = {
  id: string;
  name: string;
  per100: Nutrients;
  perServing: Nutrients;
  servings: number;
  finalWeightG: number;
};

function roundOne(value: number) {
  return Math.round(value * 10) / 10;
}

export function describeFoodCandidate(candidate: FoodCandidate) {
  return {
    foodId: candidate.id,
    name: candidate.brand ? `${candidate.name}, ${candidate.brand}` : candidate.name,
    unit: candidate.unit,
    per100: roundNutrients(candidate.per100),
    portions: candidate.portions.map((portion) => ({ label: portion.label, grams: roundOne(portion.grams) })),
    lastGrams: candidate.lastGrams === null ? null : roundOne(candidate.lastGrams),
    favorite: candidate.isFavorite,
    own: candidate.isOwn,
  };
}

export function describeRecipeCandidate(candidate: RecipeCandidate) {
  return {
    recipeId: candidate.id,
    name: candidate.name,
    servings: candidate.servings,
    cookedWeightG: Math.round(candidate.finalWeightG),
    per100: roundNutrients(candidate.per100),
    perServing: roundNutrients(candidate.perServing),
  };
}

type DiaryEntrySummary = {
  id: string;
  meal: MealType;
  label: string;
  grams: number | null;
  servings: number | null;
  portionLabel: string | null;
  nutrients: Nutrients;
};

type DiaryDaySummary = {
  meals: { meal: MealType; entries: DiaryEntrySummary[]; totals: Nutrients }[];
  totals: Nutrients;
};

type DailyTargets = { kcal: number; proteinG: number; carbsG: number; fatG: number } | null;

export function describeEntry(entry: DiaryEntrySummary) {
  return {
    entryId: entry.id,
    label: entry.label,
    grams: entry.grams === null ? null : roundOne(entry.grams),
    servings: entry.servings,
    portion: entry.portionLabel,
    ...roundNutrients(entry.nutrients),
  };
}

export function describeDay(day: string, diary: DiaryDaySummary, targets: DailyTargets) {
  const totals = roundNutrients(diary.totals);
  return {
    day,
    meals: diary.meals.map((meal) => ({
      meal: meal.meal,
      label: mealLabels[meal.meal],
      entries: meal.entries.map(describeEntry),
      totals: roundNutrients(meal.totals),
    })),
    totals,
    targets: targets
      ? { kcal: targets.kcal, protein: targets.proteinG, carbs: targets.carbsG, fat: targets.fatG }
      : null,
    remainingKcal: targets ? targets.kcal - totals.kcal : null,
  };
}
