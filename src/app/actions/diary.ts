"use server";

import { and, eq } from "drizzle-orm";
import { refresh } from "next/cache";
import { z } from "zod";
import { database } from "@/db";
import { diaryEntry } from "@/db/schema";
import { requireUserId } from "@/lib/auth/session";
import { isIsoDate } from "@/lib/nutrition/days";
import { mealTypes } from "@/lib/nutrition/meals";
import {
  multiplyNutrients,
  type Nutrients,
  roundNutrients,
  scaleNutrients,
} from "@/lib/nutrition/nutrients";
import { recipePortionNutrients, type RecipeNutrition } from "@/lib/nutrition/recipe";
import { getVisibleFood } from "@/server/foods";
import { getLoggableRecipe } from "@/server/recipes";

export type ActionResult<T = undefined> = { ok: true; data: T } | { ok: false; error: string };

const isoDate = z.string().refine(isIsoDate, "Data non valida");
const meal = z.enum(mealTypes);
const quantity = z.number().positive().max(10_000);

const addEntrySchema = z.object({
  day: isoDate,
  meal,
  item: z.discriminatedUnion("type", [
    z.object({
      type: z.literal("food"),
      foodId: z.uuid(),
      grams: quantity,
      portionLabel: z.string().max(80).nullish(),
    }),
    z.object({
      type: z.literal("recipe"),
      recipeId: z.uuid(),
      grams: quantity.nullish(),
      servings: z.number().positive().max(100).nullish(),
    }),
    z.object({
      type: z.literal("quick"),
      label: z.string().trim().max(80).nullish(),
      kcal: z.number().min(0).max(20_000),
      protein: z.number().min(0).max(2_000).nullish(),
      carbs: z.number().min(0).max(2_000).nullish(),
      fat: z.number().min(0).max(2_000).nullish(),
    }),
  ]),
});

export type AddEntryInput = z.input<typeof addEntrySchema>;

function recipeNutritionFromLoggable(recipe: NonNullable<Awaited<ReturnType<typeof getLoggableRecipe>>>) {
  return {
    total: multiplyNutrients(recipe.perServing, recipe.servings),
    rawWeightG: recipe.finalWeightG,
    finalWeightG: recipe.finalWeightG,
    per100g: recipe.per100,
    perServing: recipe.perServing,
    servings: recipe.servings,
  } satisfies RecipeNutrition;
}

function failure(error: unknown): { ok: false; error: string } {
  if (error instanceof z.ZodError) return { ok: false, error: "Controlla i valori inseriti." };
  if (error instanceof Error) return { ok: false, error: error.message };
  return { ok: false, error: "Qualcosa non ha funzionato. Riprova." };
}

async function resolveEntryValues(userId: string, item: z.infer<typeof addEntrySchema>["item"]) {
  if (item.type === "food") {
    const foodRow = await getVisibleFood(userId, item.foodId);
    if (!foodRow) throw new Error("Alimento non trovato.");
    const per100: Nutrients = {
      kcal: foodRow.kcal,
      protein: foodRow.protein,
      carbs: foodRow.carbs,
      fat: foodRow.fat,
    };
    return {
      kind: "food" as const,
      foodId: foodRow.id,
      recipeId: null,
      label: foodRow.brand ? `${foodRow.name}, ${foodRow.brand}` : foodRow.name,
      grams: item.grams,
      servings: null,
      portionLabel: item.portionLabel ?? null,
      nutrients: scaleNutrients(per100, item.grams),
    };
  }

  if (item.type === "recipe") {
    const recipe = await getLoggableRecipe(userId, item.recipeId);
    if (!recipe) throw new Error("Ricetta non trovata.");
    const nutrition = recipeNutritionFromLoggable(recipe);
    const portion = item.grams ? { grams: item.grams } : { servings: item.servings ?? 1 };
    return {
      kind: "recipe" as const,
      foodId: null,
      recipeId: recipe.id,
      label: recipe.name,
      grams: item.grams ?? null,
      servings: item.grams ? null : (item.servings ?? 1),
      portionLabel: null,
      nutrients: recipePortionNutrients(nutrition, portion),
    };
  }

  return {
    kind: "quick" as const,
    foodId: null,
    recipeId: null,
    label: item.label || "Kcal veloci",
    grams: null,
    servings: null,
    portionLabel: null,
    nutrients: {
      kcal: item.kcal,
      protein: item.protein ?? 0,
      carbs: item.carbs ?? 0,
      fat: item.fat ?? 0,
    },
  };
}

export async function addDiaryEntry(input: AddEntryInput): Promise<ActionResult<{ id: string }>> {
  try {
    const userId = await requireUserId();
    const { day, meal: mealType, item } = addEntrySchema.parse(input);
    const { nutrients, ...values } = await resolveEntryValues(userId, item);
    const [created] = await database
      .insert(diaryEntry)
      .values({ ...values, ...roundNutrients(nutrients), userId, day, meal: mealType })
      .returning({ id: diaryEntry.id });
    refresh();
    return { ok: true, data: { id: created.id } };
  } catch (error) {
    return failure(error);
  }
}

const updateEntrySchema = z.object({
  id: z.uuid(),
  meal,
  grams: quantity.nullish(),
  servings: z.number().positive().max(100).nullish(),
  kcal: z.number().min(0).max(20_000).nullish(),
});

export type UpdateEntryInput = z.input<typeof updateEntrySchema>;

export async function updateDiaryEntry(input: UpdateEntryInput): Promise<ActionResult> {
  try {
    const userId = await requireUserId();
    const update = updateEntrySchema.parse(input);
    const [entry] = await database
      .select()
      .from(diaryEntry)
      .where(and(eq(diaryEntry.id, update.id), eq(diaryEntry.userId, userId)));
    if (!entry) throw new Error("Voce non trovata.");

    const snapshot: Nutrients = {
      kcal: entry.kcal,
      protein: entry.protein,
      carbs: entry.carbs,
      fat: entry.fat,
    };
    let nutrients = snapshot;
    let grams = entry.grams;
    let servings = entry.servings;
    let portionLabel = entry.portionLabel;

    if (entry.kind === "quick") {
      if (update.kcal !== null && update.kcal !== undefined) {
        nutrients = entry.kcal > 0 ? multiplyNutrients(snapshot, update.kcal / entry.kcal) : { ...snapshot, kcal: update.kcal };
      }
    } else if (entry.kind === "food" && update.grams) {
      const foodRow = entry.foodId ? await getVisibleFood(userId, entry.foodId) : null;
      nutrients = foodRow
        ? scaleNutrients(foodRow, update.grams)
        : multiplyNutrients(snapshot, entry.grams ? update.grams / entry.grams : 1);
      if (update.grams !== entry.grams) portionLabel = null;
      grams = update.grams;
    } else if (entry.kind === "recipe" && (update.grams || update.servings)) {
      const recipe = entry.recipeId ? await getLoggableRecipe(userId, entry.recipeId) : null;
      const portion = update.grams ? { grams: update.grams } : { servings: update.servings! };
      if (recipe) {
        nutrients = recipePortionNutrients(recipeNutritionFromLoggable(recipe), portion);
      } else {
        const previous = entry.grams ?? entry.servings ?? 1;
        const next = update.grams ?? update.servings ?? 1;
        nutrients = multiplyNutrients(snapshot, next / previous);
      }
      grams = update.grams ?? null;
      servings = update.grams ? null : (update.servings ?? null);
    }

    await database
      .update(diaryEntry)
      .set({ meal: update.meal, grams, servings, portionLabel, ...roundNutrients(nutrients) })
      .where(and(eq(diaryEntry.id, entry.id), eq(diaryEntry.userId, userId)));
    refresh();
    return { ok: true, data: undefined };
  } catch (error) {
    return failure(error);
  }
}

export type DeletedEntry = typeof diaryEntry.$inferSelect;

export async function deleteDiaryEntry(id: string): Promise<ActionResult<DeletedEntry>> {
  try {
    const userId = await requireUserId();
    const entryId = z.uuid().parse(id);
    const [deleted] = await database
      .delete(diaryEntry)
      .where(and(eq(diaryEntry.id, entryId), eq(diaryEntry.userId, userId)))
      .returning();
    if (!deleted) throw new Error("Voce non trovata.");
    refresh();
    return { ok: true, data: deleted };
  } catch (error) {
    return failure(error);
  }
}

export async function restoreDiaryEntry(entry: DeletedEntry): Promise<ActionResult> {
  try {
    const userId = await requireUserId();
    const day = isoDate.parse(entry.day);
    const mealType = meal.parse(entry.meal);
    await database
      .insert(diaryEntry)
      .values({
        userId,
        day,
        meal: mealType,
        kind: z.enum(["food", "recipe", "quick"]).parse(entry.kind),
        foodId: entry.foodId ? z.uuid().parse(entry.foodId) : null,
        recipeId: entry.recipeId ? z.uuid().parse(entry.recipeId) : null,
        label: z.string().max(200).parse(entry.label),
        grams: entry.grams,
        servings: entry.servings,
        portionLabel: entry.portionLabel,
        kcal: z.number().min(0).parse(entry.kcal),
        protein: entry.protein,
        carbs: entry.carbs,
        fat: entry.fat,
      })
      .onConflictDoNothing();
    refresh();
    return { ok: true, data: undefined };
  } catch (error) {
    return failure(error);
  }
}

const copyMealSchema = z.object({
  fromDay: isoDate,
  fromMeal: meal,
  toDay: isoDate,
  toMeal: meal,
});

export async function copyMeal(input: z.input<typeof copyMealSchema>): Promise<ActionResult<{ copied: number }>> {
  try {
    const userId = await requireUserId();
    const { fromDay, fromMeal, toDay, toMeal } = copyMealSchema.parse(input);
    const source = await database
      .select()
      .from(diaryEntry)
      .where(and(eq(diaryEntry.userId, userId), eq(diaryEntry.day, fromDay), eq(diaryEntry.meal, fromMeal)));
    if (source.length === 0) return { ok: true, data: { copied: 0 } };
    await database.insert(diaryEntry).values(
      source.map((entry) => ({
        userId,
        day: toDay,
        meal: toMeal,
        kind: entry.kind,
        foodId: entry.foodId,
        recipeId: entry.recipeId,
        label: entry.label,
        grams: entry.grams,
        servings: entry.servings,
        portionLabel: entry.portionLabel,
        kcal: entry.kcal,
        protein: entry.protein,
        carbs: entry.carbs,
        fat: entry.fat,
      })),
    );
    refresh();
    return { ok: true, data: { copied: source.length } };
  } catch (error) {
    return failure(error);
  }
}
