"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { requireUserId } from "@/lib/auth/session";
import { archiveOwnFood, editFood, type FoodInput, insertFood, markFoodFavorite } from "@/server/food-writes";
import { markRecipeFavorite } from "@/server/recipe-writes";
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
    const id = await editFood(userId, foodId, input);
    refresh();
    return { ok: true, data: { id } };
  } catch (error) {
    return failure(error);
  }
}

export async function archiveFood(foodId: string): Promise<ActionResult> {
  try {
    const userId = await requireUserId();
    await archiveOwnFood(userId, foodId);
    refresh();
    return { ok: true, data: undefined };
  } catch (error) {
    return failure(error);
  }
}

export async function setFoodFavorite(foodId: string, favorite: boolean): Promise<ActionResult> {
  try {
    const userId = await requireUserId();
    await markFoodFavorite(userId, foodId, favorite);
    refresh();
    return { ok: true, data: undefined };
  } catch (error) {
    return failure(error);
  }
}

export async function setRecipeFavorite(recipeId: string, favorite: boolean): Promise<ActionResult> {
  try {
    const userId = await requireUserId();
    await markRecipeFavorite(userId, recipeId, favorite);
    refresh();
    return { ok: true, data: undefined };
  } catch (error) {
    return failure(error);
  }
}
