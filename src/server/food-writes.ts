import "server-only";
import { and, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { database } from "@/db";
import { favoriteFood, food, foodPortion } from "@/db/schema";
import { foodValueIssues } from "@/lib/nutrition/food-checks";
import { getVisibleFood } from "./foods";

const optionalNutrient = z.number().min(0).max(1000).nullish();

export const foodInputSchema = z
  .object({
    name: z.string().trim().min(1, "Dai un nome all'alimento.").max(120),
    brand: z.string().trim().max(80).nullish(),
    barcode: z
      .string()
      .trim()
      .regex(/^\d{6,14}$/, "Il codice a barre deve avere da 6 a 14 cifre.")
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
  })
  .superRefine((values, context) => {
    for (const issue of foodValueIssues(values)) {
      context.addIssue({ code: "custom", path: [issue.path], message: issue.message });
    }
  });

export type FoodInput = z.input<typeof foodInputSchema>;
export type ParsedFoodInput = z.infer<typeof foodInputSchema>;

export function toFoodValues(input: ParsedFoodInput) {
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

export async function insertFood(userId: string, input: FoodInput) {
  const parsed = foodInputSchema.parse(input);
  return database.transaction(async (transaction) => {
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
}

export async function editFood(userId: string, foodId: string, input: FoodInput) {
  const parsed = foodInputSchema.parse(input);
  const existing = await getVisibleFood(userId, z.uuid().parse(foodId));
  if (!existing) throw new Error("Alimento non trovato.");

  return database.transaction(async (transaction) => {
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
}

export async function archiveOwnFood(userId: string, foodId: string) {
  const [archived] = await database
    .update(food)
    .set({ archivedAt: new Date() })
    .where(and(eq(food.id, z.uuid().parse(foodId)), eq(food.ownerId, userId), isNull(food.archivedAt)))
    .returning({ id: food.id, name: food.name });
  if (!archived) throw new Error("Puoi eliminare solo gli alimenti che hai creato tu.");
  return archived;
}

export async function markFoodFavorite(userId: string, foodId: string, favorite: boolean) {
  const visible = await getVisibleFood(userId, z.uuid().parse(foodId));
  if (!visible) throw new Error("Alimento non trovato.");
  if (favorite) {
    await database.insert(favoriteFood).values({ userId, foodId: visible.id }).onConflictDoNothing();
  } else {
    await database.delete(favoriteFood).where(and(eq(favoriteFood.userId, userId), eq(favoriteFood.foodId, visible.id)));
  }
  return visible;
}
