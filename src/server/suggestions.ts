import "server-only";
import { and, eq, gte, inArray } from "drizzle-orm";
import { database } from "@/db";
import { diaryEntry } from "@/db/schema";
import { addDays } from "@/lib/nutrition/days";
import { rankMealSuggestions, suggestionWindowDays } from "@/lib/nutrition/meal-suggestions";
import { mealTypes, type MealType } from "@/lib/nutrition/meals";
import { favoriteFoods, loggableFoodsByIds, recentFoods, visibleFoodIdsByRequested } from "./foods";
import type { LoggableItem } from "./loggable";
import { loggableRecipesByIds } from "./recipes";

export async function ingredientSuggestions(userId: string) {
  const [recent, favorites] = await Promise.all([recentFoods(userId, 20), favoriteFoods(userId)]);
  const seen = new Set<string>();
  return [...recent, ...favorites].filter((food) => {
    if (seen.has(food.id)) return false;
    seen.add(food.id);
    return true;
  });
}

const suggestionLimit = 15;

export async function mealSuggestions(userId: string, today: string): Promise<Record<MealType, LoggableItem[]>> {
  const uses = await database
    .select({ foodId: diaryEntry.foodId, recipeId: diaryEntry.recipeId, day: diaryEntry.day, meal: diaryEntry.meal })
    .from(diaryEntry)
    .where(
      and(
        eq(diaryEntry.userId, userId),
        gte(diaryEntry.day, addDays(today, -suggestionWindowDays)),
        inArray(diaryEntry.kind, ["food", "recipe"]),
      ),
    );
  const usedFoodIds = [...new Set(uses.flatMap((use) => (use.foodId ? [use.foodId] : [])))];
  const visibleFoodIds = await visibleFoodIdsByRequested(userId, usedFoodIds);
  const ranked = rankMealSuggestions(
    uses.flatMap((use) => {
      const foodId = use.foodId ? visibleFoodIds.get(use.foodId) : null;
      const itemKey = foodId ? `food:${foodId}` : use.recipeId ? `recipe:${use.recipeId}` : null;
      return itemKey ? [{ itemKey, day: use.day, meal: use.meal }] : [];
    }),
    today,
    suggestionLimit * 2,
  );
  const keys = [...new Set(mealTypes.flatMap((meal) => ranked[meal]))];
  const idsOf = (prefix: string) => keys.filter((key) => key.startsWith(prefix)).map((key) => key.slice(prefix.length));
  const [foodsById, recipes] = await Promise.all([
    loggableFoodsByIds(userId, idsOf("food:")),
    loggableRecipesByIds(userId, idsOf("recipe:")),
  ]);
  const recipesById = new Map(recipes.map((recipe) => [recipe.id, recipe]));

  const suggestions = {} as Record<MealType, LoggableItem[]>;
  for (const meal of mealTypes) {
    suggestions[meal] = ranked[meal]
      .flatMap((key) => {
        const item = key.startsWith("food:")
          ? foodsById.get(key.slice("food:".length))
          : recipesById.get(key.slice("recipe:".length));
        return item ? [item] : [];
      })
      .slice(0, suggestionLimit);
  }
  return suggestions;
}
