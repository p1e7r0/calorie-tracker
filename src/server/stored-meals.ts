import "server-only";
import { and, asc, eq, gt, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import { database } from "@/db";
import { diaryEntry, food, storedMeal, storedMealItem } from "@/db/schema";
import { extrasFromRow, roundExtras } from "@/lib/nutrition/extra-nutrients";
import { isIsoDate, todayIsoDate } from "@/lib/nutrition/days";
import { mealTypes } from "@/lib/nutrition/meals";
import { type Nutrients, roundNutrients, sumNutrients } from "@/lib/nutrition/nutrients";
import {
  maximumStoredPortions,
  type StorageLocation,
  sortStoredMeals,
  storageLocations,
} from "@/lib/nutrition/stored-meals";
import { entryItemSchema, resolveEntryValues } from "./diary-entries";

export type StoredMealItemView = {
  id: string;
  kind: "food" | "recipe" | "quick";
  foodId: string | null;
  recipeId: string | null;
  label: string;
  grams: number | null;
  servings: number | null;
  portionLabel: string | null;
  unit: "g" | "ml";
  nutrients: Nutrients;
};

export type StoredMealView = {
  id: string;
  name: string;
  location: StorageLocation;
  preparedOn: string;
  portions: number;
  items: StoredMealItemView[];
  perPortion: Nutrients;
};

type EntrySource = (typeof diaryEntry.$inferInsert)["source"];

async function loadStoredMeals(userId: string, storedMealIds?: string[]): Promise<StoredMealView[]> {
  const meals = await database
    .select()
    .from(storedMeal)
    .where(
      and(
        eq(storedMeal.userId, userId),
        gt(storedMeal.portions, 0),
        storedMealIds ? inArray(storedMeal.id, storedMealIds) : undefined,
      ),
    );
  if (meals.length === 0) return [];

  const items = await database
    .select({ item: storedMealItem, unit: food.unit })
    .from(storedMealItem)
    .leftJoin(food, eq(food.id, storedMealItem.foodId))
    .where(
      inArray(
        storedMealItem.storedMealId,
        meals.map((meal) => meal.id),
      ),
    )
    .orderBy(asc(storedMealItem.position));

  const views = meals.map((meal) => {
    const mealItems: StoredMealItemView[] = items
      .filter(({ item }) => item.storedMealId === meal.id)
      .map(({ item, unit }) => ({
        id: item.id,
        kind: item.kind,
        foodId: item.foodId,
        recipeId: item.recipeId,
        label: item.label,
        grams: item.grams,
        servings: item.servings,
        portionLabel: item.portionLabel,
        unit: unit ?? "g",
        nutrients: { kcal: item.kcal, protein: item.protein, carbs: item.carbs, fat: item.fat },
      }));
    return {
      id: meal.id,
      name: meal.name,
      location: meal.location,
      preparedOn: meal.preparedOn,
      portions: meal.portions,
      items: mealItems,
      perPortion: sumNutrients(mealItems.map((item) => item.nutrients)),
    };
  });
  return sortStoredMeals(views, todayIsoDate());
}

export async function listStoredMeals(userId: string) {
  return loadStoredMeals(userId);
}

export async function getStoredMeal(userId: string, storedMealId: string) {
  const [meal] = await loadStoredMeals(userId, [z.uuid().parse(storedMealId)]);
  return meal ?? null;
}

const storedMealName = z.string().trim().min(1, "Dai un nome al pasto.").max(80);
const location = z.enum(storageLocations);
const preparedOn = z
  .string()
  .refine(isIsoDate, "Data non valida")
  .refine((day) => day <= todayIsoDate(), "La data di preparazione non può essere nel futuro.");
const portions = z
  .number()
  .int("Le porzioni devono essere un numero intero.")
  .min(1, "Serve almeno una porzione.")
  .max(maximumStoredPortions, `Al massimo ${maximumStoredPortions} porzioni.`);

const createStoredMealSchema = z.object({
  name: storedMealName,
  location,
  preparedOn,
  portions,
  items: z.array(entryItemSchema).min(1, "Aggiungi almeno un alimento o una ricetta.").max(30),
});

export type StoredMealInput = z.input<typeof createStoredMealSchema>;

type ItemSnapshot = Omit<typeof storedMealItem.$inferInsert, "storedMealId" | "position">;

async function resolveItems(userId: string, items: z.infer<typeof entryItemSchema>[]): Promise<ItemSnapshot[]> {
  const resolved = await Promise.all(items.map((item) => resolveEntryValues(userId, item)));
  return resolved.map(({ nutrients, extras, ...values }) => ({
    ...values,
    ...roundNutrients(nutrients),
    ...roundExtras(extras),
  }));
}

async function insertStoredMeal(
  userId: string,
  meal: { name: string; location: StorageLocation; preparedOn: string; portions: number },
  items: ItemSnapshot[],
) {
  return database.transaction(async (transaction) => {
    const [created] = await transaction
      .insert(storedMeal)
      .values({ userId, ...meal })
      .returning({ id: storedMeal.id });
    await transaction
      .insert(storedMealItem)
      .values(items.map((item, position) => ({ ...item, storedMealId: created.id, position })));
    return created.id;
  });
}

export async function createStoredMeal(userId: string, input: StoredMealInput) {
  const { items, ...meal } = createStoredMealSchema.parse(input);
  return insertStoredMeal(userId, meal, await resolveItems(userId, items));
}

const storeFromDiarySchema = z.object({
  day: z.string().refine(isIsoDate, "Data non valida"),
  meal: z.enum(mealTypes),
  name: storedMealName,
  location,
  preparedOn,
  portions,
});

export type StoreMealFromDiaryInput = z.input<typeof storeFromDiarySchema>;

export async function storeMealFromDiary(userId: string, input: StoreMealFromDiaryInput) {
  const { day, meal, ...stored } = storeFromDiarySchema.parse(input);
  const entries = await database
    .select()
    .from(diaryEntry)
    .where(and(eq(diaryEntry.userId, userId), eq(diaryEntry.day, day), eq(diaryEntry.meal, meal)))
    .orderBy(asc(diaryEntry.createdAt));
  if (entries.length === 0) throw new Error("Questo pasto è vuoto.");
  const id = await insertStoredMeal(
    userId,
    stored,
    entries.map((entry) => ({
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
      ...extrasFromRow(entry),
    })),
  );
  return { id, itemCount: entries.length };
}

const updateStoredMealSchema = z.object({
  storedMealId: z.uuid(),
  name: storedMealName,
  location,
  preparedOn,
  portions,
  removedItemIds: z.array(z.uuid()).max(100),
  addedItems: z.array(entryItemSchema).max(30),
});

export type StoredMealUpdate = z.input<typeof updateStoredMealSchema>;

export async function editStoredMeal(userId: string, input: StoredMealUpdate) {
  const { storedMealId, removedItemIds, addedItems, ...meal } = updateStoredMealSchema.parse(input);
  const added = await resolveItems(userId, addedItems);
  await database.transaction(async (transaction) => {
    const updated = await transaction
      .update(storedMeal)
      .set(meal)
      .where(and(eq(storedMeal.id, storedMealId), eq(storedMeal.userId, userId), gt(storedMeal.portions, 0)))
      .returning({ id: storedMeal.id });
    if (updated.length === 0) throw new Error("Pasto messo da parte non trovato.");
    if (removedItemIds.length > 0) {
      await transaction
        .delete(storedMealItem)
        .where(and(eq(storedMealItem.storedMealId, storedMealId), inArray(storedMealItem.id, removedItemIds)));
    }
    const [{ lastPosition, count }] = await transaction
      .select({
        lastPosition: sql<number>`coalesce(max(${storedMealItem.position}), -1)`.mapWith(Number),
        count: sql<number>`count(*)`.mapWith(Number),
      })
      .from(storedMealItem)
      .where(eq(storedMealItem.storedMealId, storedMealId));
    if (count + added.length === 0) throw new Error("Aggiungi almeno un alimento o una ricetta.");
    if (added.length > 0) {
      await transaction
        .insert(storedMealItem)
        .values(added.map((item, index) => ({ ...item, storedMealId, position: lastPosition + 1 + index })));
    }
  });
}

export async function removeStoredMeal(userId: string, storedMealId: string) {
  const [deleted] = await database
    .delete(storedMeal)
    .where(and(eq(storedMeal.id, z.uuid().parse(storedMealId)), eq(storedMeal.userId, userId)))
    .returning({ id: storedMeal.id, name: storedMeal.name });
  if (!deleted) throw new Error("Pasto messo da parte non trovato.");
  return deleted;
}

const logPortionSchema = z.object({
  storedMealId: z.uuid(),
  day: z.string().refine(isIsoDate, "Data non valida"),
  meal: z.enum(mealTypes),
});

export type LogStoredMealPortionInput = z.input<typeof logPortionSchema>;

export async function logStoredMealPortion(
  userId: string,
  input: LogStoredMealPortionInput,
  source: EntrySource = "app",
) {
  const { storedMealId, day, meal } = logPortionSchema.parse(input);
  return database.transaction(async (transaction) => {
    const [updated] = await transaction
      .update(storedMeal)
      .set({ portions: sql`${storedMeal.portions} - 1`, updatedAt: new Date() })
      .where(and(eq(storedMeal.id, storedMealId), eq(storedMeal.userId, userId), gt(storedMeal.portions, 0)))
      .returning({ name: storedMeal.name, portions: storedMeal.portions });
    if (!updated) throw new Error("Pasto messo da parte non trovato o già finito.");
    const items = await transaction
      .select()
      .from(storedMealItem)
      .where(eq(storedMealItem.storedMealId, storedMealId))
      .orderBy(asc(storedMealItem.position));
    if (items.length === 0) throw new Error("Questo pasto messo da parte è vuoto.");
    const entries = await transaction
      .insert(diaryEntry)
      .values(
        items.map((item) => ({
          userId,
          day,
          meal,
          kind: item.kind,
          foodId: item.foodId,
          recipeId: item.recipeId,
          label: item.label,
          grams: item.grams,
          servings: item.servings,
          portionLabel: item.portionLabel,
          kcal: item.kcal,
          protein: item.protein,
          carbs: item.carbs,
          fat: item.fat,
          ...extrasFromRow(item),
          source,
        })),
      )
      .returning();
    return { name: updated.name, remainingPortions: updated.portions, entries };
  });
}

const undoPortionSchema = z.object({
  storedMealId: z.uuid(),
  entryIds: z.array(z.uuid()).min(1).max(100),
});

export async function undoStoredMealPortion(userId: string, input: z.input<typeof undoPortionSchema>) {
  const { storedMealId, entryIds } = undoPortionSchema.parse(input);
  await database.transaction(async (transaction) => {
    const deleted = await transaction
      .delete(diaryEntry)
      .where(and(eq(diaryEntry.userId, userId), inArray(diaryEntry.id, entryIds)))
      .returning({ id: diaryEntry.id });
    if (deleted.length === 0) return;
    await transaction
      .update(storedMeal)
      .set({ portions: sql`least(${storedMeal.portions} + 1, ${maximumStoredPortions})` })
      .where(and(eq(storedMeal.id, storedMealId), eq(storedMeal.userId, userId)));
  });
}
