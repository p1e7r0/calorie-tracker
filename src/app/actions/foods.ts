"use server";

import { and, eq, isNull } from "drizzle-orm";
import { refresh } from "next/cache";
import { z } from "zod";
import { database } from "@/db";
import { favoriteFood, favoriteRecipe, food, foodPortion, recipe } from "@/db/schema";
import { requireUserId } from "@/lib/auth/session";
import { getVisibleFood } from "@/server/foods";
import type { ActionResult } from "./diary";

const optionalNutrient = z.number().min(0).max(1000).nullish();

const foodSchema = z.object({
  name: z.string().trim().min(1, "Dai un nome all'alimento.").max(120),
  brand: z.string().trim().max(80).nullish(),
  barcode: z
    .string()
    .trim()
    .regex(/^\d{6,14}$/)
    .nullish(),
  unit: z.enum(["g", "ml"]),
  kcal: z.number().min(0).max(1000),
  protein: z.number().min(0).max(100),
  carbs: z.number().min(0).max(100),
  sugars: optionalNutrient,
  fat: z.number().min(0).max(100),
  saturatedFat: optionalNutrient,
  fiber: optionalNutrient,
  salt: optionalNutrient,
  portions: z
    .array(z.object({ label: z.string().trim().min(1).max(40), grams: z.number().positive().max(5000) }))
    .max(10),
});

export type FoodInput = z.input<typeof foodSchema>;

function failure(error: unknown): { ok: false; error: string } {
  if (error instanceof z.ZodError) {
    return { ok: false, error: error.issues[0]?.message ?? "Controlla i valori inseriti." };
  }
  if (error instanceof Error) return { ok: false, error: error.message };
  return { ok: false, error: "Qualcosa non ha funzionato. Riprova." };
}

function toFoodValues(input: z.infer<typeof foodSchema>) {
  return {
    name: input.name,
    brand: input.brand || null,
    barcode: input.barcode || null,
    unit: input.unit,
    kcal: input.kcal,
    protein: input.protein,
    carbs: input.carbs,
    sugars: input.sugars ?? null,
    fat: input.fat,
    saturatedFat: input.saturatedFat ?? null,
    fiber: input.fiber ?? null,
    salt: input.salt ?? null,
  };
}

export async function createFood(input: FoodInput): Promise<ActionResult<{ id: string }>> {
  try {
    const userId = await requireUserId();
    const parsed = foodSchema.parse(input);
    const id = await database.transaction(async (transaction) => {
      const [created] = await transaction
        .insert(food)
        .values({ ...toFoodValues(parsed), ownerId: userId, source: "user" })
        .returning({ id: food.id });
      if (parsed.portions.length > 0) {
        await transaction
          .insert(foodPortion)
          .values(parsed.portions.map((portion, position) => ({ ...portion, position, foodId: created.id })));
      }
      return created.id;
    });
    refresh();
    return { ok: true, data: { id } };
  } catch (error) {
    return failure(error);
  }
}

export async function updateFood(foodId: string, input: FoodInput): Promise<ActionResult<{ id: string }>> {
  try {
    const userId = await requireUserId();
    const parsed = foodSchema.parse(input);
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
