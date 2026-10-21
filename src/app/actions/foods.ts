"use server";

import { and, eq, isNull } from "drizzle-orm";
import { refresh } from "next/cache";
import { z } from "zod";
import { database } from "@/db";
import { favoriteFood, favoriteRecipe, food, foodPortion, recipe } from "@/db/schema";
import { requireUserId } from "@/lib/auth/session";
import { type FoodInput, foodInputSchema, insertFood, toFoodValues } from "@/server/food-writes";
import { getVisibleFood } from "@/server/foods";
import type { ActionResult } from "./diary";

export type { FoodInput };

function failure(error: unknown): { ok: false; error: string } {
  if (error instanceof z.ZodError) {
    return { ok: false, error: error.issues[0]?.message ?? "Controlla i valori inseriti." };
  }
  if (error instanceof Error) return { ok: false, error: error.message };
  return { ok: false, error: "Qualcosa non ha funzionato. Riprova." };
}

export async function createFood(input: FoodInput): Promise<ActionResult<{ id: string }>> {
  try {
    const userId = await requireUserId();
    const id = await insertFood(userId, input);
    refresh();
    return { ok: true, data: { id } };
  } catch (error) {
    return failure(error);
  }
}

export async function updateFood(foodId: string, input: FoodInput): Promise<ActionResult<{ id: string }>> {
  try {
    const userId = await requireUserId();
    const parsed = foodInputSchema.parse(input);
    const existing = await getVisibleFood(userId, z.uuid().parse(foodId));
    if (!existing) throw new Error("Alimento non trovato.");

    const id = await database.transaction(async (transaction) => {
      let targetId = existing.id;
      if (existing.ownerId === userId) {
        await transaction.update(food).set(toFoodValues(parsed)).where(eq(food.id, existing.id));
        await transaction.delete(foodPortion).where(eq(foodPortion.foodId, existing.id));
      } else {
        const [copy] = await transaction
          .insert(food)
          .values({
            ...toFoodValues(parsed),
            ownerId: userId,
            source: "user",
            replacesFoodId: existing.id,
            category: existing.category,
            micronutrients: existing.micronutrients,
          })
          .returning({ id: food.id });
        targetId = copy.id;
        const [wasFavorite] = await transaction
          .select()
          .from(favoriteFood)
          .where(and(eq(favoriteFood.userId, userId), eq(favoriteFood.foodId, existing.id)));
        if (wasFavorite) {
          await transaction.insert(favoriteFood).values({ userId, foodId: targetId }).onConflictDoNothing();
        }
      }
      if (parsed.portions.length > 0) {
        await transaction
          .insert(foodPortion)
          .values(parsed.portions.map((portion, position) => ({ ...portion, position, foodId: targetId })));
      }
      return targetId;
    });
    refresh();
    return { ok: true, data: { id } };
  } catch (error) {
    return failure(error);
  }
}

export async function archiveFood(foodId: string): Promise<ActionResult> {
  try {
    const userId = await requireUserId();
    const archived = await database
      .update(food)
      .set({ archivedAt: new Date() })
      .where(and(eq(food.id, z.uuid().parse(foodId)), eq(food.ownerId, userId), isNull(food.archivedAt)))
      .returning({ id: food.id });
    if (archived.length === 0) throw new Error("Puoi eliminare solo gli alimenti che hai creato tu.");
    refresh();
    return { ok: true, data: undefined };
  } catch (error) {
    return failure(error);
  }
}

export async function setFoodFavorite(foodId: string, favorite: boolean): Promise<ActionResult> {
  try {
    const userId = await requireUserId();
    const visible = await getVisibleFood(userId, z.uuid().parse(foodId));
    if (!visible) throw new Error("Alimento non trovato.");
    if (favorite) {
      await database.insert(favoriteFood).values({ userId, foodId: visible.id }).onConflictDoNothing();
    } else {
      await database
        .delete(favoriteFood)
        .where(and(eq(favoriteFood.userId, userId), eq(favoriteFood.foodId, visible.id)));
    }
    refresh();
    return { ok: true, data: undefined };
  } catch (error) {
    return failure(error);
  }
}

export async function setRecipeFavorite(recipeId: string, favorite: boolean): Promise<ActionResult> {
  try {
    const userId = await requireUserId();
    const [owned] = await database
      .select({ id: recipe.id })
      .from(recipe)
      .where(and(eq(recipe.id, z.uuid().parse(recipeId)), eq(recipe.ownerId, userId)));
    if (!owned) throw new Error("Ricetta non trovata.");
    if (favorite) {
      await database.insert(favoriteRecipe).values({ userId, recipeId: owned.id }).onConflictDoNothing();
    } else {
      await database
        .delete(favoriteRecipe)
        .where(and(eq(favoriteRecipe.userId, userId), eq(favoriteRecipe.recipeId, owned.id)));
    }
    refresh();
    return { ok: true, data: undefined };
  } catch (error) {
    return failure(error);
  }
}
