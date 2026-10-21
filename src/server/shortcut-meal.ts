import "server-only";
import { and, eq, gt, inArray, sql } from "drizzle-orm";
import { database } from "@/db";
import { diaryEntry, savedMeal } from "@/db/schema";
import { describeFoodCandidate } from "@/lib/claude-connector";
import { addDays, currentHour, formatLongDay, todayIsoDate } from "@/lib/nutrition/days";
import { suggestMeal } from "@/lib/nutrition/meals";
import { describeShortcutLog, describeShortcutUndo, resolveFoodChoices, type ShortcutCandidate } from "@/lib/shortcut-meal";
import { chooseShortcutFoods, interpretShortcutMeal, type ShortcutChoiceItem } from "./ai";
import { getDailyTargets, getDiaryDay } from "./diary";
import { type EntryItem, insertDiaryEntries } from "./diary-entries";
import { searchFoods } from "./foods";
import { listLoggableRecipes } from "./recipes";
import { listSavedMealViews } from "./saved-meals";

export class ShortcutError extends Error {}

const maximumReferences = 100;
const candidatesPerFood = 5;

async function findCandidates(userId: string, query: string) {
  const candidates = await searchFoods(userId, query, candidatesPerFood);
  if (candidates.length > 0) return candidates;
  const shorterQuery = query.split(/\s+/).slice(0, 2).join(" ");
  return shorterQuery === query ? [] : searchFoods(userId, shorterQuery, candidatesPerFood);
}

export async function logShortcutMeal(userId: string, text: string, now = new Date()) {
  const today = todayIsoDate(now);
  const hour = currentHour(now);
  const [recipes, savedMeals] = await Promise.all([listLoggableRecipes(userId), listSavedMealViews(userId)]);
  const recipeReferences = recipes.slice(0, maximumReferences).map((recipe, index) => ({ ref: `R${index + 1}`, recipe }));
  const savedMealReferences = savedMeals
    .filter((meal) => meal.items.length > 0)
    .slice(0, maximumReferences)
    .map((meal, index) => ({ ref: `M${index + 1}`, meal }));

  const interpretation = await interpretShortcutMeal(userId, {
    text,
    todayLabel: formatLongDay(today).toLowerCase(),
    hour,
    recipes: recipeReferences.map(({ ref, recipe }) => ({
      ref,
      name: recipe.name,
      servings: recipe.servings,
      cookedWeightG: Math.round(recipe.finalWeightG),
    })),
    savedMeals: savedMealReferences.map(({ ref, meal }) => ({ ref, name: meal.name })),
  });

  const chosenSavedMeals = interpretation.savedMeals.flatMap(
    (ref) => savedMealReferences.find((reference) => reference.ref === ref)?.meal ?? [],
  );
  const recipeItems: EntryItem[] = interpretation.recipes.flatMap((choice) => {
    const reference = recipeReferences.find(({ ref }) => ref === choice.ref);
    return reference
      ? [{ type: "recipe" as const, recipeId: reference.recipe.id, grams: choice.grams, servings: choice.servings }]
      : [];
  });
  const savedMealItems: EntryItem[] = chosenSavedMeals.flatMap((meal) =>
    meal.items.map((item) =>
      item.type === "food"
        ? { type: "food" as const, foodId: item.referenceId, grams: item.grams ?? 100 }
        : { type: "recipe" as const, recipeId: item.referenceId, grams: item.grams, servings: item.servings },
    ),
  );

  let foodItems: EntryItem[] = [];
  if (interpretation.foods.length > 0) {
    const candidateLists = await Promise.all(interpretation.foods.map((food) => findCandidates(userId, food.query)));
    const references: ShortcutCandidate[] = [];
    const choiceItems: ShortcutChoiceItem[] = interpretation.foods.map((food, index) => ({
      item: index + 1,
      description: food.description,
      grams: food.grams,
      estimatedKcal: food.estimatedKcal,
      candidates: candidateLists[index].map((candidate) => {
        const ref = `F${references.length + 1}`;
        references.push({ ref, foodId: candidate.id, item: index + 1 });
        const { name, unit, per100, portions, lastGrams, favorite, own } = describeFoodCandidate(candidate);
        return { ref, name, unit, per100, portions, lastGrams, favorite, own };
      }),
    }));
    const choices = references.length > 0 ? await chooseShortcutFoods(userId, choiceItems) : [];
    foodItems = resolveFoodChoices(interpretation.foods, references, choices);
  }

  const items = [...savedMealItems, ...recipeItems, ...foodItems];
  if (items.length === 0) {
    throw new ShortcutError("Non ho capito cosa hai mangiato. Riprova nominando gli alimenti.");
  }

  const day = addDays(today, -interpretation.daysAgo);
  const meal = interpretation.meal ?? chosenSavedMeals[0]?.defaultMeal ?? suggestMeal(hour);
  const created = await insertDiaryEntries(userId, day, meal, items, "shortcut");
  if (chosenSavedMeals.length > 0) {
    await database
      .update(savedMeal)
      .set({ updatedAt: new Date() })
      .where(and(eq(savedMeal.userId, userId), inArray(savedMeal.id, chosenSavedMeals.map(({ id }) => id))));
  }

  const [diary, targets] = await Promise.all([getDiaryDay(userId, day), getDailyTargets(userId)]);
  const remainingKcal = targets ? Math.round(targets.kcal - diary.totals.kcal) : null;
  const entries = created.map((entry) => ({
    label: entry.label,
    grams: entry.grams === null ? null : Math.round(entry.grams),
    servings: entry.servings,
    kcal: Math.round(entry.kcal),
  }));
  return {
    message: describeShortcutLog({ day, today, meal, entries, remainingKcal }),
    day,
    meal,
    entries,
    remainingKcal,
  };
}

export async function undoLastShortcutMeal(userId: string) {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const latest = database
    .select({ createdAt: sql`max(${diaryEntry.createdAt})` })
    .from(diaryEntry)
    .where(and(eq(diaryEntry.userId, userId), eq(diaryEntry.source, "shortcut"), gt(diaryEntry.createdAt, since)));
  const deleted = await database
    .delete(diaryEntry)
    .where(
      and(
        eq(diaryEntry.userId, userId),
        eq(diaryEntry.source, "shortcut"),
        sql`${diaryEntry.createdAt} = (${latest})`,
      ),
    )
    .returning({ label: diaryEntry.label, day: diaryEntry.day });
  return { message: describeShortcutUndo(deleted.map(({ label }) => label)), deleted: deleted.length };
}
