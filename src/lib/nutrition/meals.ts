export const mealTypes = ["breakfast", "lunch", "dinner", "snack"] as const;

export type MealType = (typeof mealTypes)[number];

export const mealLabels: Record<MealType, string> = {
  breakfast: "Colazione",
  lunch: "Pranzo",
  dinner: "Cena",
  snack: "Spuntini",
};

export function isMealType(value: unknown): value is MealType {
  return typeof value === "string" && (mealTypes as readonly string[]).includes(value);
}

export function suggestMeal(hour: number): MealType {
  if (hour >= 5 && hour < 11) return "breakfast";
  if (hour >= 11 && hour < 15) return "lunch";
  if (hour >= 18 && hour < 23) return "dinner";
  return "snack";
}
