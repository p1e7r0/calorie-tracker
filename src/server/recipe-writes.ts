import "server-only";
import { and, inArray } from "drizzle-orm";
import { z } from "zod";
import { database } from "@/db";
import { food, recipe, recipeIngredient } from "@/db/schema";
import { visibleFoodCondition } from "./foods";

export const recipeInputSchema = z.object({
  name: z.string().trim().min(1, "Dai un nome alla ricetta.").max(120),
  servings: z.number().int().min(1).max(100),
  cookedWeightG: z.number().positive().max(50_000).nullish(),
  notes: z.string().trim().max(2000).nullish(),
  ingredients: z
    .array(z.object({ foodId: z.uuid(), grams: z.number().positive().max(20_000) }))
    .min(1, "Aggiungi almeno un ingrediente.")
    .max(60),
});

export type RecipeInput = z.input<typeof recipeInputSchema>;
export type ParsedRecipeInput = z.infer<typeof recipeInputSchema>;

export async function assertIngredientsVisible(userId: string, foodIds: string[]) {
  const uniqueIds = [...new Set(foodIds)];
  const visible = await database
    .select({ id: food.id })
    .from(food)
    .where(and(visibleFoodCondition(userId), inArray(food.id, uniqueIds)));
  if (visible.length !== uniqueIds.length) throw new Error("Uno degli ingredienti non è più disponibile.");
}

export function toRecipeValues(input: ParsedRecipeInput) {
  return {
    name: input.name,
    servings: input.servings,
    cookedWeightG: input.cookedWeightG ?? null,
    notes: input.notes || null,
  };
}

export async function insertRecipe(userId: string, input: RecipeInput) {
  const parsed = recipeInputSchema.parse(input);
  await assertIngredientsVisible(userId, parsed.ingredients.map((ingredient) => ingredient.foodId));
  return database.transaction(async (transaction) => {
    const [created] = await transaction
      .insert(recipe)
      .values({ ...toRecipeValues(parsed), ownerId: userId })
      .returning({ id: recipe.id });
    await transaction
      .insert(recipeIngredient)
      .values(parsed.ingredients.map((ingredient, position) => ({ ...ingredient, position, recipeId: created.id })));
    return created.id;
  });
}
