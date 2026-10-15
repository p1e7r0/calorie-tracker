import "server-only";
import { favoriteFoods, recentFoods } from "./foods";

export async function ingredientSuggestions(userId: string) {
  const [recent, favorites] = await Promise.all([recentFoods(userId, 20), favoriteFoods(userId)]);
  const seen = new Set<string>();
  return [...recent, ...favorites].filter((food) => {
    if (seen.has(food.id)) return false;
    seen.add(food.id);
    return true;
  });
}
