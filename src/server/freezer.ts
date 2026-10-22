import "server-only";
import { and, asc, eq, gt } from "drizzle-orm";
import { database } from "@/db";
import { diaryEntry, food, freezerBatch } from "@/db/schema";
import { extrasFromRow, roundExtras } from "@/lib/nutrition/extra-nutrients";
import type { MealType } from "@/lib/nutrition/meals";
import { type Nutrients, roundNutrients } from "@/lib/nutrition/nutrients";
import { type EntryItem, resolveEntryValues, takeFreezerPortion } from "./diary-entries";

export type FreezerBatchView = {
  id: string;
  kind: "food" | "recipe";
  label: string;
  grams: number | null;
  servings: number | null;
  unit: "g" | "ml";
  perPortion: Nutrients;
  portions: number;
  portionsLeft: number;
  frozenOn: string;
};

export async function listFreezerBatches(userId: string): Promise<FreezerBatchView[]> {
  const rows = await database
    .select({ batch: freezerBatch, unit: food.unit })
    .from(freezerBatch)
    .leftJoin(food, eq(food.id, freezerBatch.foodId))
    .where(and(eq(freezerBatch.userId, userId), gt(freezerBatch.portionsLeft, 0)))
    .orderBy(asc(freezerBatch.frozenOn), asc(freezerBatch.createdAt));
  return rows.map(({ batch, unit }) => ({
    id: batch.id,
    kind: batch.kind === "recipe" ? "recipe" : "food",
    label: batch.label,
    grams: batch.grams,
    servings: batch.servings,
    unit: unit ?? "g",
    perPortion: { kcal: batch.kcal, protein: batch.protein, carbs: batch.carbs, fat: batch.fat },
    portions: batch.portions,
    portionsLeft: batch.portionsLeft,
    frozenOn: batch.frozenOn,
  }));
}

export async function insertFreezerBatch(
  userId: string,
  item: Extract<EntryItem, { type: "food" | "recipe" }>,
  portions: number,
  frozenOn: string,
) {
  const { nutrients, extras, kind, foodId, recipeId, label, grams, servings } = await resolveEntryValues(userId, item);
  const [created] = await database
    .insert(freezerBatch)
    .values({
      userId,
      kind,
      foodId,
      recipeId,
      label,
      grams,
      servings,
      ...roundNutrients(nutrients),
      ...roundExtras(extras),
      portions,
      portionsLeft: portions,
      frozenOn,
    })
    .returning({ id: freezerBatch.id });
  return created;
}

export async function logFreezerPortion(
  userId: string,
  batchId: string,
  day: string,
  meal: MealType,
  source: (typeof diaryEntry.$inferInsert)["source"] = "app",
) {
  return database.transaction(async (transaction) => {
    const batch = await takeFreezerPortion(transaction, userId, batchId);
    if (!batch) return null;
    const [created] = await transaction
      .insert(diaryEntry)
      .values({
        userId,
        day,
        meal,
        kind: batch.kind,
        foodId: batch.foodId,
        recipeId: batch.recipeId,
        label: batch.label,
        grams: batch.grams,
        servings: batch.servings,
        kcal: batch.kcal,
        protein: batch.protein,
        carbs: batch.carbs,
        fat: batch.fat,
        ...extrasFromRow(batch),
        source,
        freezerBatchId: batch.id,
      })
      .returning();
    return created;
  });
}
