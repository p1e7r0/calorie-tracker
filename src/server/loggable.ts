import type { Nutrients } from "@/lib/nutrition/nutrients";

export type FoodPortionOption = { label: string; grams: number };

export type LoggableFood = {
  type: "food";
  id: string;
  name: string;
  brand: string | null;
  unit: "g" | "ml";
  per100: Nutrients;
  portions: FoodPortionOption[];
  lastGrams: number | null;
  isFavorite: boolean;
  isOwn: boolean;
};

export type LoggableRecipe = {
  type: "recipe";
  id: string;
  name: string;
  per100: Nutrients;
  perServing: Nutrients;
  servings: number;
  finalWeightG: number;
  hasCookedWeight: boolean;
  lastServings: number | null;
  lastGrams: number | null;
  isFavorite: boolean;
};

export type LoggableItem = LoggableFood | LoggableRecipe;
