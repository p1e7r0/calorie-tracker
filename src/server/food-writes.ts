import "server-only";
import { z } from "zod";
import { database } from "@/db";
import { food, foodPortion } from "@/db/schema";
import { foodValueIssues } from "@/lib/nutrition/food-checks";

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
