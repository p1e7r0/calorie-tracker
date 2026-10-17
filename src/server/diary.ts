import "server-only";
import { and, asc, eq, gte, inArray, lte } from "drizzle-orm";
import { database } from "@/db";
import { diaryEntry, food, foodPortion, profile } from "@/db/schema";
import { mealTypes, type MealType } from "@/lib/nutrition/meals";
import { extrasFromRow, sumExtras } from "@/lib/nutrition/extra-nutrients";
import { type Nutrients, sumNutrients } from "@/lib/nutrition/nutrients";

export type DiaryEntryView = {
  id: string;
  meal: MealType;
  kind: "food" | "recipe" | "quick";
  foodId: string | null;
  recipeId: string | null;
  label: string;
  grams: number | null;
  servings: number | null;
  portionLabel: string | null;
  unit: "g" | "ml";
  portions: { label: string; grams: number }[];
  nutrients: Nutrients;
};

export type DiaryMeal = {
  meal: MealType;
  entries: DiaryEntryView[];
  totals: Nutrients;
};

export type DailyTargetsView = {
  kcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
} | null;

export async function listLoggedDays(userId: string, fromDay: string, toDay: string) {
  const rows = await database
    .selectDistinct({ day: diaryEntry.day })
    .from(diaryEntry)
    .where(and(eq(diaryEntry.userId, userId), gte(diaryEntry.day, fromDay), lte(diaryEntry.day, toDay)));
  return rows.map((row) => row.day);
}

export async function getDiaryDay(userId: string, day: string) {
  const rows = await database
    .select()
    .from(diaryEntry)
    .where(and(eq(diaryEntry.userId, userId), eq(diaryEntry.day, day)))
    .orderBy(asc(diaryEntry.createdAt));
  const foodIds = [...new Set(rows.flatMap((row) => (row.kind === "food" && row.foodId ? [row.foodId] : [])))];
  const [foodUnits, portions] =
    foodIds.length === 0
      ? [[], []]
      : await Promise.all([
          database.select({ id: food.id, unit: food.unit }).from(food).where(inArray(food.id, foodIds)),
          database
            .select({ foodId: foodPortion.foodId, label: foodPortion.label, grams: foodPortion.grams })
            .from(foodPortion)
            .where(inArray(foodPortion.foodId, foodIds))
            .orderBy(foodPortion.position),
        ]);
  const unitByFood = new Map(foodUnits.map((row) => [row.id, row.unit]));

  const entries: DiaryEntryView[] = rows.map((row) => ({
    id: row.id,
    meal: row.meal,
    kind: row.kind,
    foodId: row.foodId,
    recipeId: row.recipeId,
    label: row.label,
    grams: row.grams,
    servings: row.servings,
    portionLabel: row.portionLabel,
    unit: (row.foodId && unitByFood.get(row.foodId)) || "g",
    portions: portions
      .filter((portion) => portion.foodId === row.foodId)
      .map((portion) => ({ label: portion.label, grams: portion.grams })),
    nutrients: { kcal: row.kcal, protein: row.protein, carbs: row.carbs, fat: row.fat },
  }));

  const meals: DiaryMeal[] = mealTypes.map((meal) => {
    const mealEntries = entries.filter((entry) => entry.meal === meal);
    return {
      meal,
      entries: mealEntries,
      totals: sumNutrients(mealEntries.map((entry) => entry.nutrients)),
    };
  });

  return {
    meals,
    totals: sumNutrients(entries.map((entry) => entry.nutrients)),
    extras: sumExtras(rows.map(extrasFromRow)),
  };
}

export async function getDailyTargets(userId: string): Promise<DailyTargetsView> {
  const [row] = await database
    .select({
      kcal: profile.targetKcal,
      proteinG: profile.targetProteinG,
      carbsG: profile.targetCarbsG,
      fatG: profile.targetFatG,
    })
    .from(profile)
    .where(eq(profile.userId, userId));
  if (!row?.kcal) return null;
  return {
    kcal: row.kcal,
    proteinG: row.proteinG ?? 0,
    carbsG: row.carbsG ?? 0,
    fatG: row.fatG ?? 0,
  };
}
