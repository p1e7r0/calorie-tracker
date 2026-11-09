import "server-only";
import { and, eq, inArray, isNull } from "drizzle-orm";
import { z } from "zod";
import { database } from "@/db";
import { favoriteRecipe, food, recipe, recipeIngredient } from "@/db/schema";
import { createsRecipeCycle } from "@/lib/nutrition/recipe";
import { visibleFoodCondition } from "./foods";
import { subRecipeEdges } from "./recipes";

export const recipeInputSchema = z.object({
  name: z.string().trim().min(1, "Dai un nome alla ricetta.").max(120),
  servings: z.number().int().min(1).max(100),
  cookedWeightG: z.number().positive().max(50_000).nullish(),
  servingGrams: z.number().positive().max(20_000).nullish(),
  notes: z.string().trim().max(2000).nullish(),
  ingredients: z
    .array(
      z
        .object({
          foodId: z.uuid().nullish(),
          recipeId: z.uuid().nullish(),
          grams: z.number().positive().max(20_000),
        })
        .refine((ingredient) => Boolean(ingredient.foodId) !== Boolean(ingredient.recipeId), {
          message: "Ogni ingrediente deve essere un alimento oppure una ricetta.",
        }),
    )
    .min(1, "Aggiungi almeno un ingrediente.")
    .max(60),
});

export type RecipeInput = z.input<typeof recipeInputSchema>;
export type ParsedRecipeInput = z.infer<typeof recipeInputSchema>;

async function assertFoodsVisible(userId: string, foodIds: string[]) {
  const uniqueIds = [...new Set(foodIds)];
  if (uniqueIds.length === 0) return;
  const visible = await database
    .select({ id: food.id })
    .from(food)
    .where(and(visibleFoodCondition(userId), inArray(food.id, uniqueIds)));
  if (visible.length !== uniqueIds.length) throw new Error("Uno degli ingredienti non è più disponibile.");
}

async function assertSubRecipesAllowed(userId: string, recipeId: string | null, subRecipeIds: string[]) {
  const uniqueIds = [...new Set(subRecipeIds)];
  if (uniqueIds.length === 0) return;
  if (recipeId && uniqueIds.includes(recipeId)) throw new Error("Una ricetta non può contenere sé stessa.");
  const [owned, current] = await Promise.all([
    database
      .select({ id: recipe.id, archivedAt: recipe.archivedAt })
      .from(recipe)
      .where(and(eq(recipe.ownerId, userId), inArray(recipe.id, uniqueIds))),
    recipeId
      ? database
          .select({ subRecipeId: recipeIngredient.subRecipeId })
          .from(recipeIngredient)
          .where(eq(recipeIngredient.recipeId, recipeId))
      : Promise.resolve([]),
  ]);
  const alreadyUsed = new Set(current.map((row) => row.subRecipeId));
  const available = owned.filter((row) => !row.archivedAt || alreadyUsed.has(row.id));
  if (available.length !== uniqueIds.length) throw new Error("Una delle ricette usate come ingrediente non è più disponibile.");
  if (recipeId && createsRecipeCycle(recipeId, uniqueIds, await subRecipeEdges(userId))) {
    throw new Error("Una delle ricette usate come ingrediente contiene già questa ricetta.");
  }
}

async function assertIngredientsAllowed(userId: string, recipeId: string | null, input: ParsedRecipeInput) {
  await Promise.all([
    assertFoodsVisible(
      userId,
      input.ingredients.flatMap((ingredient) => (ingredient.foodId ? [ingredient.foodId] : [])),
    ),
    assertSubRecipesAllowed(
      userId,
      recipeId,
      input.ingredients.flatMap((ingredient) => (ingredient.recipeId ? [ingredient.recipeId] : [])),
    ),
  ]);
}

function toIngredientValues(recipeId: string, input: ParsedRecipeInput) {
  return input.ingredients.map((ingredient, position) => ({
    recipeId,
    foodId: ingredient.foodId ?? null,
    subRecipeId: ingredient.recipeId ?? null,
    grams: ingredient.grams,
    position,
  }));
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
  await assertIngredientsAllowed(userId, null, parsed);
  return database.transaction(async (transaction) => {
    const [created] = await transaction
      .insert(recipe)
      .values({ ...toRecipeValues(parsed), ownerId: userId })
      .returning({ id: recipe.id });
    await transaction.insert(recipeIngredient).values(toIngredientValues(created.id, parsed));
    return created.id;
  });
}

export async function editRecipe(userId: string, recipeId: string, input: RecipeInput) {
  const parsed = recipeInputSchema.parse(input);
  const id = z.uuid().parse(recipeId);
  await assertIngredientsAllowed(userId, id, parsed);
  await database.transaction(async (transaction) => {
    const updated = await transaction
      .update(recipe)
      .set(toRecipeValues(parsed))
      .where(and(eq(recipe.id, id), eq(recipe.ownerId, userId), isNull(recipe.archivedAt)))
      .returning({ id: recipe.id });
    if (updated.length === 0) throw new Error("Ricetta non trovata.");
    await transaction.delete(recipeIngredient).where(eq(recipeIngredient.recipeId, id));
    await transaction.insert(recipeIngredient).values(toIngredientValues(id, parsed));
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
