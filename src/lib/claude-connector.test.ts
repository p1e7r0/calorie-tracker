import { describe, expect, it } from "vitest";
import {
  describeDay,
  describeFoodCandidate,
  describeProgress,
  describeRecipeCandidate,
  describeSavedMeal,
  describeWeightTrend,
} from "./claude-connector";

describe("describeFoodCandidate", () => {
  it("joins name and brand and rounds the values", () => {
    expect(
      describeFoodCandidate({
        id: "food-1",
        name: "Yogurt greco",
        brand: "Fage",
        unit: "g",
        per100: { kcal: 96.6, protein: 9.04, carbs: 3.96, fat: 5.01 },
        portions: [{ label: "1 vasetto", grams: 170 }],
        lastGrams: 170,
        isFavorite: true,
        isOwn: false,
      }),
    ).toEqual({
      foodId: "food-1",
      name: "Yogurt greco, Fage",
      unit: "g",
      per100: { kcal: 97, protein: 9, carbs: 4, fat: 5 },
      portions: [{ label: "1 vasetto", grams: 170 }],
      lastGrams: 170,
      favorite: true,
      own: false,
    });
  });
});

describe("describeRecipeCandidate", () => {
  it("exposes the cooked weight and the values per serving", () => {
    expect(
      describeRecipeCandidate({
        id: "recipe-1",
        name: "Lasagne",
        per100: { kcal: 180, protein: 9, carbs: 15, fat: 9 },
        perServing: { kcal: 450.4, protein: 22.5, carbs: 37.5, fat: 22.5 },
        servings: 4,
        finalWeightG: 1000.4,
        hasCookedWeight: true,
      }),
    ).toMatchObject({
      recipeId: "recipe-1",
      servings: 4,
      cookedWeightG: 1000,
      rawWeightG: null,
      perServing: { kcal: 450 },
    });
  });

  it("reports the raw weight when the cooked weight is unknown", () => {
    expect(
      describeRecipeCandidate({
        id: "recipe-2",
        name: "Pasta al pomodoro",
        per100: { kcal: 300, protein: 10, carbs: 60, fat: 3 },
        perServing: { kcal: 300, protein: 10, carbs: 60, fat: 3 },
        servings: 1,
        finalWeightG: 100,
        hasCookedWeight: false,
      }),
    ).toMatchObject({ cookedWeightG: null, rawWeightG: 100 });
  });
});

describe("describeDay", () => {
  const diary = {
    meals: [
      {
        meal: "breakfast" as const,
        entries: [
          {
            id: "entry-1",
            meal: "breakfast" as const,
            label: "Latte",
            grams: 200,
            servings: null,
            portionLabel: null,
            nutrients: { kcal: 128, protein: 6.6, carbs: 9.6, fat: 7.2 },
          },
        ],
        totals: { kcal: 128, protein: 6.6, carbs: 9.6, fat: 7.2 },
      },
      { meal: "lunch" as const, entries: [], totals: { kcal: 0, protein: 0, carbs: 0, fat: 0 } },
    ],
    totals: { kcal: 128, protein: 6.6, carbs: 9.6, fat: 7.2 },
  };

  it("labels meals in Italian and computes the kcal left", () => {
    const summary = describeDay("2026-10-16", diary, { kcal: 2000, proteinG: 120, carbsG: 220, fatG: 70 });
    expect(summary.meals[0]).toMatchObject({ label: "Colazione", entries: [{ entryId: "entry-1", kcal: 128 }] });
    expect(summary.remainingKcal).toBe(1872);
    expect(summary.targets).toEqual({ kcal: 2000, protein: 120, carbs: 220, fat: 70 });
  });

  it("leaves the remaining kcal empty without a goal", () => {
    expect(describeDay("2026-10-16", diary, null).remainingKcal).toBeNull();
  });
});

describe("describeSavedMeal", () => {
  it("lists the items and rounds the totals", () => {
    expect(
      describeSavedMeal({
        id: "saved-1",
        name: "Colazione solita",
        defaultMeal: "breakfast",
        items: [
          { name: "Latte", grams: 200.04, servings: null },
          { name: "Torta di mele", grams: null, servings: 1 },
        ],
        totals: { kcal: 420.6, protein: 12.04, carbs: 60, fat: 14.26 },
      }),
    ).toEqual({
      savedMealId: "saved-1",
      name: "Colazione solita",
      meal: "breakfast",
      items: [
        { name: "Latte", grams: 200, servings: null },
        { name: "Torta di mele", grams: null, servings: 1 },
      ],
      kcal: 421,
      protein: 12,
      carbs: 60,
      fat: 14.3,
    });
  });
});

describe("describeWeightTrend", () => {
  it("returns nothing without weigh-ins", () => {
    expect(describeWeightTrend([])).toBeNull();
  });

  it("keeps the last weigh-in of each day and measures the change", () => {
    const trend = describeWeightTrend([
      { day: "2026-09-01", value: 84 },
      { day: "2026-10-01", value: 82.4 },
      { day: "2026-10-08", value: 82 },
      { day: "2026-10-08", value: 81.6 },
    ]);
    expect(trend).toEqual({
      latest: { day: "2026-10-08", kg: 81.6 },
      sevenDayAverageKg: 81.6,
      change7Days: { kg: -0.8, sinceDay: "2026-10-01" },
      change30Days: { kg: -2.4, sinceDay: "2026-09-01" },
    });
  });
});

describe("describeProgress", () => {
  const today = "2026-10-21";
  const base = {
    today,
    days: 7,
    targets: { kcal: 2000, proteinG: 120, carbsG: 220, fatG: 70 },
    weights: [],
    maintenance: { status: "insufficient" as const, loggedDays: 3, weightSpanDays: 0, excludedIncompleteDays: 0 },
    suggestedTargetKcal: null,
  };
  const totals = (day: string, kcal: number) => ({ day, kcal, protein: 100, carbs: 200, fat: 60 });

  it("averages the complete days before today", () => {
    const progress = describeProgress({
      ...base,
      dailyTotals: [
        totals("2026-10-10", 3000),
        totals("2026-10-19", 1800),
        totals("2026-10-20", 2200),
        totals("2026-10-18", 400),
        totals(today, 900),
      ],
    });
    expect(progress.fromDay).toBe("2026-10-15");
    expect(progress.days.map((day) => day.day)).toEqual(["2026-10-19", "2026-10-20", "2026-10-18", today]);
    expect(progress.average).toEqual({ kcal: 2000, protein: 100, carbs: 200, fat: 60, overDays: 2 });
  });

  it("computes this week's budget from Monday", () => {
    const progress = describeProgress({
      ...base,
      dailyTotals: [totals("2026-10-19", 2500), totals(today, 500)],
    });
    expect(progress.week).toMatchObject({
      weekStart: "2026-10-19",
      budgetKcal: 14_000,
      eatenKcal: 5000,
      daysLeft: 5,
    });
  });

  it("explains what the maintenance estimate still needs", () => {
    const progress = describeProgress({ ...base, targets: null, dailyTotals: [] });
    expect(progress.week).toBeNull();
    expect(progress.average).toBeNull();
    expect(progress.maintenance).toMatchObject({ status: "insufficient", loggedDays: 3 });
  });
});
