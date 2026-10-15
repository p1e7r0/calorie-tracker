"use server";

import { and, eq, inArray, isNull } from "drizzle-orm";
import { refresh } from "next/cache";
import { z } from "zod";
import { database } from "@/db";
import { food, recipe, recipeIngredient } from "@/db/schema";
import { requireUserId } from "@/lib/auth/session";
import { visibleFoodCondition } from "@/server/foods";
import type { ActionResult } from "./diary";

const recipeSchema = z.object({
  name: z.string().trim().min(1, "Dai un nome alla ricetta.").max(120),
  servings: z.number().int().min(1).max(100),
  cookedWeightG: z.number().positive().max(50_000).nullish(),
  notes: z.string().trim().max(2000).nullish(),
  ingredients: z
    .array(z.object({ foodId: z.uuid(), grams: z.number().positive().max(20_000) }))
    .min(1, "Aggiungi almeno un ingrediente.")
    .max(60),
});

export type RecipeInput = z.input<typeof recipeSchema>;

function failure(error: unknown): { ok: false; error: string } {
  if (error instanceof z.ZodError) return { ok: false, error: error.issues[0]?.message ?? "Controlla i valori." };
  if (error instanceof Error) return { ok: false, error: error.message };
  return { ok: false, error: "Qualcosa non ha funzionato. Riprova." };
}

async function assertIngredientsVisible(userId: string, foodIds: string[]) {
  const uniqueIds = [...new Set(foodIds)];
  const visible = await database
    .select({ id: food.id })
    .from(food)
    .where(and(visibleFoodCondition(userId), inArray(food.id, uniqueIds)));
  if (visible.length !== uniqueIds.length) throw new Error("Uno degli ingredienti non è più disponibile.");
}

function toRecipeValues(input: z.infer<typeof recipeSchema>) {
  return {
    name: input.name,
    servings: input.servings,
    cookedWeightG: input.cookedWeightG ?? null,
    notes: input.notes || null,
  };
}

export async function createRecipe(input: RecipeInput): Promise<ActionResult<{ id: string }>> {
  try {
    const userId = await requireUserId();
    const parsed = recipeSchema.parse(input);
    await assertIngredientsVisible(userId, parsed.ingredients.map((ingredient) => ingredient.foodId));
    const id = await database.transaction(async (transaction) => {
      const [created] = await transaction
        .insert(recipe)
        .values({ ...toRecipeValues(parsed), ownerId: userId })
        .returning({ id: recipe.id });
      await transaction
        .insert(recipeIngredient)
        .values(parsed.ingredients.map((ingredient, position) => ({ ...ingredient, position, recipeId: created.id })));
      return created.id;
    });
    refresh();
    return { ok: true, data: { id } };
  } catch (error) {
    return failure(error);
  }
}

export async function updateRecipe(recipeId: string, input: RecipeInput): Promise<ActionResult<{ id: string }>> {
  try {
    const userId = await requireUserId();
    const parsed = recipeSchema.parse(input);
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
    refresh();
    return { ok: true, data: { id } };
  } catch (error) {
    return failure(error);
  }
}

export async function archiveRecipe(recipeId: string): Promise<ActionResult> {
  try {
    const userId = await requireUserId();
    const archived = await database
      .update(recipe)
      .set({ archivedAt: new Date() })
      .where(and(eq(recipe.id, z.uuid().parse(recipeId)), eq(recipe.ownerId, userId), isNull(recipe.archivedAt)))
      .returning({ id: recipe.id });
    if (archived.length === 0) throw new Error("Ricetta non trovata.");
    refresh();
    return { ok: true, data: undefined };
  } catch (error) {
    return failure(error);
  }
}
