import "server-only";
import { z } from "zod";
import { multiplyNutrients, type Nutrients, scaleNutrients } from "@/lib/nutrition/nutrients";
import { recipePortionNutrients, type RecipeNutrition } from "@/lib/nutrition/recipe";
import { getVisibleFood } from "./foods";
import { getLoggableRecipe } from "./recipes";

const quantity = z.number().positive().max(10_000);

export const entryItemSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("food"),
    foodId: z.uuid(),
    grams: quantity,
    portionLabel: z.string().max(80).nullish(),
  }),
  z.object({
    type: z.literal("recipe"),
    recipeId: z.uuid(),
    grams: quantity.nullish(),
    servings: z.number().positive().max(100).nullish(),
  }),
  z.object({
    type: z.literal("quick"),
    label: z.string().trim().max(80).nullish(),
    kcal: z.number().min(0).max(20_000),
    protein: z.number().min(0).max(2_000).nullish(),
    carbs: z.number().min(0).max(2_000).nullish(),
    fat: z.number().min(0).max(2_000).nullish(),
  }),
]);

export type EntryItem = z.infer<typeof entryItemSchema>;

export function recipeNutritionFromLoggable(recipe: NonNullable<Awaited<ReturnType<typeof getLoggableRecipe>>>) {
  return {
    total: multiplyNutrients(recipe.perServing, recipe.servings),
    rawWeightG: recipe.finalWeightG,
    finalWeightG: recipe.finalWeightG,
    per100g: recipe.per100,
    perServing: recipe.perServing,
    servings: recipe.servings,
  } satisfies RecipeNutrition;
}

export async function resolveEntryValues(userId: string, item: EntryItem) {
  if (item.type === "food") {
    const foodRow = await getVisibleFood(userId, item.foodId);
    if (!foodRow) throw new Error("Alimento non trovato.");
    const per100: Nutrients = {
      kcal: foodRow.kcal,
      protein: foodRow.protein,
      carbs: foodRow.carbs,
      fat: foodRow.fat,
    };
    return {
      kind: "food" as const,
      foodId: foodRow.id,
      recipeId: null,
      label: foodRow.brand ? `${foodRow.name}, ${foodRow.brand}` : foodRow.name,
      grams: item.grams,
      servings: null,
      portionLabel: item.portionLabel ?? null,
      nutrients: scaleNutrients(per100, item.grams),
    };
  }

  if (item.type === "recipe") {
    const recipe = await getLoggableRecipe(userId, item.recipeId);
    if (!recipe) throw new Error("Ricetta non trovata.");
    const nutrition = recipeNutritionFromLoggable(recipe);
    const portion = item.grams ? { grams: item.grams } : { servings: item.servings ?? 1 };
    return {
      kind: "recipe" as const,
      foodId: null,
      recipeId: recipe.id,
      label: recipe.name,
      grams: item.grams ?? null,
      servings: item.grams ? null : (item.servings ?? 1),
      portionLabel: null,
      nutrients: recipePortionNutrients(nutrition, portion),
    };
  }

  return {
    kind: "quick" as const,
    foodId: null,
    recipeId: null,
    label: item.label || "Kcal veloci",
    grams: null,
    servings: null,
    portionLabel: null,
    nutrients: {
      kcal: item.kcal,
      protein: item.protein ?? 0,
      carbs: item.carbs ?? 0,
      fat: item.fat ?? 0,
    },
  };
}
