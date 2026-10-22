import "server-only";
import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { database } from "@/db";
import { diaryEntry, food, savedMeal, savedMealItem } from "@/db/schema";
import { isIsoDate } from "@/lib/nutrition/days";
import { type MealType, mealTypes } from "@/lib/nutrition/meals";
import { multiplyNutrients, type Nutrients, scaleNutrients, sumNutrients } from "@/lib/nutrition/nutrients";
import type { EntryItem } from "./diary-entries";
import { listLoggableRecipes } from "./recipes";

export type SavedMealItemView = {
  id: string;
  type: "food" | "recipe";
  referenceId: string;
  name: string;
  grams: number | null;
  servings: number | null;
  nutrients: Nutrients;
};

export type SavedMealView = {
  id: string;
  name: string;
  defaultMeal: MealType | null;
  items: SavedMealItemView[];
  totals: Nutrients;
};

async function loadSavedMeals(userId: string, savedMealIds?: string[]): Promise<SavedMealView[]> {
  const meals = await database
    .select()
    .from(savedMeal)
    .where(
      and(eq(savedMeal.userId, userId), savedMealIds ? inArray(savedMeal.id, savedMealIds) : undefined),
    )
    .orderBy(desc(savedMeal.updatedAt));
  if (meals.length === 0) return [];

  const items = await database
    .select({
      id: savedMealItem.id,
      savedMealId: savedMealItem.savedMealId,
      foodId: savedMealItem.foodId,
      recipeId: savedMealItem.recipeId,
      grams: savedMealItem.grams,
      servings: savedMealItem.servings,
      foodName: food.name,
      kcal: food.kcal,
      protein: food.protein,
      carbs: food.carbs,
      fat: food.fat,
    })
    .from(savedMealItem)
    .leftJoin(food, eq(food.id, savedMealItem.foodId))
    .where(
      inArray(
        savedMealItem.savedMealId,
        meals.map((meal) => meal.id),
      ),
    )
    .orderBy(asc(savedMealItem.position));

  const recipes = items.some((item) => item.recipeId) ? await listLoggableRecipes(userId) : [];
  const recipeById = new Map(recipes.map((recipe) => [recipe.id, recipe]));

  return meals.map((meal) => {
    const views: SavedMealItemView[] = [];
    for (const item of items.filter((candidate) => candidate.savedMealId === meal.id)) {
      if (item.foodId && item.foodName !== null) {
        views.push({
          id: item.id,
          type: "food",
          referenceId: item.foodId,
          name: item.foodName,
          grams: item.grams,
          servings: null,
          nutrients: scaleNutrients(
            { kcal: item.kcal ?? 0, protein: item.protein ?? 0, carbs: item.carbs ?? 0, fat: item.fat ?? 0 },
            item.grams ?? 0,
          ),
        });
      } else if (item.recipeId) {
        const recipe = recipeById.get(item.recipeId);
        if (!recipe) continue;
        views.push({
          id: item.id,
          type: "recipe",
          referenceId: recipe.id,
          name: recipe.name,
          grams: item.grams,
          servings: item.servings,
          nutrients: item.grams
            ? scaleNutrients(recipe.per100, item.grams)
            : multiplyNutrients(recipe.perServing, item.servings ?? 1),
        });
      }
    }
    return {
      id: meal.id,
      name: meal.name,
      defaultMeal: meal.defaultMeal,
      items: views,
      totals: sumNutrients(views.map((view) => view.nutrients)),
    };
  });
}

export async function listSavedMeals(userId: string) {
  const meals = await loadSavedMeals(userId);
  return meals.map((meal) => ({
    id: meal.id,
    name: meal.name,
    itemCount: meal.items.length,
    kcal: meal.totals.kcal,
  }));
}

export async function listSavedMealViews(userId: string) {
  return loadSavedMeals(userId);
}

export async function getSavedMeal(userId: string, savedMealId: string) {
  const [meal] = await loadSavedMeals(userId, [savedMealId]);
  return meal ?? null;
}

export function savedMealEntryItems(saved: SavedMealView): EntryItem[] {
  return saved.items.map((item) =>
    item.type === "food"
      ? { type: "food", foodId: item.referenceId, grams: item.grams ?? 100 }
      : { type: "recipe", recipeId: item.referenceId, grams: item.grams, servings: item.servings },
  );
}

export async function markSavedMealUsed(savedMealId: string) {
  await database.update(savedMeal).set({ updatedAt: new Date() }).where(eq(savedMeal.id, savedMealId));
}

const savedMealName = z.string().trim().min(1, "Dai un nome al pasto.").max(80);

const saveFromDiarySchema = z.object({
  day: z.string().refine(isIsoDate, "Data non valida"),
  meal: z.enum(mealTypes),
  name: savedMealName,
});

export type SaveMealFromDiaryInput = z.input<typeof saveFromDiarySchema>;

export async function saveMealFromEntries(userId: string, input: SaveMealFromDiaryInput) {
  const { day, meal, name } = saveFromDiarySchema.parse(input);
  const entries = await database
    .select()
    .from(diaryEntry)
    .where(and(eq(diaryEntry.userId, userId), eq(diaryEntry.day, day), eq(diaryEntry.meal, meal)))
    .orderBy(diaryEntry.createdAt);
  const items = entries.filter(
    (entry) => (entry.kind === "food" && entry.foodId) || (entry.kind === "recipe" && entry.recipeId),
  );
  if (items.length === 0) throw new Error("Questo pasto non ha alimenti da salvare.");

  const id = await database.transaction(async (transaction) => {
    const [created] = await transaction
      .insert(savedMeal)
      .values({ userId, name, defaultMeal: meal })
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
  return { id, itemCount: items.length, skippedCount: entries.length - items.length };
}

const updateSavedMealSchema = z.object({
  savedMealId: z.uuid(),
  name: savedMealName,
  removedItemIds: z.array(z.uuid()).max(100),
});

export type SavedMealUpdate = z.input<typeof updateSavedMealSchema>;

export async function editSavedMeal(userId: string, input: SavedMealUpdate) {
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
}

export async function removeSavedMeal(userId: string, savedMealId: string) {
  const [deleted] = await database
    .delete(savedMeal)
    .where(and(eq(savedMeal.id, z.uuid().parse(savedMealId)), eq(savedMeal.userId, userId)))
    .returning({ id: savedMeal.id, name: savedMeal.name });
  if (!deleted) throw new Error("Pasto salvato non trovato.");
  return deleted;
}
