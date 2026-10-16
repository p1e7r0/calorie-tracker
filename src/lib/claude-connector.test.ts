import { describe, expect, it } from "vitest";
import { describeDay, describeFoodCandidate, describeRecipeCandidate } from "./claude-connector";

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
      }),
    ).toMatchObject({ recipeId: "recipe-1", servings: 4, cookedWeightG: 1000, perServing: { kcal: 450 } });
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
