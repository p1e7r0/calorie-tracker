import {
  adaptiveWindowDays,
  partialDayKcal,
  type MaintenanceEstimate,
  requiredLoggedDays,
  requiredWeightSpanDays,
} from "@/lib/nutrition/adaptive";
import { addDays } from "@/lib/nutrition/days";
import { mealLabels, type MealType } from "@/lib/nutrition/meals";
import { type Nutrients, roundNutrients, sumNutrients } from "@/lib/nutrition/nutrients";
import { changeOverDays, type DatedValue, lastValuePerDay, movingAverage } from "@/lib/nutrition/trends";
import { weeklyBudget } from "@/lib/nutrition/weekly-budget";

export const claudeClientName = "Claude";

export const claudeRedirectUri = "https://claude.ai/api/mcp/auth_callback";

export const connectorInstructions = `Bilancia is the user's personal calorie tracker. The user speaks Italian: answer in Italian.
When the user tells you what they ate or drank:
1. Split the description into single foods. Call search_foods once per food with a short, generic Italian name (for example «pasta di semola», «parmigiano», «mela», «olio d'oliva»), or the product name for branded items. It also returns the user's recipes and saved meals.
2. Pick the best match. Prefer the user's own foods, favorites and foods with lastGrams, recipes when the user names one of their dishes, and saved meals for «the usual» meal. Pay attention to raw versus cooked items.
3. Decide the quantity in grams: use the amount the user gave, a named portion of the food, lastGrams, or a typical Italian portion (a spoon of oil is 10 g, an apple 150 g, a plate of dry pasta 80 g).
4. Call log_meal once per meal with every item. A saved meal is a single item that logs all of its foods. Only when nothing in the catalog fits, use a quick item with your own estimate of kcal and macros, and a short Italian label.
5. Reply with a short summary of what you logged (quantities and kcal) and the kcal left for the day.
Foods and recipes you create stay in the user's catalog and are reused for every future log, so their values must be real:
- For a packaged product with a barcode, call lookup_barcode first: it finds the product in the catalog or imports it from Open Food Facts.
- Call create_food only with values the user gives you (numbers or a photo of the nutrition label), or when the user explicitly asks you to save your own estimate. Values are per 100 g (or 100 ml), as on the label. Search first to avoid duplicates. Otherwise log a quick item. Tell the user about any warning in the result.
- For create_recipe, search every ingredient as a raw item and use raw weights. Ask the user for the cooked weight of the whole dish: without it the values per 100 g refer to the raw weight, and the recipe can be logged reliably only by servings.
Call log_weight when the user tells you their weight. For questions about how the user is doing, call get_progress: it returns daily totals, averages, the weekly budget, the weight trend and the adaptive estimate of maintenance kcal. Do not read a trend into less than a week of data.
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
  hasCookedWeight: boolean;
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
    cookedWeightG: candidate.hasCookedWeight ? Math.round(candidate.finalWeightG) : null,
    rawWeightG: candidate.hasCookedWeight ? null : Math.round(candidate.finalWeightG),
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

export type SavedMealCandidate = {
  id: string;
  name: string;
  defaultMeal: MealType | null;
  items: { name: string; grams: number | null; servings: number | null }[];
  totals: Nutrients;
};

export function describeSavedMeal(candidate: SavedMealCandidate) {
  return {
    savedMealId: candidate.id,
    name: candidate.name,
    meal: candidate.defaultMeal,
    items: candidate.items.map((item) => ({
      name: item.name,
      grams: item.grams === null ? null : roundOne(item.grams),
      servings: item.servings,
    })),
    ...roundNutrients(candidate.totals),
  };
}

function roundTwo(value: number) {
  return Math.round(value * 100) / 100;
}

function describeChange(change: ReturnType<typeof changeOverDays>) {
  return change ? { kg: roundTwo(change.change), sinceDay: change.fromDay } : null;
}

export function describeWeightTrend(weights: readonly DatedValue[]) {
  const daily = lastValuePerDay(weights);
  const latest = daily.at(-1);
  if (!latest) return null;
  return {
    latest: { day: latest.day, kg: roundOne(latest.value) },
    sevenDayAverageKg: roundOne(movingAverage(daily).at(-1)!.value),
    change7Days: describeChange(changeOverDays(daily, 7)),
    change30Days: describeChange(changeOverDays(daily, 30)),
  };
}

type DayTotals = Nutrients & { day: string };

export function describeProgress({
  today,
  days,
  dailyTotals,
  targets,
  weights,
  maintenance,
  suggestedTargetKcal,
}: {
  today: string;
  days: number;
  dailyTotals: readonly DayTotals[];
  targets: DailyTargets;
  weights: readonly DatedValue[];
  maintenance: MaintenanceEstimate;
  suggestedTargetKcal: number | null;
}) {
  const fromDay = addDays(today, -(days - 1));
  const inPeriod = dailyTotals.filter((totals) => totals.day >= fromDay && totals.day <= today);
  const completeDays = inPeriod.filter((totals) => totals.day < today && totals.kcal >= partialDayKcal);
  const completeTotals = sumNutrients(completeDays);
  const average =
    completeDays.length > 0
      ? roundNutrients({
          kcal: completeTotals.kcal / completeDays.length,
          protein: completeTotals.protein / completeDays.length,
          carbs: completeTotals.carbs / completeDays.length,
          fat: completeTotals.fat / completeDays.length,
        })
      : null;
  const week = targets ? weeklyBudget({ day: today, targetKcal: targets.kcal, dailyKcal: dailyTotals }) : null;

  return {
    fromDay,
    toDay: today,
    days: inPeriod.map((totals) => ({ day: totals.day, ...roundNutrients(totals) })),
    average: average && { ...average, overDays: completeDays.length },
    note: `Average over the logged days before today with at least ${partialDayKcal} kcal; days without entries are missing from the list.`,
    targets: targets
      ? { kcal: targets.kcal, protein: targets.proteinG, carbs: targets.carbsG, fat: targets.fatG }
      : null,
    week: week && {
      weekStart: week.weekStart,
      budgetKcal: week.budgetKcal,
      eatenKcal: Math.round(week.eatenKcal),
      remainingKcal: Math.round(week.remainingKcal),
      daysLeft: week.daysLeft,
      suggestedTodayKcal: week.suggestedTodayKcal,
      note: "Past days of the week without entries count as on target.",
    },
    weight: {
      trend: describeWeightTrend(weights),
      inPeriod: lastValuePerDay(weights)
        .filter((weight) => weight.day >= fromDay && weight.day <= today)
        .map((weight) => ({ day: weight.day, kg: roundOne(weight.value) })),
    },
    maintenance:
      maintenance.status === "ready"
        ? {
            status: maintenance.status,
            maintenanceKcal: maintenance.maintenanceKcal,
            averageIntakeKcal: maintenance.averageIntakeKcal,
            weeklyWeightChangeKg: maintenance.weeklyWeightChangeKg,
            suggestedTargetKcal,
          }
        : {
            status: maintenance.status,
            loggedDays: maintenance.loggedDays,
            weightSpanDays: maintenance.weightSpanDays,
            note: `Needs ${requiredLoggedDays} logged days and weigh-ins spanning ${requiredWeightSpanDays} days within the last ${adaptiveWindowDays} days.`,
          },
  };
}
