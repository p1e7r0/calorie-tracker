import { addDays } from "../src/lib/nutrition/days";
import {
  emptyExtraNutrients,
  type ExtraNutrients,
  multiplyExtras,
  roundExtras,
  scaleExtras,
  sumExtras,
} from "../src/lib/nutrition/extra-nutrients";
import type { ActivityLevel, GoalType, Sex } from "../src/lib/nutrition/goals";
import type { MealType } from "../src/lib/nutrition/meals";
import { type Nutrients, roundNutrients, scaleNutrients } from "../src/lib/nutrition/nutrients";
import { computeRecipeNutrition, recipePortionNutrients } from "../src/lib/nutrition/recipe";

export const uxSeedReferencePrefix = "ux-seed:";

export const uxUsers = {
  full: { email: "ux-full@example.com", name: "Giulia" },
  empty: { email: "ux-empty@example.com", name: "Luca" },
} as const;

export type CatalogFood = {
  slug: string;
  name: string;
  category: string;
  unit?: "g" | "ml";
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number | null;
  sugars: number | null;
  saturatedFat: number | null;
  salt: number | null;
  portions?: readonly { label: string; grams: number }[];
};

export const catalogFoods: readonly CatalogFood[] = [
  { slug: "apple", name: "Mela, cruda", category: "Frutta", kcal: 54, protein: 0.3, carbs: 11.4, fat: 0.1, fiber: 2.3, sugars: 10.3, saturatedFat: 0, salt: 0, portions: [{ label: "1 mela media", grams: 150 }] },
  { slug: "banana", name: "Banana, cruda", category: "Frutta", kcal: 95, protein: 1.1, carbs: 20.4, fat: 0.2, fiber: 1.8, sugars: 17, saturatedFat: 0.1, salt: 0, portions: [{ label: "1 banana", grams: 120 }] },
  { slug: "pasta", name: "Pasta di semola, cruda", category: "Cereali", kcal: 355, protein: 12.5, carbs: 70.5, fat: 1.5, fiber: 3, sugars: 3, saturatedFat: 0.3, salt: 0, portions: [{ label: "1 piatto", grams: 80 }] },
  { slug: "rice", name: "Riso, crudo", category: "Cereali", kcal: 350, protein: 7, carbs: 78, fat: 0.6, fiber: 1.4, sugars: 0.3, saturatedFat: 0.2, salt: 0 },
  { slug: "bread", name: "Pane bianco", category: "Cereali", kcal: 260, protein: 8.5, carbs: 51, fat: 1.6, fiber: 3, sugars: 2.5, saturatedFat: 0.3, salt: 1.2, portions: [{ label: "1 fetta", grams: 30 }] },
  { slug: "rusks", name: "Fette biscottate", category: "Cereali", kcal: 410, protein: 11, carbs: 76, fat: 6.5, fiber: 3.5, sugars: 7, saturatedFat: 1, salt: 1.3, portions: [{ label: "1 fetta", grams: 10 }] },
  { slug: "oats", name: "Fiocchi d'avena", category: "Cereali", kcal: 370, protein: 13.5, carbs: 59, fat: 7, fiber: 10, sugars: 1, saturatedFat: 1.2, salt: 0 },
  { slug: "lettuce", name: "Insalata verde, cruda", category: "Verdura", kcal: 15, protein: 1.3, carbs: 1.6, fat: 0.2, fiber: 1.3, sugars: 1, saturatedFat: 0, salt: 0 },
  { slug: "tomato", name: "Pomodoro, crudo", category: "Verdura", kcal: 19, protein: 0.9, carbs: 3, fat: 0.2, fiber: 1.2, sugars: 2.8, saturatedFat: 0, salt: 0 },
  { slug: "zucchini", name: "Zucchina, cruda", category: "Verdura", kcal: 19, protein: 1.6, carbs: 1.8, fat: 0.4, fiber: 1.1, sugars: 1.7, saturatedFat: 0.1, salt: 0 },
  { slug: "carrot", name: "Carota, cruda", category: "Verdura", kcal: 37, protein: 0.9, carbs: 7, fat: 0.2, fiber: 3, sugars: 6.5, saturatedFat: 0, salt: 0.1 },
  { slug: "onion", name: "Cipolla, cruda", category: "Verdura", kcal: 33, protein: 1.2, carbs: 6, fat: 0.2, fiber: 1.8, sugars: 5, saturatedFat: 0, salt: 0 },
  { slug: "celery", name: "Sedano, crudo", category: "Verdura", kcal: 16, protein: 0.8, carbs: 1.6, fat: 0.2, fiber: 1.6, sugars: 1.4, saturatedFat: 0, salt: 0.2 },
  { slug: "garlic", name: "Aglio, crudo", category: "Verdura", kcal: 135, protein: 6, carbs: 27, fat: 0.5, fiber: 2, sugars: 1, saturatedFat: 0.1, salt: 0 },
  { slug: "potato", name: "Patata, cruda", category: "Verdura", kcal: 75, protein: 2, carbs: 15.5, fat: 0.1, fiber: 1.6, sugars: 0.8, saturatedFat: 0, salt: 0 },
  { slug: "tomato-puree", name: "Passata di pomodoro", category: "Verdura", kcal: 30, protein: 1.4, carbs: 5, fat: 0.2, fiber: 1.3, sugars: 4.5, saturatedFat: 0, salt: 0.4 },
  { slug: "lentils", name: "Lenticchie, secche", category: "Legumi", kcal: 325, protein: 23.5, carbs: 47, fat: 1.5, fiber: 17, sugars: 1.8, saturatedFat: 0.2, salt: 0 },
  { slug: "chickpeas", name: "Ceci, in scatola, sgocciolati", category: "Legumi", kcal: 120, protein: 7, carbs: 15, fat: 2.5, fiber: 5, sugars: 0.5, saturatedFat: 0.3, salt: 0.6 },
  { slug: "olive-oil", name: "Olio d'oliva extravergine", category: "Grassi", kcal: 899, protein: 0, carbs: 0, fat: 99.9, fiber: 0, sugars: 0, saturatedFat: 14, salt: 0, portions: [{ label: "1 cucchiaio", grams: 10 }] },
  { slug: "walnuts", name: "Noci", category: "Frutta secca", kcal: 690, protein: 15, carbs: 7, fat: 66, fiber: 6, sugars: 2.6, saturatedFat: 6, salt: 0, portions: [{ label: "1 manciata", grams: 30 }] },
  { slug: "milk", name: "Latte intero", category: "Latticini", unit: "ml", kcal: 64, protein: 3.3, carbs: 4.8, fat: 3.6, fiber: 0, sugars: 4.8, saturatedFat: 2.3, salt: 0.1, portions: [{ label: "1 tazza", grams: 200 }] },
  { slug: "yogurt", name: "Yogurt naturale intero", category: "Latticini", kcal: 70, protein: 3.8, carbs: 4.5, fat: 3.8, fiber: 0, sugars: 4.5, saturatedFat: 2.4, salt: 0.1, portions: [{ label: "1 vasetto", grams: 125 }] },
  { slug: "parmesan", name: "Parmigiano Reggiano", category: "Latticini", kcal: 400, protein: 33, carbs: 0, fat: 29.5, fiber: 0, sugars: 0, saturatedFat: 19, salt: 1.6, portions: [{ label: "1 cucchiaio", grams: 5 }] },
  { slug: "mozzarella", name: "Mozzarella", category: "Latticini", kcal: 250, protein: 18.5, carbs: 1, fat: 19.5, fiber: 0, sugars: 1, saturatedFat: 13, salt: 0.5, portions: [{ label: "1 mozzarella", grams: 125 }] },
  { slug: "egg", name: "Uovo di gallina, crudo", category: "Uova", kcal: 140, protein: 12.5, carbs: 0.7, fat: 9.7, fiber: 0, sugars: 0.7, saturatedFat: 2.8, salt: 0.35, portions: [{ label: "1 uovo", grams: 55 }] },
  { slug: "chicken", name: "Petto di pollo, crudo", category: "Carne", kcal: 105, protein: 23.5, carbs: 0, fat: 1.2, fiber: 0, sugars: 0, saturatedFat: 0.4, salt: 0.15 },
  { slug: "ham", name: "Prosciutto crudo", category: "Carne", kcal: 250, protein: 26, carbs: 0.3, fat: 16, fiber: 0, sugars: 0.3, saturatedFat: 5.5, salt: 5.5 },
  { slug: "tuna", name: "Tonno sott'olio, sgocciolato", category: "Pesce", kcal: 190, protein: 25, carbs: 0, fat: 10, fiber: 0, sugars: 0, saturatedFat: 1.6, salt: 0.9, portions: [{ label: "1 scatoletta", grams: 80 }] },
  { slug: "honey", name: "Miele", category: "Dolci", kcal: 320, protein: 0.4, carbs: 80, fat: 0, fiber: 0, sugars: 80, saturatedFat: 0, salt: 0, portions: [{ label: "1 cucchiaino", grams: 7 }] },
  { slug: "jam", name: "Marmellata di albicocche", category: "Dolci", kcal: 250, protein: 0.4, carbs: 60, fat: 0, fiber: 1, sugars: 55, saturatedFat: 0, salt: 0, portions: [{ label: "1 cucchiaino", grams: 10 }] },
  { slug: "espresso", name: "Caffè espresso", category: "Bevande", unit: "ml", kcal: 2, protein: 0.1, carbs: 0.3, fat: 0.1, fiber: null, sugars: null, saturatedFat: null, salt: null, portions: [{ label: "1 tazzina", grams: 30 }] },
];

export const personalFoods: readonly (CatalogFood & { brand: string })[] = [
  { slug: "piadina", name: "Piadina romagnola", brand: "Forno di casa", category: "Cereali", kcal: 300, protein: 8, carbs: 48, fat: 8.5, fiber: 2.5, sugars: 2, saturatedFat: 3.5, salt: 1.5, portions: [{ label: "1 piadina", grams: 110 }] },
];

export type RecipeDefinition = {
  slug: string;
  name: string;
  servings: number;
  cookedWeightG: number;
  ingredients: readonly { food: string; grams: number }[];
};

export const recipes: readonly RecipeDefinition[] = [
  {
    slug: "pasta-tomato",
    name: "Pasta al pomodoro",
    servings: 4,
    cookedWeightG: 1150,
    ingredients: [
      { food: "pasta", grams: 320 },
      { food: "tomato-puree", grams: 400 },
      { food: "olive-oil", grams: 20 },
      { food: "parmesan", grams: 20 },
      { food: "garlic", grams: 5 },
    ],
  },
  {
    slug: "minestrone",
    name: "Minestrone",
    servings: 6,
    cookedWeightG: 1800,
    ingredients: [
      { food: "potato", grams: 300 },
      { food: "carrot", grams: 200 },
      { food: "zucchini", grams: 250 },
      { food: "celery", grams: 100 },
      { food: "onion", grams: 100 },
      { food: "tomato-puree", grams: 150 },
      { food: "olive-oil", grams: 20 },
    ],
  },
  {
    slug: "zucchini-omelette",
    name: "Frittata di zucchine",
    servings: 2,
    cookedWeightG: 480,
    ingredients: [
      { food: "egg", grams: 220 },
      { food: "zucchini", grams: 300 },
      { food: "parmesan", grams: 30 },
      { food: "olive-oil", grams: 10 },
    ],
  },
];

export type PlanItem =
  | { type: "food"; food: string; grams: number; portionLabel?: string }
  | { type: "recipe"; recipe: string; servings: number }
  | { type: "quick"; label: string; kcal: number; protein?: number; carbs?: number; fat?: number };

export const usualBreakfast: readonly PlanItem[] = [
  { type: "food", food: "milk", grams: 200, portionLabel: "1 tazza" },
  { type: "food", food: "oats", grams: 40 },
  { type: "food", food: "banana", grams: 120, portionLabel: "1 banana" },
];

const yogurtBreakfast: readonly PlanItem[] = [
  { type: "food", food: "yogurt", grams: 125, portionLabel: "1 vasetto" },
  { type: "food", food: "honey", grams: 7, portionLabel: "1 cucchiaino" },
  { type: "food", food: "rusks", grams: 30 },
  { type: "food", food: "jam", grams: 20 },
  { type: "food", food: "espresso", grams: 30, portionLabel: "1 tazzina" },
];

const lunches: readonly (readonly PlanItem[])[] = [
  [
    { type: "recipe", recipe: "pasta-tomato", servings: 1 },
    { type: "food", food: "lettuce", grams: 80 },
    { type: "food", food: "olive-oil", grams: 10, portionLabel: "1 cucchiaio" },
  ],
  [
    { type: "food", food: "rice", grams: 80 },
    { type: "food", food: "chicken", grams: 150 },
    { type: "food", food: "zucchini", grams: 200 },
    { type: "food", food: "olive-oil", grams: 10, portionLabel: "1 cucchiaio" },
  ],
  [
    { type: "food", food: "pasta", grams: 90 },
    { type: "food", food: "tuna", grams: 80, portionLabel: "1 scatoletta" },
    { type: "food", food: "tomato", grams: 150 },
    { type: "food", food: "olive-oil", grams: 10, portionLabel: "1 cucchiaio" },
  ],
  [
    { type: "recipe", recipe: "minestrone", servings: 1 },
    { type: "food", food: "bread", grams: 60 },
    { type: "food", food: "parmesan", grams: 10 },
  ],
];

const dinners: readonly (readonly PlanItem[])[] = [
  [
    { type: "food", food: "chicken", grams: 180 },
    { type: "food", food: "lettuce", grams: 100 },
    { type: "food", food: "bread", grams: 60 },
    { type: "food", food: "olive-oil", grams: 10, portionLabel: "1 cucchiaio" },
  ],
  [
    { type: "food", food: "mozzarella", grams: 125, portionLabel: "1 mozzarella" },
    { type: "food", food: "tomato", grams: 200 },
    { type: "food", food: "bread", grams: 60 },
    { type: "food", food: "olive-oil", grams: 10, portionLabel: "1 cucchiaio" },
  ],
  [
    { type: "recipe", recipe: "zucchini-omelette", servings: 1 },
    { type: "food", food: "bread", grams: 50 },
    { type: "food", food: "lettuce", grams: 80 },
  ],
  [
    { type: "food", food: "ham", grams: 70 },
    { type: "food", food: "piadina", grams: 110, portionLabel: "1 piadina" },
    { type: "food", food: "zucchini", grams: 200 },
  ],
  [
    { type: "food", food: "chickpeas", grams: 200 },
    { type: "food", food: "potato", grams: 250 },
    { type: "food", food: "olive-oil", grams: 15 },
  ],
];

export const historyDays = 14;
export const incompleteDayOffset = -6;
export const gelatoDayOffset = -4;

export type PlannedMeal = { day: string; meal: MealType; items: readonly PlanItem[] };

export function diaryPlan(today: string): PlannedMeal[] {
  const plan: PlannedMeal[] = [];
  for (let offset = -historyDays + 1; offset <= -1; offset++) {
    const day = addDays(today, offset);
    const index = offset + historyDays;
    plan.push({ day, meal: "breakfast", items: index % 3 === 0 ? yogurtBreakfast : usualBreakfast });
    if (offset === incompleteDayOffset) continue;
    plan.push({ day, meal: "lunch", items: lunches[index % lunches.length] });
    plan.push({ day, meal: "dinner", items: dinners[index % dinners.length] });
    const snacks: PlanItem[] = [{ type: "food", food: "apple", grams: 150, portionLabel: "1 mela media" }];
    if (index % 2 === 0) snacks.push({ type: "food", food: "walnuts", grams: 30, portionLabel: "1 manciata" });
    if (offset === gelatoDayOffset) snacks.push({ type: "quick", label: "Gelato", kcal: 250, protein: 4, carbs: 32, fat: 12 });
    plan.push({ day, meal: "snack", items: snacks });
  }
  return plan;
}

export const weighIns: readonly { offset: number; weightKg: number }[] = [
  { offset: -13, weightKg: 82.6 },
  { offset: -11, weightKg: 82.4 },
  { offset: -9, weightKg: 82.5 },
  { offset: -7, weightKg: 82.1 },
  { offset: -5, weightKg: 81.9 },
  { offset: -3, weightKg: 81.8 },
  { offset: -1, weightKg: 81.6 },
];

export type ProfileSeed = {
  sex: Sex;
  birthDate: string;
  heightCm: number;
  activityLevel: ActivityLevel;
  goal: GoalType;
  weeklyRateKg: number;
  targetWeightKg: number | null;
};

export const fullProfile: ProfileSeed = {
  sex: "female",
  birthDate: "1988-03-14",
  heightCm: 168,
  activityLevel: "moderate",
  goal: "lose",
  weeklyRateKg: 0.5,
  targetWeightKg: 76,
};

export const emptyProfile: ProfileSeed & { weightKg: number } = {
  sex: "male",
  birthDate: "1992-09-02",
  heightCm: 180,
  activityLevel: "light",
  goal: "maintain",
  weeklyRateKg: 0.5,
  targetWeightKg: null,
  weightKg: 75,
};

export const favoriteFoodSlugs = ["apple", "milk", "pasta"] as const;

export const savedMeals = [{ name: "Colazione solita", defaultMeal: "breakfast" as const, items: usualBreakfast }];

export const storedMeals = [
  { name: "Minestrone", location: "fridge" as const, preparedOnOffset: -2, portions: 2, items: [{ type: "recipe", recipe: "minestrone", servings: 1 }] as const },
];

export const cookware = [
  { name: "Padella grande", weightG: 850 },
  { name: "Pentola media", weightG: 1250 },
];

type FoodValues = Pick<CatalogFood, "kcal" | "protein" | "carbs" | "fat" | "fiber" | "sugars" | "saturatedFat" | "salt">;

function per100(food: FoodValues): Nutrients {
  return { kcal: food.kcal, protein: food.protein, carbs: food.carbs, fat: food.fat };
}

function extras(food: FoodValues): ExtraNutrients {
  return { fiber: food.fiber, sugars: food.sugars, saturatedFat: food.saturatedFat, salt: food.salt };
}

export function findFood(slug: string) {
  const food = [...catalogFoods, ...personalFoods].find((candidate) => candidate.slug === slug);
  if (!food) throw new Error(`Unknown food slug ${slug}`);
  return food;
}

export function findRecipe(slug: string) {
  const recipe = recipes.find((candidate) => candidate.slug === slug);
  if (!recipe) throw new Error(`Unknown recipe slug ${slug}`);
  return recipe;
}

export function recipeNutrition(recipe: RecipeDefinition) {
  const ingredients = recipe.ingredients.map(({ food, grams }) => ({ food: findFood(food), grams }));
  const nutrition = computeRecipeNutrition({
    ingredients: ingredients.map(({ food, grams }) => ({ grams, per100: per100(food) })),
    cookedWeightG: recipe.cookedWeightG,
    servings: recipe.servings,
  });
  const totalExtras = sumExtras(ingredients.map(({ food, grams }) => scaleExtras(extras(food), grams)));
  return { nutrition, totalExtras };
}

export type EntrySnapshot = {
  kind: "food" | "recipe" | "quick";
  food: string | null;
  recipe: string | null;
  label: string;
  grams: number | null;
  servings: number | null;
  portionLabel: string | null;
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
} & ExtraNutrients;

export function entrySnapshot(item: PlanItem): EntrySnapshot {
  if (item.type === "food") {
    const food = findFood(item.food);
    return {
      kind: "food",
      food: food.slug,
      recipe: null,
      label: "brand" in food ? `${food.name}, ${food.brand}` : food.name,
      grams: item.grams,
      servings: null,
      portionLabel: item.portionLabel ?? null,
      ...roundNutrients(scaleNutrients(per100(food), item.grams)),
      ...roundExtras(scaleExtras(extras(food), item.grams)),
    };
  }
  if (item.type === "recipe") {
    const recipe = findRecipe(item.recipe);
    const { nutrition, totalExtras } = recipeNutrition(recipe);
    return {
      kind: "recipe",
      food: null,
      recipe: recipe.slug,
      label: recipe.name,
      grams: null,
      servings: item.servings,
      portionLabel: null,
      ...roundNutrients(recipePortionNutrients(nutrition, { servings: item.servings })),
      ...roundExtras(multiplyExtras(totalExtras, item.servings / nutrition.servings)),
    };
  }
  return {
    kind: "quick",
    food: null,
    recipe: null,
    label: item.label,
    grams: null,
    servings: null,
    portionLabel: null,
    kcal: item.kcal,
    protein: item.protein ?? 0,
    carbs: item.carbs ?? 0,
    fat: item.fat ?? 0,
    ...emptyExtraNutrients,
  };
}

export function isLocalDatabaseHost(hostname: string) {
  return ["localhost", "127.0.0.1", "::1", "[::1]", "database", "postgres"].includes(hostname);
}
