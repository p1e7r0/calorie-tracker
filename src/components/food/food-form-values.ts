import { formatDecimal } from "@/lib/nutrition/format";

export type NutrientField = "kcal" | "protein" | "carbs" | "sugars" | "fat" | "saturatedFat" | "fiber" | "salt";

export type FoodFormValues = {
  name: string;
  brand: string;
  barcode: string;
  unit: "g" | "ml";
} & Record<NutrientField, string> & {
    portions: { label: string; grams: string }[];
  };

export const emptyFoodFormValues: FoodFormValues = {
  name: "",
  brand: "",
  barcode: "",
  unit: "g",
  kcal: "",
  protein: "",
  carbs: "",
  sugars: "",
  fat: "",
  saturatedFat: "",
  fiber: "",
  salt: "",
  portions: [],
};

export function toFormNumber(value: number | null | undefined) {
  return value === null || value === undefined ? "" : formatDecimal(value).replace(/\./g, "");
}
