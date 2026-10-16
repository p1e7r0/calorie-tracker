import { z } from "zod";

const nutrientValue = z.number().nullable();

export const nutritionLabelSchema = z.object({
  readable: z.boolean(),
  name: z.string().nullable(),
  brand: z.string().nullable(),
  unit: z.enum(["g", "ml"]),
  per100: z.object({
    kcal: nutrientValue,
    protein: nutrientValue,
    carbs: nutrientValue,
    sugars: nutrientValue,
    fat: nutrientValue,
    saturatedFat: nutrientValue,
    fiber: nutrientValue,
    salt: nutrientValue,
  }),
  portion: z.object({ label: z.string(), grams: z.number() }).nullable(),
});

export type NutritionLabel = z.infer<typeof nutritionLabelSchema>;

export const mealDescriptionSchema = z.object({
  items: z.array(
    z.object({
      description: z.string(),
      query: z.string(),
      grams: z.number(),
      estimatedKcal: z.number(),
    }),
  ),
});

export type MealDescription = z.infer<typeof mealDescriptionSchema>;

const plausible = { kcal: 950, macro: 100, salt: 100 };

export function sanitizeNutritionLabel(label: NutritionLabel): NutritionLabel {
  const within = (value: number | null, maximum: number) =>
    value === null || !Number.isFinite(value) || value < 0 || value > maximum ? null : Math.round(value * 10) / 10;
  const per100 = label.per100;
  return {
    ...label,
    name: label.name?.trim().slice(0, 120) || null,
    brand: label.brand?.trim().slice(0, 80) || null,
    per100: {
      kcal: within(per100.kcal, plausible.kcal),
      protein: within(per100.protein, plausible.macro),
      carbs: within(per100.carbs, plausible.macro),
      sugars: within(per100.sugars, plausible.macro),
      fat: within(per100.fat, plausible.macro),
      saturatedFat: within(per100.saturatedFat, plausible.macro),
      fiber: within(per100.fiber, plausible.macro),
      salt: within(per100.salt, plausible.salt),
    },
    portion:
      label.portion && label.portion.grams > 0 && label.portion.grams <= 2000 && label.portion.label.trim()
        ? { label: label.portion.label.trim().slice(0, 60), grams: Math.round(label.portion.grams * 10) / 10 }
        : null,
  };
}

export function sanitizeMealDescription(meal: MealDescription): MealDescription {
  return {
    items: meal.items
      .filter((item) => item.query.trim() && item.grams > 0 && item.grams <= 3000)
      .slice(0, 15)
      .map((item) => ({
        description: item.description.trim().slice(0, 80),
        query: item.query.trim().slice(0, 80),
        grams: Math.round(item.grams),
        estimatedKcal: Math.max(0, Math.min(5000, Math.round(item.estimatedKcal))),
      })),
  };
}
