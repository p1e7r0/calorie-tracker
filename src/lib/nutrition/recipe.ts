import {
  emptyExtraNutrients,
  type ExtraNutrients,
  multiplyExtras,
  scaleExtras,
  sumExtras,
} from "./extra-nutrients";
import { emptyNutrients, multiplyNutrients, type Nutrients, scaleNutrients, sumNutrients } from "./nutrients";

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

export type RecipeGraphIngredient = { grams: number } & (
  | { subRecipeId: string }
  | { per100: Nutrients; extras: ExtraNutrients }
);

export type RecipeGraphNode = {
  cookedWeightG?: number | null;
  servings?: number | null;
  servingGrams?: number | null;
  ingredients: readonly RecipeGraphIngredient[];
};

export type ResolvedRecipe = {
  nutrition: RecipeNutrition;
  extras: ExtraNutrients;
  extrasPer100g: ExtraNutrients;
};

export function resolveRecipes(nodes: ReadonlyMap<string, RecipeGraphNode>): Map<string, ResolvedRecipe> {
  const resolved = new Map<string, ResolvedRecipe>();
  const visiting = new Set<string>();

  function resolve(recipeId: string): ResolvedRecipe | null {
    const known = resolved.get(recipeId);
    if (known) return known;
    const node = nodes.get(recipeId);
    if (!node || visiting.has(recipeId)) return null;
    visiting.add(recipeId);
    const ingredients = node.ingredients.map((ingredient) => {
      if ("per100" in ingredient) {
        return { grams: ingredient.grams, per100: ingredient.per100, extras: ingredient.extras };
      }
      const subRecipe = resolve(ingredient.subRecipeId);
      return {
        grams: ingredient.grams,
        per100: subRecipe?.nutrition.per100g ?? emptyNutrients,
        extras: subRecipe?.extrasPer100g ?? emptyExtraNutrients,
      };
    });
    visiting.delete(recipeId);
    const nutrition = computeRecipeNutrition({
      ingredients,
      cookedWeightG: node.cookedWeightG,
      servings: node.servings,
      servingGrams: node.servingGrams,
    });
    const extras = sumExtras(ingredients.map((ingredient) => scaleExtras(ingredient.extras, ingredient.grams)));
    const result = {
      nutrition,
      extras,
      extrasPer100g: multiplyExtras(extras, nutrition.finalWeightG > 0 ? 100 / nutrition.finalWeightG : 0),
    };
    resolved.set(recipeId, result);
    return result;
  }

  for (const recipeId of nodes.keys()) resolve(recipeId);
  return resolved;
}

export function createsRecipeCycle(
  recipeId: string,
  subRecipeIds: readonly string[],
  subRecipesOf: ReadonlyMap<string, readonly string[]>,
) {
  const seen = new Set<string>();
  const pending = [...subRecipeIds];
  while (pending.length > 0) {
    const current = pending.pop()!;
    if (current === recipeId) return true;
    if (seen.has(current)) continue;
    seen.add(current);
    pending.push(...(subRecipesOf.get(current) ?? []));
  }
  return false;
}
