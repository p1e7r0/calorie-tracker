import { describe, expect, it } from "vitest";
import { sanitizeMealDescription, sanitizeNutritionLabel } from "./ai-schemas";

describe("sanitizeNutritionLabel", () => {
  it("rounds values and drops impossible ones", () => {
    const label = sanitizeNutritionLabel({
      readable: true,
      name: "  Yogurt greco  ",
      brand: "",
      unit: "g",
      per100: { kcal: 97.04, protein: 9.06, carbs: 3.9, sugars: 3.9, fat: 5, saturatedFat: -1, fiber: null, salt: 0.11 },
      portion: { label: "1 vasetto", grams: 150 },
    });
    expect(label.name).toBe("Yogurt greco");
    expect(label.brand).toBeNull();
    expect(label.per100).toEqual({
      kcal: 97,
      protein: 9.1,
      carbs: 3.9,
      sugars: 3.9,
      fat: 5,
      saturatedFat: null,
      fiber: null,
      salt: 0.1,
    });
    expect(label.portion).toEqual({ label: "1 vasetto", grams: 150 });
  });

  it("rejects kilojoules mistaken for kcal and empty portions", () => {
    const label = sanitizeNutritionLabel({
      readable: true,
      name: null,
      brand: null,
      unit: "ml",
      per100: { kcal: 1700, protein: null, carbs: null, sugars: null, fat: null, saturatedFat: null, fiber: null, salt: null },
      portion: { label: " ", grams: 30 },
    });
    expect(label.per100.kcal).toBeNull();
    expect(label.portion).toBeNull();
  });
});

describe("sanitizeMealDescription", () => {
  it("keeps plausible items and rounds grams and kcal", () => {
    const meal = sanitizeMealDescription({
      items: [
        { description: "pasta al pomodoro", query: "pasta cotta", grams: 180.4, estimatedKcal: 280.6 },
        { description: "aria", query: " ", grams: 10, estimatedKcal: 0 },
        { description: "pentola", query: "pentola", grams: 0, estimatedKcal: 0 },
      ],
    });
    expect(meal.items).toEqual([
      { description: "pasta al pomodoro", query: "pasta cotta", grams: 180, estimatedKcal: 281 },
    ]);
  });
});
