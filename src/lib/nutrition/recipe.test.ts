import { describe, expect, it } from "vitest";
import { computeRecipeNutrition, recipePortionNutrients, recipePortionWeight, recipeServingCount } from "./recipe";

const ingredients = [
  { grams: 320, per100: { kcal: 356, protein: 12.5, carbs: 72, fat: 1.5 } },
  { grams: 400, per100: { kcal: 20, protein: 1, carbs: 3.5, fat: 0.2 } },
  { grams: 30, per100: { kcal: 899, protein: 0, carbs: 0, fat: 99.9 } },
];

describe("computeRecipeNutrition", () => {
  it("sums ingredients and uses the cooked weight as the base for 100 g", () => {
    const recipe = computeRecipeNutrition({ ingredients, cookedWeightG: 1200, servings: 4 });
    expect(recipe.total.kcal).toBeCloseTo(1139.2 + 80 + 269.7, 5);
    expect(recipe.rawWeightG).toBe(750);
    expect(recipe.finalWeightG).toBe(1200);
    expect(recipe.per100g.kcal).toBeCloseTo((1488.9 * 100) / 1200, 5);
    expect(recipe.perServing.kcal).toBeCloseTo(1488.9 / 4, 5);
  });

  it("falls back to the raw weight when the cooked weight is missing", () => {
    const recipe = computeRecipeNutrition({ ingredients, cookedWeightG: null, servings: null });
    expect(recipe.finalWeightG).toBe(750);
    expect(recipe.servings).toBe(1);
    expect(recipe.per100g.kcal).toBeCloseTo((1488.9 * 100) / 750, 5);
  });

  it("handles a recipe without ingredients", () => {
    const recipe = computeRecipeNutrition({ ingredients: [] });
    expect(recipe.per100g).toEqual({ kcal: 0, protein: 0, carbs: 0, fat: 0 });
  });

  it("derives the serving weight from the servings count", () => {
    const recipe = computeRecipeNutrition({ ingredients, cookedWeightG: 1200, servings: 4 });
    expect(recipe.servingWeightG).toBe(300);
  });

  it("derives a fractional servings count from a fixed serving weight", () => {
    const recipe = computeRecipeNutrition({ ingredients, cookedWeightG: 1100, servings: 4, servingGrams: 250 });
    expect(recipe.servings).toBeCloseTo(4.4, 5);
    expect(recipe.servingWeightG).toBe(250);
    expect(recipe.perServing.kcal).toBeCloseTo((1488.9 * 250) / 1100, 5);
  });

  it("keeps the serving weight when the recipe has no ingredients yet", () => {
    const recipe = computeRecipeNutrition({ ingredients: [], servings: 4, servingGrams: 250 });
    expect(recipe.servings).toBe(4);
    expect(recipe.servingWeightG).toBe(250);
  });
});

describe("recipeServingCount", () => {
  it("prefers the serving weight over the stored count", () => {
    expect(recipeServingCount({ finalWeightG: 900, servings: 2, servingGrams: 300 })).toBe(3);
  });

  it("falls back to the stored count, then to one serving", () => {
    expect(recipeServingCount({ finalWeightG: 900, servings: 2, servingGrams: null })).toBe(2);
    expect(recipeServingCount({ finalWeightG: 900 })).toBe(1);
  });
});

describe("recipe portions", () => {
  const recipe = computeRecipeNutrition({ ingredients, cookedWeightG: 1200, servings: 4 });

  it("computes a portion weighed in cooked grams", () => {
    expect(recipePortionNutrients(recipe, { grams: 300 }).kcal).toBeCloseTo(1488.9 / 4, 5);
  });

  it("computes a portion counted in servings", () => {
    expect(recipePortionNutrients(recipe, { servings: 0.5 }).kcal).toBeCloseTo(1488.9 / 8, 5);
    expect(recipePortionWeight(recipe, { servings: 0.5 })).toBe(150);
  });

  it("weighs servings with the fixed serving weight", () => {
    const fixed = computeRecipeNutrition({ ingredients, cookedWeightG: 1100, servings: 4, servingGrams: 250 });
    expect(recipePortionWeight(fixed, { servings: 2 })).toBe(500);
    expect(recipePortionNutrients(fixed, { servings: 1 }).kcal).toBeCloseTo(
      recipePortionNutrients(fixed, { grams: 250 }).kcal,
      5,
    );
  });
});
