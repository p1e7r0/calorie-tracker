import "server-only";
import { and, eq, inArray, isNull } from "drizzle-orm";
import { z } from "zod";
import { database } from "@/db";
import { favoriteRecipe, food, recipe, recipeIngredient } from "@/db/schema";
import { visibleFoodCondition } from "./foods";

export const recipeInputSchema = z.object({
  name: z.string().trim().min(1, "Dai un nome alla ricetta.").max(120),
  servings: z.number().int().min(1).max(100),
  cookedWeightG: z.number().positive().max(50_000).nullish(),
  servingGrams: z.number().positive().max(20_000).nullish(),
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
    servingGrams: input.servingGrams ?? null,
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

export async function editRecipe(userId: string, recipeId: string, input: RecipeInput) {
  const parsed = recipeInputSchema.parse(input);
  const id = z.uuid().parse(recipeId);
  await assertIngredientsVisible(userId, parsed.ingredients.map((ingredient) => ingredient.foodId));
  await database.transaction(async (transaction) => {
    const updated = await transaction
      .update(recipe)
      .set(toRecipeValues(parsed))
      .where(and(eq(recipe.id, id), eq(recipe.ownerId, userId), isNull(recipe.archivedAt)))
      .returning({ id: recipe.id });
    if (updated.length === 0) throw new Error("Ricetta non trovata.");
    await transaction.delete(recipeIngredient).where(eq(recipeIngredient.recipeId, id));
    await transaction
      .insert(recipeIngredient)
      .values(parsed.ingredients.map((ingredient, position) => ({ ...ingredient, position, recipeId: id })));
  });
  return id;
}

export async function archiveOwnRecipe(userId: string, recipeId: string) {
  const [archived] = await database
    .update(recipe)
    .set({ archivedAt: new Date() })
    .where(and(eq(recipe.id, z.uuid().parse(recipeId)), eq(recipe.ownerId, userId), isNull(recipe.archivedAt)))
    .returning({ id: recipe.id, name: recipe.name });
  if (!archived) throw new Error("Ricetta non trovata.");
  return archived;
}

export async function markRecipeFavorite(userId: string, recipeId: string, favorite: boolean) {
  const [owned] = await database
    .select({ id: recipe.id, name: recipe.name })
    .from(recipe)
    .where(and(eq(recipe.id, z.uuid().parse(recipeId)), eq(recipe.ownerId, userId), isNull(recipe.archivedAt)));
  if (!owned) throw new Error("Ricetta non trovata.");
  if (favorite) {
    await database.insert(favoriteRecipe).values({ userId, recipeId: owned.id }).onConflictDoNothing();
  } else {
    await database
      .delete(favoriteRecipe)
      .where(and(eq(favoriteRecipe.userId, userId), eq(favoriteRecipe.recipeId, owned.id)));
  }
  return owned;
}
