import "server-only";
import { and, eq, inArray, isNull } from "drizzle-orm";
import { z } from "zod";
import { database } from "@/db";
import { favoriteRecipe, food, recipe, recipeIngredient } from "@/db/schema";
import { visibleFoodCondition } from "./foods";
import { subRecipeValues } from "./recipes";

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
          ingredientId: z.uuid().nullish(),
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

type FrozenValues = Omit<typeof recipeIngredient.$inferInsert, "id" | "recipeId" | "foodId" | "subRecipeId" | "grams" | "position">;

async function subRecipeIngredientValues(userId: string, recipeId: string | null, input: ParsedRecipeInput) {
  const subRecipeIngredients = input.ingredients.filter((ingredient) => ingredient.recipeId);
  if (subRecipeIngredients.length === 0) return new Map<number, FrozenValues>();
  if (recipeId && subRecipeIngredients.some((ingredient) => ingredient.recipeId === recipeId)) {
    throw new Error("Una ricetta non può contenere sé stessa.");
  }
  const existing = recipeId
    ? await database.select().from(recipeIngredient).where(eq(recipeIngredient.recipeId, recipeId))
    : [];
  const existingById = new Map(existing.map((row) => [row.id, row]));
  const kept = (ingredient: ParsedRecipeInput["ingredients"][number]) => {
    const row = ingredient.ingredientId ? existingById.get(ingredient.ingredientId) : undefined;
    return row && row.subRecipeId === ingredient.recipeId ? row : null;
  };
  const freshIds = subRecipeIngredients
    .filter((ingredient) => !kept(ingredient))
    .map((ingredient) => ingredient.recipeId!);
  const fresh = await subRecipeValues(userId, [...new Set(freshIds)]);
  const values = new Map<number, FrozenValues>();
  input.ingredients.forEach((ingredient, index) => {
    if (!ingredient.recipeId) return;
    const row = kept(ingredient);
    const source = row ?? fresh.get(ingredient.recipeId);
    if (!source) throw new Error("Una delle ricette usate come ingrediente non è più disponibile.");
    values.set(index, {
      kcal: source.kcal,
      protein: source.protein,
      carbs: source.carbs,
      fat: source.fat,
      fiber: source.fiber,
      sugars: source.sugars,
      saturatedFat: source.saturatedFat,
      salt: source.salt,
    });
  });
  return values;
}

async function prepareIngredients(userId: string, recipeId: string | null, input: ParsedRecipeInput) {
  const [, frozen] = await Promise.all([
    assertFoodsVisible(
      userId,
      input.ingredients.flatMap((ingredient) => (ingredient.foodId ? [ingredient.foodId] : [])),
    ),
    subRecipeIngredientValues(userId, recipeId, input),
  ]);
  return (targetRecipeId: string) =>
    input.ingredients.map((ingredient, position) => ({
      recipeId: targetRecipeId,
      foodId: ingredient.foodId ?? null,
      subRecipeId: ingredient.recipeId ?? null,
      grams: ingredient.grams,
      position,
      ...frozen.get(position),
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
  const ingredientValues = await prepareIngredients(userId, null, parsed);
  return database.transaction(async (transaction) => {
    const [created] = await transaction
      .insert(recipe)
      .values({ ...toRecipeValues(parsed), ownerId: userId })
      .returning({ id: recipe.id });
    await transaction.insert(recipeIngredient).values(ingredientValues(created.id));
    return created.id;
  });
}

export async function editRecipe(userId: string, recipeId: string, input: RecipeInput) {
  const parsed = recipeInputSchema.parse(input);
  const id = z.uuid().parse(recipeId);
  const ingredientValues = await prepareIngredients(userId, id, parsed);
  await database.transaction(async (transaction) => {
    const updated = await transaction
      .update(recipe)
      .set(toRecipeValues(parsed))
      .where(and(eq(recipe.id, id), eq(recipe.ownerId, userId), isNull(recipe.archivedAt)))
      .returning({ id: recipe.id });
    if (updated.length === 0) throw new Error("Ricetta non trovata.");
    await transaction.delete(recipeIngredient).where(eq(recipeIngredient.recipeId, id));
    await transaction.insert(recipeIngredient).values(ingredientValues(id));
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
