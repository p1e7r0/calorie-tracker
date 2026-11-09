import { describe, expect, it } from "vitest";
import {
  computeRecipeNutrition,
  createsRecipeCycle,
  recipePortionNutrients,
  recipePortionWeight,
  recipeServingCount,
  resolveRecipes,
  type RecipeGraphNode,
} from "./recipe";

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

const tomato = { kcal: 20, protein: 1, carbs: 3, fat: 0 };
const pasta = { kcal: 350, protein: 12, carbs: 70, fat: 2 };
const noExtras = { fiber: null, sugars: null, saturatedFat: null, salt: null };

describe("resolveRecipes", () => {
  it("uses the cooked values of a sub-recipe per 100 g", () => {
    const nodes = new Map<string, RecipeGraphNode>([
      [
        "sauce",
        {
          cookedWeightG: 500,
          servings: 1,
          ingredients: [{ grams: 1000, per100: tomato, extras: { ...noExtras, salt: 0.5 } }],
        },
      ],
      [
        "pasta-with-sauce",
        {
          servings: 2,
          ingredients: [
            { grams: 200, per100: pasta, extras: noExtras },
            { grams: 100, subRecipeId: "sauce" },
          ],
        },
      ],
    ]);
    const resolved = resolveRecipes(nodes);
    expect(resolved.get("sauce")?.nutrition.per100g.kcal).toBeCloseTo(40);
    const dish = resolved.get("pasta-with-sauce")!;
    expect(dish.nutrition.total.kcal).toBeCloseTo(700 + 40);
    expect(dish.nutrition.rawWeightG).toBe(300);
    expect(dish.nutrition.perServing.kcal).toBeCloseTo(370);
    expect(dish.extras.salt).toBeCloseTo(1);
    expect(dish.extras.fiber).toBeNull();
  });

  it("resolves sub-recipes nested on several levels", () => {
    const nodes = new Map<string, RecipeGraphNode>([
      ["top", { ingredients: [{ grams: 100, subRecipeId: "middle" }] }],
      ["middle", { ingredients: [{ grams: 50, subRecipeId: "bottom" }, { grams: 50, per100: pasta, extras: noExtras }] }],
      ["bottom", { ingredients: [{ grams: 100, per100: tomato, extras: noExtras }] }],
    ]);
    expect(resolveRecipes(nodes).get("top")?.nutrition.total.kcal).toBeCloseTo(10 + 175);
  });

  it("counts a missing or cyclic sub-recipe as zero instead of looping", () => {
    const nodes = new Map<string, RecipeGraphNode>([
      ["first", { ingredients: [{ grams: 100, subRecipeId: "second" }, { grams: 100, per100: tomato, extras: noExtras }] }],
      ["second", { ingredients: [{ grams: 100, subRecipeId: "first" }, { grams: 100, subRecipeId: "missing" }] }],
    ]);
    const resolved = resolveRecipes(nodes);
    expect(resolved.get("first")?.nutrition.total.kcal).toBeCloseTo(20);
    expect(Number.isFinite(resolved.get("second")?.nutrition.total.kcal)).toBe(true);
  });
});

describe("createsRecipeCycle", () => {
  const subRecipesOf = new Map([
    ["lasagne", ["ragu", "bechamel"]],
    ["ragu", ["broth"]],
  ]);

  it("rejects a recipe that contains itself", () => {
    expect(createsRecipeCycle("ragu", ["ragu"], subRecipesOf)).toBe(true);
  });

  it("rejects a sub-recipe that already contains the recipe", () => {
    expect(createsRecipeCycle("broth", ["lasagne"], subRecipesOf)).toBe(true);
    expect(createsRecipeCycle("ragu", ["lasagne"], subRecipesOf)).toBe(true);
  });

  it("accepts sub-recipes that do not lead back to the recipe", () => {
    expect(createsRecipeCycle("lasagne", ["ragu", "bechamel"], subRecipesOf)).toBe(false);
    expect(createsRecipeCycle("new", ["lasagne"], subRecipesOf)).toBe(false);
  });
});
