import "server-only";
import { and, asc, eq, gt, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import { database } from "@/db";
import { diaryEntry, food, preparedMeal, preparedMealItem } from "@/db/schema";
import { todayIsoDate } from "@/lib/nutrition/days";
import { extrasFromRow, roundExtras } from "@/lib/nutrition/extra-nutrients";
import type { MealType } from "@/lib/nutrition/meals";
import { type Nutrients, roundNutrients, sumNutrients } from "@/lib/nutrition/nutrients";
import {
  maximumPreparedPortions,
  type StorageLocation,
  storageLocations,
} from "@/lib/nutrition/prepared-meals";
import { foodEntryItemSchema, recipeEntryItemSchema, resolveEntryValues } from "./diary-entries";

export type PreparedMealItemView = {
  id: string;
  kind: "food" | "recipe";
  foodId: string | null;
  recipeId: string | null;
  label: string;
  grams: number | null;
  servings: number | null;
  portionLabel: string | null;
  unit: "g" | "ml";
  nutrients: Nutrients;
};

export type PreparedMealView = {
  id: string;
  name: string;
  location: StorageLocation;
  portions: number;
  storedOn: string;
  items: PreparedMealItemView[];
  totals: Nutrients;
};

type EntrySource = (typeof diaryEntry.$inferInsert)["source"];

async function loadPreparedMeals(userId: string, preparedMealIds?: string[]): Promise<PreparedMealView[]> {
  const meals = await database
    .select()
    .from(preparedMeal)
    .where(
      and(
        eq(preparedMeal.userId, userId),
        gt(preparedMeal.portions, 0),
        preparedMealIds ? inArray(preparedMeal.id, preparedMealIds) : undefined,
      ),
    )
    .orderBy(asc(preparedMeal.location), asc(preparedMeal.storedOn), asc(preparedMeal.createdAt));
  if (meals.length === 0) return [];

  const items = await database
    .select({ item: preparedMealItem, unit: food.unit })
    .from(preparedMealItem)
    .leftJoin(food, eq(food.id, preparedMealItem.foodId))
    .where(
      inArray(
        preparedMealItem.preparedMealId,
        meals.map((meal) => meal.id),
      ),
    )
    .orderBy(asc(preparedMealItem.position));

  return meals.map((meal) => {
    const views: PreparedMealItemView[] = items
      .filter(({ item }) => item.preparedMealId === meal.id)
      .map(({ item, unit }) => ({
        id: item.id,
        kind: item.kind === "recipe" ? "recipe" : "food",
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
      portions: meal.portions,
      storedOn: meal.storedOn,
      items: views,
      totals: sumNutrients(views.map((view) => view.nutrients)),
    };
  });
}

export async function listPreparedMeals(userId: string) {
  return loadPreparedMeals(userId);
}

export async function getPreparedMeal(userId: string, preparedMealId: string) {
  const [meal] = await loadPreparedMeals(userId, [preparedMealId]);
  return meal ?? null;
}

const preparedMealName = z.string().trim().min(1, "Dai un nome al pasto.").max(80, "Il nome è troppo lungo.");
const preparedPortions = z
  .number()
  .int()
  .min(1, "Serve almeno una porzione.")
  .max(maximumPreparedPortions, `Al massimo ${maximumPreparedPortions} porzioni.`);

const preparedMealSchema = z.object({
  name: preparedMealName,
  location: z.enum(storageLocations),
  portions: preparedPortions,
  items: z
    .array(z.discriminatedUnion("type", [foodEntryItemSchema, recipeEntryItemSchema]))
    .min(1, "Aggiungi almeno un alimento o una ricetta.")
    .max(30, "Al massimo 30 voci per pasto."),
});

export type PreparedMealInput = z.input<typeof preparedMealSchema>;

export async function insertPreparedMeal(userId: string, input: PreparedMealInput) {
  const { name, location, portions, items } = preparedMealSchema.parse(input);
  const resolved = await Promise.all(items.map((item) => resolveEntryValues(userId, item)));
  return database.transaction(async (transaction) => {
    const [created] = await transaction
      .insert(preparedMeal)
      .values({ userId, name, location, portions, storedOn: todayIsoDate() })
      .returning({ id: preparedMeal.id });
    await transaction.insert(preparedMealItem).values(
      resolved.map(({ nutrients, extras, ...values }, position) => ({
        ...values,
        ...roundNutrients(nutrients),
        ...roundExtras(extras),
        preparedMealId: created.id,
        position,
      })),
    );
    return created.id;
  });
}

const preparedMealUpdateSchema = z.object({
  preparedMealId: z.uuid(),
  name: preparedMealName.optional(),
  location: z.enum(storageLocations).optional(),
  portions: preparedPortions.optional(),
});

export type PreparedMealUpdate = z.input<typeof preparedMealUpdateSchema>;

export async function editPreparedMeal(userId: string, input: PreparedMealUpdate) {
  const { preparedMealId, name, location, portions } = preparedMealUpdateSchema.parse(input);
  const [current] = await database
    .select({ location: preparedMeal.location })
    .from(preparedMeal)
    .where(and(eq(preparedMeal.id, preparedMealId), eq(preparedMeal.userId, userId), gt(preparedMeal.portions, 0)));
  if (!current) throw new Error("Pasto pronto non trovato.");
  if (name === undefined && location === undefined && portions === undefined) return;
  const moved = location !== undefined && location !== current.location;
  await database
    .update(preparedMeal)
    .set({ name, location, portions, ...(moved ? { storedOn: todayIsoDate() } : {}) })
    .where(and(eq(preparedMeal.id, preparedMealId), eq(preparedMeal.userId, userId)));
}

export async function removePreparedMeal(userId: string, preparedMealId: string) {
  const [deleted] = await database
    .delete(preparedMeal)
    .where(and(eq(preparedMeal.id, z.uuid().parse(preparedMealId)), eq(preparedMeal.userId, userId)))
    .returning({ id: preparedMeal.id, name: preparedMeal.name });
  if (!deleted) throw new Error("Pasto pronto non trovato.");
  return deleted;
}

export async function consumePreparedMeal(
  userId: string,
  { preparedMealId, day, meal }: { preparedMealId: string; day: string; meal: MealType },
  source: EntrySource = "app",
) {
  return database.transaction(async (transaction) => {
    const [taken] = await transaction
      .update(preparedMeal)
      .set({ portions: sql`${preparedMeal.portions} - 1` })
      .where(
        and(eq(preparedMeal.id, preparedMealId), eq(preparedMeal.userId, userId), gt(preparedMeal.portions, 0)),
      )
      .returning({ name: preparedMeal.name, portions: preparedMeal.portions });
    if (!taken) throw new Error("Questo pasto pronto è già finito.");

    const items = await transaction
      .select()
      .from(preparedMealItem)
      .where(eq(preparedMealItem.preparedMealId, preparedMealId))
      .orderBy(asc(preparedMealItem.position));
    if (items.length === 0) throw new Error("Questo pasto pronto è vuoto.");

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
    return { entries, name: taken.name, portionsLeft: taken.portions };
  });
}

const restoreSchema = z.object({
  preparedMealId: z.uuid(),
  entryIds: z.array(z.uuid()).min(1).max(100),
});

export async function restorePreparedMealPortion(userId: string, input: z.input<typeof restoreSchema>) {
  const { preparedMealId, entryIds } = restoreSchema.parse(input);
  await database.transaction(async (transaction) => {
    const deleted = await transaction
      .delete(diaryEntry)
      .where(and(eq(diaryEntry.userId, userId), inArray(diaryEntry.id, entryIds)))
      .returning({ id: diaryEntry.id });
    if (deleted.length === 0) throw new Error("Voci non trovate.");
    await transaction
      .update(preparedMeal)
      .set({ portions: sql`least(${preparedMeal.portions} + 1, ${maximumPreparedPortions})` })
      .where(and(eq(preparedMeal.id, preparedMealId), eq(preparedMeal.userId, userId)));
  });
}
