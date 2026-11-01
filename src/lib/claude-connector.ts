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
import { isStoredMealOld, type StorageLocation, storedMealAgeDays } from "@/lib/nutrition/stored-meals";
import { changeOverDays, type DatedValue, lastValuePerDay, movingAverage } from "@/lib/nutrition/trends";
import { weeklyBudget } from "@/lib/nutrition/weekly-budget";

export const claudeClientName = "Claude";

export const claudeRedirectUri = "https://claude.ai/api/mcp/auth_callback";

export const connectorInstructions = `Bilancia is the user's personal calorie tracker. The user speaks Italian: answer in Italian.
When the user tells you what they ate or drank:
1. Split the description into single foods. Call search_foods once per food with a short, generic Italian name (for example «pasta di semola», «parmigiano», «mela», «olio d'oliva»), or the product name for branded items. It also returns the user's recipes, saved meals and stored meals.
2. Pick the best match. Prefer stored meals when the user says they ate something from the fridge or freezer («la lasagna del freezer»), the user's own foods, favorites and foods with lastGrams, recipes when the user names one of their dishes, and saved meals for «the usual» meal. Pay attention to raw versus cooked items.
3. Decide the quantity in grams: use the amount the user gave, a named portion of the food, lastGrams, or a typical Italian portion (a spoon of oil is 10 g, an apple 150 g, a plate of dry pasta 80 g).
4. Call log_meal once per meal with every item. A saved meal is a single item that logs all of its foods; a stored meal is a single item that logs one portion and removes it from the fridge or freezer. Only when nothing in the catalog fits, use a quick item with your own estimate of kcal and macros, and a short Italian label.
5. Reply with a short summary of what you logged (quantities and kcal) and the kcal left for the day.
Foods and recipes you create stay in the user's catalog and are reused for every future log, so their values must be real:
- For a packaged product with a barcode, call lookup_barcode first: it finds the product in the catalog or imports it from Open Food Facts.
- Call create_food only with values the user gives you (numbers or a photo of the nutrition label), or when the user explicitly asks you to save your own estimate. Values are per 100 g (or 100 ml), as on the label. Search first to avoid duplicates. Otherwise log a quick item. Tell the user about any warning in the result.
- For create_recipe, search every ingredient as a raw item and use raw weights. Ask the user for the cooked weight of the whole dish: without it the values per 100 g refer to the raw weight, and the recipe can be logged reliably only by servings. When the user gives the weight of one serving instead of the number of servings, pass servingGrams: one serving then always weighs that much and the number of servings follows from the cooked weight.
When the user ate the same as another day or meal («come ieri a pranzo»), call copy_meal instead of searching the foods again.
Call log_weight when the user tells you their weight. For questions about how the user is doing, call get_progress: it returns daily totals, averages, the weekly budget, the weight trend and the adaptive estimate of maintenance kcal. Do not read a trend into less than a week of data.
Days are ISO dates in the Europe/Rome time zone and default to today. Meals are breakfast (colazione), lunch (pranzo), dinner (cena) and snack (spuntini); when the user does not say which, log_meal picks one from the current time.
Ask before logging only when the description is really ambiguous.
You can also change almost everything the user can change in the app:
- Diary: update_entry moves an entry to another meal or changes its quantity; delete_entry removes entries; set_incomplete_day marks a day the user did not log completely.
- Foods and recipes: read them with get_food or get_recipe, then change them with update_food or update_recipe, passing only the fields to change. A changed food of the global catalog becomes the user's own copy with a new foodId. delete_food and delete_recipe remove them from the catalog; set_favorite adds or removes favorites. Past diary entries keep the values they were logged with.
- Saved meals: save_meal saves a logged meal, update_saved_meal renames it or removes items, delete_saved_meal deletes it.
- Stored meals are portions the user cooked and put in the fridge or freezer to eat later. store_meal stores them, from the foods and recipes of one portion or from a logged meal; update_stored_meal changes the name, place, preparation date, portions left or items; delete_stored_meal removes a meal the user threw away. When checkBeforeEating is true, tell the user how long it has been stored.
- Measurements: list_measurements, update_measurement and delete_measurement fix weigh-ins.
- Profile: get_profile reads goals and daily targets; update_profile changes them; apply_suggested_targets applies the adaptive suggestion of get_progress.
Change or delete something only when the user asks for it, and say what you changed. Deleting is final for diary entries, saved meals, stored meals and measurements; for foods and recipes it hides them from the catalog.`;

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
  servingWeightG: number;
  hasCookedWeight: boolean;
  hasServingWeight: boolean;
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
    servings: roundOne(candidate.servings),
    servingGrams: candidate.hasServingWeight ? roundOne(candidate.servingWeightG) : null,
    cookedWeightG: candidate.hasCookedWeight ? Math.round(candidate.finalWeightG) : null,
    rawWeightG: candidate.hasCookedWeight ? null : Math.round(candidate.finalWeightG),
    per100: roundNutrients(candidate.per100),
    perServing: roundNutrients(candidate.perServing),
  };
}

type DiaryEntrySummary = {
  id: string;
  meal: MealType;
  kind: "food" | "recipe" | "quick";
  foodId: string | null;
  recipeId: string | null;
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
    type: entry.kind,
    ...(entry.foodId ? { foodId: entry.foodId } : {}),
    ...(entry.recipeId ? { recipeId: entry.recipeId } : {}),
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
  items: { id: string; name: string; grams: number | null; servings: number | null }[];
  totals: Nutrients;
};

export function describeSavedMeal(candidate: SavedMealCandidate) {
  return {
    savedMealId: candidate.id,
    name: candidate.name,
    meal: candidate.defaultMeal,
    items: candidate.items.map((item) => ({
      itemId: item.id,
      name: item.name,
      grams: item.grams === null ? null : roundOne(item.grams),
      servings: item.servings,
    })),
    ...roundNutrients(candidate.totals),
  };
}

export type StoredMealCandidate = {
  id: string;
  name: string;
  location: StorageLocation;
  preparedOn: string;
  portions: number;
  items: { id: string; label: string; grams: number | null; servings: number | null }[];
  perPortion: Nutrients;
};

export function describeStoredMeal(candidate: StoredMealCandidate, today: string) {
  return {
    storedMealId: candidate.id,
    name: candidate.name,
    location: candidate.location,
    preparedOn: candidate.preparedOn,
    daysStored: storedMealAgeDays(candidate.preparedOn, today),
    checkBeforeEating: isStoredMealOld(candidate.location, candidate.preparedOn, today),
    portionsLeft: candidate.portions,
    portionItems: candidate.items.map((item) => ({
      itemId: item.id,
      name: item.label,
      grams: item.grams === null ? null : roundOne(item.grams),
      servings: item.servings,
    })),
    perPortion: roundNutrients(candidate.perPortion),
  };
}

export type FoodDetailSummary = {
  id: string;
  name: string;
  brand: string | null;
  barcode: string | null;
  source: "swiss" | "open_food_facts" | "user";
  unit: "g" | "ml";
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  sugars: number | null;
  saturatedFat: number | null;
  fiber: number | null;
  salt: number | null;
  portions: PortionOption[];
  isFavorite: boolean;
  isOwn: boolean;
};

function roundOptional(value: number | null) {
  return value === null ? null : roundOne(value);
}

export function describeFoodDetail(detail: FoodDetailSummary) {
  return {
    foodId: detail.id,
    name: detail.name,
    brand: detail.brand,
    barcode: detail.barcode,
    source: detail.source,
    unit: detail.unit,
    per100: {
      kcal: roundOne(detail.kcal),
      protein: roundOne(detail.protein),
      carbs: roundOne(detail.carbs),
      sugars: roundOptional(detail.sugars),
      fat: roundOne(detail.fat),
      saturatedFat: roundOptional(detail.saturatedFat),
      fiber: roundOptional(detail.fiber),
      salt: roundOptional(detail.salt),
    },
    portions: detail.portions.map((portion) => ({ label: portion.label, grams: roundOne(portion.grams) })),
    favorite: detail.isFavorite,
    own: detail.isOwn,
  };
}

export type RecipeDetailSummary = {
  notes: string | null;
  isFavorite: boolean;
  ingredients: { foodId: string; name: string; unit: "g" | "ml"; grams: number; per100: Nutrients }[];
};

export function describeRecipeDetail(candidate: RecipeCandidate, detail: RecipeDetailSummary) {
  return {
    ...describeRecipeCandidate(candidate),
    notes: detail.notes,
    favorite: detail.isFavorite,
    ingredients: detail.ingredients.map((ingredient) => ({
      foodId: ingredient.foodId,
      name: ingredient.name,
      unit: ingredient.unit,
      grams: roundOne(ingredient.grams),
      kcal: Math.round((ingredient.per100.kcal * ingredient.grams) / 100),
    })),
  };
}

export type MeasurementSummary = {
  id: string;
  measuredOn: string;
  weightKg: number;
  bodyFatPercent: number | null;
  musclePercent: number | null;
  visceralFat: number | null;
  bodyWaterPercent: number | null;
  boneMassKg: number | null;
  waistCm: number | null;
  hipCm: number | null;
  note: string | null;
};

export function describeMeasurement({ id, measuredOn, ...values }: MeasurementSummary) {
  return {
    measurementId: id,
    day: measuredOn,
    ...Object.fromEntries(Object.entries(values).filter(([, value]) => value !== null)),
  };
}

export type ProfileSummary = {
  sex: "male" | "female" | null;
  birthDate: string | null;
  heightCm: number | null;
  activityLevel: "sedentary" | "light" | "moderate" | "active" | "very_active";
  goal: "lose" | "maintain" | "gain";
  weeklyRateKg: number;
  targetWeightKg: number | null;
  targetKcal: number | null;
  targetProteinG: number | null;
  targetCarbsG: number | null;
  targetFatG: number | null;
  targetsCustomized: boolean;
};

export function describeProfile(
  profile: ProfileSummary | null,
  latestWeight: { weightKg: number; measuredOn: string } | null,
) {
  return {
    complete: Boolean(profile?.sex && profile.birthDate && profile.heightCm && profile.targetKcal),
    sex: profile?.sex ?? null,
    birthDate: profile?.birthDate ?? null,
    heightCm: profile?.heightCm ?? null,
    latestWeight: latestWeight ? { day: latestWeight.measuredOn, kg: roundOne(latestWeight.weightKg) } : null,
    activityLevel: profile?.activityLevel ?? null,
    goal: profile?.goal ?? null,
    weeklyRateKg: profile && profile.goal !== "maintain" ? profile.weeklyRateKg : null,
    targetWeightKg: profile?.targetWeightKg ?? null,
    targets: profile?.targetKcal
      ? {
          kcal: profile.targetKcal,
          protein: profile.targetProteinG ?? 0,
          carbs: profile.targetCarbsG ?? 0,
          fat: profile.targetFatG ?? 0,
          custom: profile.targetsCustomized,
        }
      : null,
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
  incompleteDays,
  maintenance,
  suggestedTargetKcal,
}: {
  today: string;
  days: number;
  dailyTotals: readonly DayTotals[];
  targets: DailyTargets;
  weights: readonly DatedValue[];
  incompleteDays: readonly string[];
  maintenance: MaintenanceEstimate;
  suggestedTargetKcal: number | null;
}) {
  const fromDay = addDays(today, -(days - 1));
  const markedIncomplete = new Set(incompleteDays);
  const inPeriod = dailyTotals.filter((totals) => totals.day >= fromDay && totals.day <= today);
  const completeDays = inPeriod.filter(
    (totals) => totals.day < today && totals.kcal >= partialDayKcal && !markedIncomplete.has(totals.day),
  );
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
  const week = targets
    ? weeklyBudget({ day: today, targetKcal: targets.kcal, dailyKcal: dailyTotals, incompleteDays })
    : null;

  return {
    fromDay,
    toDay: today,
    days: inPeriod.map((totals) => ({
      day: totals.day,
      ...roundNutrients(totals),
      incomplete: markedIncomplete.has(totals.day),
    })),
    average: average && { ...average, overDays: completeDays.length },
    note: `Average over the logged days before today with at least ${partialDayKcal} kcal, leaving out the days the user marked as incomplete (incomplete: true); days without entries are missing from the list.`,
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
      note: "Past days of the week without entries or marked as incomplete count as on target.",
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
