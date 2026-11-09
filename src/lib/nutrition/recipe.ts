import { multiplyNutrients, type Nutrients, scaleNutrients, sumNutrients } from "./nutrients";

export type RecipeIngredientInput = {
  grams: number;
  per100: Nutrients;
};

export type RecipeNutrition = {
  total: Nutrients;
  rawWeightG: number;
  finalWeightG: number;
  per100g: Nutrients;
  perServing: Nutrients;
  servings: number;
  servingWeightG: number;
};

export function recipeServingCount({
  finalWeightG,
  servings,
  servingGrams,
}: {
  finalWeightG: number;
  servings?: number | null;
  servingGrams?: number | null;
}) {
  if (servingGrams && servingGrams > 0 && finalWeightG > 0) return finalWeightG / servingGrams;
  return servings && servings > 0 ? servings : 1;
}

export function computeRecipeNutrition({
  ingredients,
  cookedWeightG,
  servings,
  servingGrams,
}: {
  ingredients: readonly RecipeIngredientInput[];
  cookedWeightG?: number | null;
  servings?: number | null;
  servingGrams?: number | null;
}): RecipeNutrition {
  const total = sumNutrients(ingredients.map((ingredient) => scaleNutrients(ingredient.per100, ingredient.grams)));
  const rawWeightG = ingredients.reduce((weight, ingredient) => weight + ingredient.grams, 0);
  const finalWeightG = cookedWeightG && cookedWeightG > 0 ? cookedWeightG : rawWeightG;
  const servingCount = recipeServingCount({ finalWeightG, servings, servingGrams });

  return {
    total,
    rawWeightG,
    finalWeightG,
    per100g: finalWeightG > 0 ? multiplyNutrients(total, 100 / finalWeightG) : multiplyNutrients(total, 0),
    perServing: multiplyNutrients(total, 1 / servingCount),
    servings: servingCount,
    servingWeightG: servingGrams && servingGrams > 0 ? servingGrams : finalWeightG / servingCount,
  };
}

export type RecipePortion = { grams: number } | { servings: number };

export function recipePortionNutrients(recipe: RecipeNutrition, portion: RecipePortion): Nutrients {
  if ("grams" in portion) {
    return scaleNutrients(recipe.per100g, portion.grams);
  }
  return multiplyNutrients(recipe.perServing, portion.servings);
}

export function recipePortionWeight(recipe: RecipeNutrition, portion: RecipePortion) {
  if ("grams" in portion) return portion.grams;
  return recipe.servingWeightG * portion.servings;
}
