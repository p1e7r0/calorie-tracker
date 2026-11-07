import { describe, expect, it } from "vitest";
import { addDays } from "../src/lib/nutrition/days";
import {
  catalogFoods,
  diaryPlan,
  entrySnapshot,
  findFood,
  findRecipe,
  historyDays,
  incompleteDayOffset,
  isLocalDatabaseHost,
  personalFoods,
  recipes,
  savedMeals,
  storedMeals,
  usualBreakfast,
} from "./ux-seed-data";

const today = "2026-11-07";

describe("diaryPlan", () => {
  const plan = diaryPlan(today);

  it("covers the past two weeks and leaves today empty", () => {
    const days = new Set(plan.map((meal) => meal.day));
    expect(days.size).toBe(historyDays - 1);
    expect(days.has(today)).toBe(false);
    expect(days.has(addDays(today, -1))).toBe(true);
    expect(days.has(addDays(today, -(historyDays - 1)))).toBe(true);
  });

  it("logs only breakfast on the incomplete day", () => {
    const incomplete = plan.filter((meal) => meal.day === addDays(today, incompleteDayOffset));
    expect(incomplete.map((meal) => meal.meal)).toEqual(["breakfast"]);
  });

  it("makes the usual breakfast the most frequent one", () => {
    const breakfasts = plan.filter((meal) => meal.meal === "breakfast");
    const usual = breakfasts.filter((meal) => meal.items === usualBreakfast);
    expect(usual.length).toBeGreaterThan(breakfasts.length / 2);
  });

  it("references only known foods and recipes", () => {
    const items = [...plan.flatMap((meal) => meal.items), ...savedMeals.flatMap((meal) => meal.items), ...storedMeals.flatMap((meal) => meal.items)];
    for (const item of items) {
      if (item.type === "food") expect(() => findFood(item.food)).not.toThrow();
      if (item.type === "recipe") expect(() => findRecipe(item.recipe)).not.toThrow();
    }
    for (const recipe of recipes) {
      for (const ingredient of recipe.ingredients) expect(() => findFood(ingredient.food)).not.toThrow();
    }
  });

  it("does not seed the recipes the review creates", () => {
    const names = recipes.map((recipe) => recipe.name);
    expect(names).not.toContain("Lenticchie in padella");
    expect(names).not.toContain("Patate al vapore");
  });
});

describe("catalog", () => {
  it("has unique slugs and names", () => {
    const foods = [...catalogFoods, ...personalFoods];
    expect(new Set(foods.map((food) => food.slug)).size).toBe(foods.length);
    expect(new Set(foods.map((food) => food.name)).size).toBe(foods.length);
  });

  it("keeps macros consistent with energy", () => {
    for (const food of catalogFoods) {
      const fromMacros = food.protein * 4 + food.carbs * 4 + food.fat * 9;
      expect(Math.abs(fromMacros - food.kcal)).toBeLessThan(Math.max(12, food.kcal * 0.15));
    }
  });
});

describe("entrySnapshot", () => {
  it("scales a food per 100 g and keeps the portion label", () => {
    expect(entrySnapshot({ type: "food", food: "apple", grams: 150, portionLabel: "1 mela media" })).toMatchObject({
      kind: "food",
      label: "Mela, cruda",
      grams: 150,
      portionLabel: "1 mela media",
      kcal: 81,
      carbs: 17.1,
      fiber: 3.45,
    });
  });

  it("labels a personal food with its brand", () => {
    expect(entrySnapshot({ type: "food", food: "piadina", grams: 110 }).label).toBe("Piadina romagnola, Forno di casa");
  });

  it("divides a recipe by its servings", () => {
    const snapshot = entrySnapshot({ type: "recipe", recipe: "zucchini-omelette", servings: 1 });
    expect(snapshot).toMatchObject({ kind: "recipe", label: "Frittata di zucchine", servings: 1, grams: null });
    expect(snapshot.kcal).toBe(Math.round((220 * 1.4 + 300 * 0.19 + 30 * 4 + 10 * 8.99) / 2));
  });

  it("keeps quick entries as given", () => {
    expect(entrySnapshot({ type: "quick", label: "Gelato", kcal: 250 })).toMatchObject({ kind: "quick", kcal: 250, protein: 0, fiber: null });
  });
});

describe("isLocalDatabaseHost", () => {
  it("accepts local hosts and rejects Neon", () => {
    expect(isLocalDatabaseHost("localhost")).toBe(true);
    expect(isLocalDatabaseHost("127.0.0.1")).toBe(true);
    expect(isLocalDatabaseHost("ep-example-pooler.eu-central-1.aws.neon.tech")).toBe(false);
  });
});
