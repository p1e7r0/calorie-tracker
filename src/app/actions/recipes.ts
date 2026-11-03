"use server";

import { and, eq, isNull } from "drizzle-orm";
import { refresh } from "next/cache";
import { z } from "zod";
import { database } from "@/db";
import { recipe, recipeIngredient } from "@/db/schema";
import { requireUserId } from "@/lib/auth/session";
import { archiveOwnRecipe, editRecipe, insertRecipe, type RecipeInput } from "@/server/recipe-writes";
import type { ActionResult } from "./diary";

export type { RecipeInput };

function failure(error: unknown): { ok: false; error: string } {
  if (error instanceof z.ZodError) return { ok: false, error: error.issues[0]?.message ?? "Controlla i valori." };
  if (error instanceof Error) return { ok: false, error: error.message };
  return { ok: false, error: "Qualcosa non ha funzionato. Riprova." };
}

export async function createRecipe(input: RecipeInput): Promise<ActionResult<{ id: string }>> {
  try {
    const userId = await requireUserId();
    const id = await insertRecipe(userId, input);
    refresh();
    return { ok: true, data: { id } };
  } catch (error) {
    return failure(error);
  }
}

export async function updateRecipe(recipeId: string, input: RecipeInput): Promise<ActionResult<{ id: string }>> {
  try {
    const userId = await requireUserId();
    const id = await editRecipe(userId, recipeId, input);
    refresh();
    return { ok: true, data: { id } };
  } catch (error) {
    return failure(error);
  }
}

export async function archiveRecipe(recipeId: string): Promise<ActionResult> {
  try {
    const userId = await requireUserId();
    await archiveOwnRecipe(userId, recipeId);
    refresh();
    return { ok: true, data: undefined };
  } catch (error) {
    return failure(error);
  }
}

export async function duplicateRecipe(recipeId: string): Promise<ActionResult<{ id: string }>> {
  try {
    const userId = await requireUserId();
    const sourceId = z.uuid().parse(recipeId);
    const id = await database.transaction(async (transaction) => {
      const [source] = await transaction
        .select()
        .from(recipe)
        .where(and(eq(recipe.id, sourceId), eq(recipe.ownerId, userId), isNull(recipe.archivedAt)));
      if (!source) throw new Error("Ricetta non trovata.");
      const ingredients = await transaction
        .select({ foodId: recipeIngredient.foodId, grams: recipeIngredient.grams, position: recipeIngredient.position })
        .from(recipeIngredient)
        .where(eq(recipeIngredient.recipeId, sourceId));
      const [created] = await transaction
        .insert(recipe)
        .values({
          ownerId: userId,
          name: `${source.name} (copia)`.slice(0, 120),
          servings: source.servings,
          cookedWeightG: source.cookedWeightG,
          servingGrams: source.servingGrams,
          notes: source.notes,
        })
        .returning({ id: recipe.id });
      if (ingredients.length > 0) {
        await transaction
          .insert(recipeIngredient)
          .values(ingredients.map((ingredient) => ({ ...ingredient, recipeId: created.id })));
      }
      return created.id;
    });
    refresh();
    return { ok: true, data: { id } };
  } catch (error) {
    return failure(error);
  }
}
