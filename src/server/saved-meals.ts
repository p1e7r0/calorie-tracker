import "server-only";
import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { database } from "@/db";
import { food, savedMeal, savedMealItem } from "@/db/schema";
import type { MealType } from "@/lib/nutrition/meals";
import { multiplyNutrients, type Nutrients, scaleNutrients, sumNutrients } from "@/lib/nutrition/nutrients";
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
