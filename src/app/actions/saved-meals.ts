"use server";

import { and, eq, inArray } from "drizzle-orm";
import { refresh } from "next/cache";
import { z } from "zod";
import { database } from "@/db";
import { diaryEntry, savedMeal, savedMealItem } from "@/db/schema";
import { requireUserId } from "@/lib/auth/session";
import { isIsoDate } from "@/lib/nutrition/days";
import { mealTypes } from "@/lib/nutrition/meals";
import { roundNutrients } from "@/lib/nutrition/nutrients";
import { resolveEntryValues } from "@/server/diary-entries";
import { getSavedMeal } from "@/server/saved-meals";
import type { ActionResult } from "./diary";

const isoDate = z.string().refine(isIsoDate, "Data non valida");
const meal = z.enum(mealTypes);

function failure(error: unknown): { ok: false; error: string } {
  if (error instanceof z.ZodError) return { ok: false, error: error.issues[0]?.message ?? "Controlla i valori." };
  if (error instanceof Error) return { ok: false, error: error.message };
  return { ok: false, error: "Qualcosa non ha funzionato. Riprova." };
}

const saveFromDiarySchema = z.object({
  day: isoDate,
  meal,
  name: z.string().trim().min(1, "Dai un nome al pasto.").max(80),
});

export async function saveMealFromDiary(
  input: z.input<typeof saveFromDiarySchema>,
): Promise<ActionResult<{ id: string; itemCount: number }>> {
  try {
    const userId = await requireUserId();
    const { day, meal: mealType, name } = saveFromDiarySchema.parse(input);
    const entries = await database
      .select()
      .from(diaryEntry)
      .where(and(eq(diaryEntry.userId, userId), eq(diaryEntry.day, day), eq(diaryEntry.meal, mealType)))
      .orderBy(diaryEntry.createdAt);
    const items = entries.filter(
      (entry) => (entry.kind === "food" && entry.foodId) || (entry.kind === "recipe" && entry.recipeId),
    );
    if (items.length === 0) throw new Error("Questo pasto non ha alimenti da salvare.");

    const id = await database.transaction(async (transaction) => {
      const [created] = await transaction
        .insert(savedMeal)
        .values({ userId, name, defaultMeal: mealType })
        .returning({ id: savedMeal.id });
      await transaction.insert(savedMealItem).values(
        items.map((entry, position) => ({
          savedMealId: created.id,
          foodId: entry.kind === "food" ? entry.foodId : null,
          recipeId: entry.kind === "recipe" ? entry.recipeId : null,
          grams: entry.grams,
          servings: entry.servings,
          position,
        })),
      );
      return created.id;
    });
    refresh();
    return { ok: true, data: { id, itemCount: items.length } };
  } catch (error) {
    return failure(error);
  }
}

const logSavedMealSchema = z.object({ savedMealId: z.uuid(), day: isoDate, meal });

export async function logSavedMeal(
  input: z.input<typeof logSavedMealSchema>,
): Promise<ActionResult<{ logged: number }>> {
  try {
    const userId = await requireUserId();
    const { savedMealId, day, meal: mealType } = logSavedMealSchema.parse(input);
    const saved = await getSavedMeal(userId, savedMealId);
    if (!saved) throw new Error("Pasto salvato non trovato.");
    if (saved.items.length === 0) throw new Error("Questo pasto salvato è vuoto.");

    const values = await Promise.all(
      saved.items.map((item) =>
        resolveEntryValues(
          userId,
          item.type === "food"
            ? { type: "food", foodId: item.referenceId, grams: item.grams ?? 100 }
            : { type: "recipe", recipeId: item.referenceId, grams: item.grams, servings: item.servings },
        ),
      ),
    );
    await database.insert(diaryEntry).values(
      values.map(({ nutrients, ...entry }) => ({
        ...entry,
        ...roundNutrients(nutrients),
        userId,
        day,
        meal: mealType,
      })),
    );
    await database.update(savedMeal).set({ updatedAt: new Date() }).where(eq(savedMeal.id, saved.id));
    refresh();
    return { ok: true, data: { logged: values.length } };
  } catch (error) {
    return failure(error);
  }
}

const updateSavedMealSchema = z.object({
  savedMealId: z.uuid(),
  name: z.string().trim().min(1, "Dai un nome al pasto.").max(80),
  removedItemIds: z.array(z.uuid()).max(100),
});

export async function updateSavedMeal(input: z.input<typeof updateSavedMealSchema>): Promise<ActionResult> {
  try {
    const userId = await requireUserId();
    const { savedMealId, name, removedItemIds } = updateSavedMealSchema.parse(input);
    await database.transaction(async (transaction) => {
      const updated = await transaction
        .update(savedMeal)
        .set({ name })
        .where(and(eq(savedMeal.id, savedMealId), eq(savedMeal.userId, userId)))
        .returning({ id: savedMeal.id });
      if (updated.length === 0) throw new Error("Pasto salvato non trovato.");
      if (removedItemIds.length > 0) {
        await transaction
          .delete(savedMealItem)
          .where(and(eq(savedMealItem.savedMealId, savedMealId), inArray(savedMealItem.id, removedItemIds)));
      }
    });
    refresh();
    return { ok: true, data: undefined };
  } catch (error) {
    return failure(error);
  }
}

export async function deleteSavedMeal(savedMealId: string): Promise<ActionResult> {
  try {
    const userId = await requireUserId();
    const deleted = await database
      .delete(savedMeal)
      .where(and(eq(savedMeal.id, z.uuid().parse(savedMealId)), eq(savedMeal.userId, userId)))
      .returning({ id: savedMeal.id });
    if (deleted.length === 0) throw new Error("Pasto salvato non trovato.");
    refresh();
    return { ok: true, data: undefined };
  } catch (error) {
    return failure(error);
  }
}
