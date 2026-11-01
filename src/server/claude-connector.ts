import "server-only";
import { McpServer } from "@modelcontextprotocol/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { database } from "@/db";
import { type diaryEntry, measurement } from "@/db/schema";
import {
  connectorInstructions,
  describeDay,
  describeEntry,
  describeFoodCandidate,
  describeFoodDetail,
  describeMeasurement,
  describeProfile,
  describeProgress,
  describeRecipeCandidate,
  describeRecipeDetail,
  describeSavedMeal,
  describeStoredMeal,
  describeWeightTrend,
} from "@/lib/claude-connector";
import { bodyMetrics } from "@/lib/nutrition/body-metrics";
import { isCopyOntoItself } from "@/lib/nutrition/copy-meal";
import { addDays, currentHour, daysBetween, isIsoDate, todayIsoDate } from "@/lib/nutrition/days";
import { kcalMismatch } from "@/lib/nutrition/food-checks";
import { type MealType, mealTypes, suggestMeal } from "@/lib/nutrition/meals";
import { weekStart } from "@/lib/nutrition/weeks";
import { maximumStoredPortions, storageLocations } from "@/lib/nutrition/stored-meals";
import { normalizeBarcode } from "@/lib/open-food-facts";
import { nameMatchesQuery } from "@/lib/search";
import { getAdaptiveGoal } from "./adaptive-goal";
import { getDailyTargets, getDiaryDay } from "./diary";
import {
  copyMealEntries,
  editDiaryEntry,
  type EntryItem,
  entryItemSchema,
  insertDiaryEntries,
  removeDiaryEntries,
} from "./diary-entries";
import { archiveOwnFood, editFood, insertFood, markFoodFavorite } from "./food-writes";
import { getFoodDetail, getLoggableFood, recentFoods, searchFoods, visibleFoodIdsByRequested } from "./foods";
import { listIncompleteDays, setIncompleteDay } from "./incomplete-days";
import { listMeasurements, type MeasurementInput, removeMeasurement, writeMeasurement } from "./measurements";
import {
  fetchOpenFoodFactsProduct,
  findVisibleFoodByBarcode,
  importOpenFoodFactsCandidate,
} from "./open-food-facts";
import { getProfileWithLatestWeight } from "./profile";
import { applyAdaptiveTargets, writeProfile } from "./profile-writes";
import { archiveOwnRecipe, editRecipe, insertRecipe, markRecipeFavorite } from "./recipe-writes";
import { getLoggableRecipe, getRecipeForEditing, listLoggableRecipes } from "./recipes";
import {
  editSavedMeal,
  getSavedMeal,
  listSavedMealViews,
  markSavedMealUsed,
  removeSavedMeal,
  saveMealFromEntries,
  savedMealEntryItems,
} from "./saved-meals";
import { getDailyTotals } from "./statistics";
import {
  createStoredMeal,
  editStoredMeal,
  getStoredMeal,
  listStoredMeals,
  logStoredMealPortion,
  removeStoredMeal,
  storeMealFromDiary,
} from "./stored-meals";

const daySchema = z
  .string()
  .refine(isIsoDate, "Use an ISO date such as 2026-10-16.")
  .optional()
  .describe("ISO date (yyyy-mm-dd) in the Europe/Rome time zone. Defaults to today.");

const mealSchema = z
  .enum(mealTypes)
  .optional()
  .describe(
    "breakfast, lunch, dinner or snack. Defaults to the meal of the first saved meal logged, otherwise to the meal that fits the current time in Italy.",
  );

function metricSchema(key: (typeof bodyMetrics)[number]["key"], description: string) {
  const metric = bodyMetrics.find((candidate) => candidate.key === key)!;
  return z.number().min(metric.minimum).max(metric.maximum).describe(description);
}

const otherMeasurementsSchema = z
  .object({
    bodyFatPercent: metricSchema("bodyFatPercent", "Body fat percentage, when the scale measures it."),
    musclePercent: metricSchema("musclePercent", "Muscle mass percentage."),
    visceralFat: metricSchema("visceralFat", "Visceral fat rating."),
    bodyWaterPercent: metricSchema("bodyWaterPercent", "Body water percentage."),
    boneMassKg: metricSchema("boneMassKg", "Bone mass in kg."),
    waistCm: metricSchema("waistCm", "Waist circumference in cm."),
    hipCm: metricSchema("hipCm", "Hip circumference in cm."),
    note: z.string().trim().max(200),
  })
  .partial();

const per100 = (nutrient: string) => z.number().min(0).max(1000).describe(`${nutrient} per 100 g (or 100 ml).`);
const optionalPer100 = (nutrient: string) => per100(nutrient).optional();
const clearablePer100 = (nutrient: string) => per100(nutrient).nullable().optional();

const portionsSchema = z
  .array(z.object({ label: z.string().trim().min(1).max(40), grams: z.number().positive().max(5000) }))
  .max(10);

const ingredientsSchema = z
  .array(
    z.object({
      foodId: z.uuid().describe("foodId returned by search_foods, recent_foods or create_food."),
      grams: z.number().positive().max(20_000).describe("Raw weight in grams (or ml)."),
    }),
  )
  .min(1)
  .max(60);

const logItemSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("food"),
    foodId: z.uuid().describe("foodId returned by search_foods or recent_foods."),
    grams: z.number().positive().max(10_000).describe("Eaten quantity in grams (or ml for liquids)."),
    portionLabel: z.string().max(80).optional().describe("Name of the portion used, e.g. «1 vasetto»."),
  }),
  z.object({
    type: z.literal("recipe"),
    recipeId: z.uuid().describe("recipeId returned by search_foods."),
    grams: z.number().positive().max(10_000).optional().describe("Eaten cooked weight in grams."),
    servings: z.number().positive().max(100).optional().describe("Eaten servings, used when grams is missing."),
  }),
  z.object({
    type: z.literal("quick"),
    label: z.string().trim().min(1).max(80).describe("Short Italian description, e.g. «Pizza margherita»."),
    kcal: z.number().min(0).max(20_000),
    protein: z.number().min(0).max(2_000).optional(),
    carbs: z.number().min(0).max(2_000).optional(),
    fat: z.number().min(0).max(2_000).optional(),
  }),
  z.object({
    type: z.literal("savedMeal"),
    savedMealId: z.uuid().describe("savedMealId returned by search_foods or recent_foods. Logs every food of the meal."),
  }),
  z.object({
    type: z.literal("storedMeal"),
    storedMealId: z
      .uuid()
      .describe("storedMealId returned by search_foods or recent_foods. Logs one portion and removes it from the stored meal."),
  }),
]);

const storedMealItemSchema = z.discriminatedUnion("type", [
  logItemSchema.options[0],
  logItemSchema.options[1],
  logItemSchema.options[2],
]);

async function storedMealsSummary(userId: string) {
  const today = todayIsoDate();
  return (await listStoredMeals(userId)).map((storedMeal) => describeStoredMeal(storedMeal, today));
}

function textResult(value: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(value) }] };
}

function errorResult(error: unknown) {
  const message =
    error instanceof z.ZodError
      ? error.issues.map((issue) => issue.message).join(" ")
      : error instanceof Error
        ? error.message
        : "Something went wrong.";
  return { content: [{ type: "text" as const, text: message }], isError: true };
}

async function daySummary(userId: string, day: string) {
  const [diary, targets] = await Promise.all([getDiaryDay(userId, day), getDailyTargets(userId)]);
  return describeDay(day, diary, targets);
}

async function describeLoggableFood(userId: string, foodId: string) {
  const loggable = await getLoggableFood(userId, foodId);
  if (!loggable) throw new Error("Food not found.");
  return describeFoodCandidate(loggable);
}

function kcalWarnings(values: Parameters<typeof kcalMismatch>[0]) {
  const mismatch = kcalMismatch(values);
  return mismatch
    ? [
        `${values.kcal} kcal do not match the macros (about ${mismatch.expectedKcal} kcal at 4/4/9 kcal per gram). This is normal for alcohol or polyols; otherwise check the label.`,
      ]
    : [];
}

function entryNutrients(row: typeof diaryEntry.$inferSelect) {
  return { ...row, nutrients: { kcal: row.kcal, protein: row.protein, carbs: row.carbs, fat: row.fat } };
}

async function visibleFoodId(userId: string, foodId: string) {
  return (await visibleFoodIdsByRequested(userId, [foodId])).get(foodId) ?? foodId;
}

async function foodDetail(userId: string, foodId: string) {
  const detail = await getFoodDetail(userId, await visibleFoodId(userId, foodId));
  if (!detail) throw new Error("Food not found.");
  return detail;
}

async function recipeDetail(userId: string, recipeId: string) {
  const [loggable, editable] = await Promise.all([
    getLoggableRecipe(userId, recipeId),
    getRecipeForEditing(userId, recipeId),
  ]);
  if (!loggable || !editable) throw new Error("Recipe not found.");
  return describeRecipeDetail(loggable, editable);
}

function recipeWarnings(hasCookedWeight: boolean) {
  return hasCookedWeight
    ? []
    : ["No cooked weight: per100 refers to the raw weight. Log this recipe by servings, or ask for the cooked weight."];
}

async function weights(userId: string) {
  const measurements = await listMeasurements(userId);
  return measurements.map((row) => ({ day: row.measuredOn, value: row.weightKg }));
}

export function createClaudeConnectorServer(userId: string) {
  const server = new McpServer({ name: "bilancia", version: "1.0.0" }, { instructions: connectorInstructions });

  server.registerTool(
    "search_foods",
    {
      title: "Cerca alimenti",
      description:
        "Search the user's food catalog, recipes, saved meals and meals stored in the fridge or freezer. Nutrition values are per 100 g (or 100 ml). Returns foods with portions, the last quantity the user logged and whether the food is a favorite or the user's own, plus matching recipes, saved meals and stored meals.",
      inputSchema: z.object({
        query: z.string().trim().min(2).max(80).describe("Short Italian food name, e.g. «yogurt greco»."),
      }),
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async ({ query }) => {
      try {
        let foods = await searchFoods(userId, query, 8);
        if (foods.length === 0) {
          const shorterQuery = query.split(/\s+/).slice(0, 2).join(" ");
          if (shorterQuery !== query) foods = await searchFoods(userId, shorterQuery, 8);
        }
        const [recipes, savedMeals, storedMeals] = await Promise.all([
          listLoggableRecipes(userId, query),
          listSavedMealViews(userId),
          storedMealsSummary(userId),
        ]);
        return textResult({
          foods: foods.map(describeFoodCandidate),
          recipes: recipes.slice(0, 4).map(describeRecipeCandidate),
          savedMeals: savedMeals
            .filter((savedMeal) => nameMatchesQuery(savedMeal.name, query))
            .slice(0, 3)
            .map(describeSavedMeal),
          storedMeals: storedMeals.filter((storedMeal) => nameMatchesQuery(storedMeal.name, query)),
        });
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  server.registerTool(
    "recent_foods",
    {
      title: "Alimenti recenti",
      description:
        "List the foods the user logged most recently, with the last quantity used, the user's saved meals and every meal stored in the fridge or freezer. Useful for «the usual» and «what do I have in the freezer?».",
      inputSchema: z.object({}),
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async () => {
      try {
        const [foods, savedMeals, storedMeals] = await Promise.all([
          recentFoods(userId, 20),
          listSavedMealViews(userId),
          storedMealsSummary(userId),
        ]);
        return textResult({
          foods: foods.map(describeFoodCandidate),
          savedMeals: savedMeals.slice(0, 10).map(describeSavedMeal),
          storedMeals,
        });
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  server.registerTool(
    "log_meal",
    {
      title: "Registra nel diario",
      description:
        "Add one or more items to a meal of the user's food diary. Each item is a catalog food with grams, a recipe with grams or servings, a saved meal, one portion of a stored meal, or a quick item with estimated kcal and macros. Returns the created entries and the updated day.",
      inputSchema: z.object({
        day: daySchema,
        meal: mealSchema,
        items: z.array(logItemSchema).min(1).max(20),
      }),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    },
    async ({ day, meal, items }) => {
      try {
        const targetDay = day ?? todayIsoDate();
        const entries: EntryItem[] = [];
        const savedMealIds: string[] = [];
        const storedMealIds: string[] = [];
        let savedMealDefault: MealType | null = null;
        for (const item of items) {
          if (item.type === "storedMeal") {
            if (!(await getStoredMeal(userId, item.storedMealId))) throw new Error("Stored meal not found or finished.");
            storedMealIds.push(item.storedMealId);
            continue;
          }
          if (item.type !== "savedMeal") {
            entries.push(entryItemSchema.parse(item));
            continue;
          }
          const saved = await getSavedMeal(userId, item.savedMealId);
          if (!saved) throw new Error("Saved meal not found.");
          if (saved.items.length === 0) throw new Error(`The saved meal «${saved.name}» is empty.`);
          entries.push(...savedMealEntryItems(saved));
          savedMealIds.push(saved.id);
          savedMealDefault ??= saved.defaultMeal;
        }
        const targetMeal = meal ?? savedMealDefault ?? suggestMeal(currentHour());
        const created = await insertDiaryEntries(userId, targetDay, targetMeal, entries, "connector");
        await Promise.all(savedMealIds.map(markSavedMealUsed));
        const storedPortions = [];
        for (const storedMealId of storedMealIds) {
          const portion = await logStoredMealPortion(
            userId,
            { storedMealId, day: targetDay, meal: targetMeal },
            "connector",
          );
          created.push(...portion.entries);
          storedPortions.push({ storedMealId, name: portion.name, portionsLeft: portion.remainingPortions });
        }
        return textResult({
          logged: created.map((row) => describeEntry(entryNutrients(row))),
          ...(storedPortions.length > 0 ? { storedMeals: storedPortions } : {}),
          meal: targetMeal,
          summary: await daySummary(userId, targetDay),
        });
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  server.registerTool(
    "get_day",
    {
      title: "Leggi il diario",
      description: "Read the user's food diary for a day: entries by meal, totals, daily goals and kcal left.",
      inputSchema: z.object({ day: daySchema }),
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async ({ day }) => {
      try {
        return textResult(await daySummary(userId, day ?? todayIsoDate()));
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  server.registerTool(
    "update_entry",
    {
      title: "Modifica una voce",
      description:
        "Change one entry of the user's food diary: move it to another meal, or change the quantity. Food entries take grams, recipe entries grams (cooked weight) or servings, quick entries kcal (macros scale with it). The values are recomputed from the current food or recipe. Use the entryId and type returned by get_day or log_meal. Returns the updated entry and day.",
      inputSchema: z.object({
        entryId: z.uuid(),
        meal: z.enum(mealTypes).optional().describe("Move the entry to this meal of the same day."),
        grams: z.number().positive().max(10_000).optional().describe("New quantity in grams for food and recipe entries."),
        servings: z.number().positive().max(100).optional().describe("New servings for recipe entries, used when grams is missing."),
        kcal: z.number().min(0).max(20_000).optional().describe("New kcal for quick entries."),
        portionLabel: z.string().trim().max(80).nullable().optional().describe("Portion name for food entries; null removes it."),
      }),
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false },
    },
    async ({ entryId, ...changes }) => {
      try {
        if (Object.values(changes).every((value) => value === undefined)) throw new Error("Nothing to change.");
        const updated = await editDiaryEntry(userId, { id: entryId, ...changes });
        return textResult({ updated: describeEntry(entryNutrients(updated)), summary: await daySummary(userId, updated.day) });
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  server.registerTool(
    "delete_entry",
    {
      title: "Elimina voci",
      description:
        "Delete one or more entries from the user's food diary. Use the entryId values returned by get_day or log_meal. Returns the updated days.",
      inputSchema: z.object({ entryIds: z.array(z.uuid()).min(1).max(50) }),
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false },
    },
    async ({ entryIds }) => {
      try {
        const deleted = await removeDiaryEntries(userId, entryIds);
        if (deleted.length === 0) throw new Error("Entry not found.");
        const days = [...new Set(deleted.map((row) => row.day))];
        return textResult({
          deleted: deleted.map((row) => row.label),
          notFound: entryIds.length - deleted.length,
          summaries: await Promise.all(days.map((day) => daySummary(userId, day))),
        });
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  server.registerTool(
    "set_incomplete_day",
    {
      title: "Segna un giorno incompleto",
      description:
        "Mark a past day or today as incomplete when the user did not log everything they ate, or clear the mark. Incomplete days are left out of averages and of the adaptive estimate, and count as on target in the weekly budget.",
      inputSchema: z.object({ day: daySchema, incomplete: z.boolean() }),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async ({ day, incomplete }) => {
      try {
        const targetDay = day ?? todayIsoDate();
        if (targetDay > todayIsoDate()) throw new Error("The day cannot be in the future.");
        await setIncompleteDay(userId, targetDay, incomplete);
        return textResult({ day: targetDay, incomplete });
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  server.registerTool(
    "copy_meal",
    {
      title: "Copia un pasto",
      description:
        "Copy every entry of a meal of one day into a meal of another day, with the same quantities and values. Useful for «the same as yesterday at lunch». Returns the created entries and the updated target day.",
      inputSchema: z.object({
        fromDay: z
          .string()
          .refine(isIsoDate, "Use an ISO date such as 2026-10-16.")
          .describe("ISO date (yyyy-mm-dd) of the day to copy from."),
        fromMeal: z.enum(mealTypes).describe("Meal to copy from: breakfast, lunch, dinner or snack."),
        toDay: daySchema,
        toMeal: z
          .enum(mealTypes)
          .optional()
          .describe("Meal to copy into: breakfast, lunch, dinner or snack. Defaults to the same meal as fromMeal."),
      }),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    },
    async ({ fromDay, fromMeal, toDay, toMeal }) => {
      try {
        const targetDay = toDay ?? todayIsoDate();
        const targetMeal = toMeal ?? fromMeal;
        const copy = { fromDay, fromMeal, toDay: targetDay, toMeal: targetMeal };
        if (isCopyOntoItself(copy)) throw new Error("The source and the target are the same meal of the same day.");
        const created = await copyMealEntries(userId, copy, "connector");
        if (created.length === 0) throw new Error(`There is nothing logged for ${fromMeal} on ${fromDay}.`);
        return textResult({
          copied: created.map((row) => describeEntry(entryNutrients(row))),
          meal: targetMeal,
          summary: await daySummary(userId, targetDay),
        });
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  server.registerTool(
    "lookup_barcode",
    {
      title: "Cerca un codice a barre",
      description:
        "Find a packaged product by its barcode in the user's catalog or, if missing, import it from Open Food Facts. Returns the food ready for log_meal, or found: false when no product with nutrition values exists.",
      inputSchema: z.object({ barcode: z.string().max(40).describe("EAN or UPC barcode digits.") }),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    async ({ barcode }) => {
      const code = normalizeBarcode(barcode);
      if (!code) return errorResult(new Error("A barcode has 6 to 14 digits."));
      try {
        const existing = await findVisibleFoodByBarcode(userId, code);
        if (existing) return textResult({ found: true, source: "catalog", food: await describeLoggableFood(userId, existing) });
        const candidate = await fetchOpenFoodFactsProduct(code);
        if (!candidate) return textResult({ found: false, barcode: code });
        const imported = await importOpenFoodFactsCandidate(candidate);
        return textResult({ found: true, source: "open_food_facts", food: await describeLoggableFood(userId, imported) });
      } catch (error) {
        console.error(error);
        return errorResult(new Error("Open Food Facts is not responding. Try again later."));
      }
    },
  );

  server.registerTool(
    "create_food",
    {
      title: "Crea un alimento",
      description:
        "Create a food in the user's personal catalog, with values per 100 g (or 100 ml) as on the nutrition label. Use only values the user gave you or that you read on a label, unless the user asks you to save your estimate. If a food with the same barcode exists, returns it instead. Returns the food ready for log_meal and warnings about suspicious values.",
      inputSchema: z.object({
        name: z.string().trim().min(1).max(120).describe("Italian product name without the brand, e.g. «Yogurt greco 0%»."),
        brand: z.string().trim().max(80).optional(),
        barcode: z.string().max(40).optional().describe("EAN barcode digits, when known."),
        unit: z
          .enum(["g", "ml"])
          .optional()
          .describe("g (default) for values per 100 g, ml for drinks labeled per 100 ml."),
        kcal: per100("Energy in kcal"),
        protein: per100("Protein in grams"),
        carbs: per100("Carbohydrates in grams"),
        fat: per100("Fat in grams"),
        sugars: optionalPer100("Sugars in grams"),
        saturatedFat: optionalPer100("Saturated fat in grams"),
        fiber: optionalPer100("Fiber in grams"),
        salt: optionalPer100("Salt in grams"),
        portions: portionsSchema.optional().describe("Named portions, e.g. «1 vasetto» of 170 g."),
      }),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    },
    async ({ barcode, unit, portions, ...values }) => {
      try {
        const code = barcode ? normalizeBarcode(barcode) : null;
        if (barcode && !code) throw new Error("A barcode has 6 to 14 digits.");
        if (code) {
          const existing = await findVisibleFoodByBarcode(userId, code);
          if (existing) return textResult({ created: false, food: await describeLoggableFood(userId, existing) });
        }
        const input = { ...values, barcode: code, unit: unit ?? "g", portions: portions ?? [] };
        const foodId = await insertFood(userId, input);
        return textResult({
          created: true,
          food: await describeLoggableFood(userId, foodId),
          warnings: kcalWarnings(input),
        });
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  server.registerTool(
    "create_recipe",
    {
      title: "Crea una ricetta",
      description:
        "Create a recipe from foods of the catalog, with raw ingredient weights. Give the cooked weight of the whole dish when known: without it the values per 100 g refer to the raw weight. Returns the recipe ready for log_meal.",
      inputSchema: z.object({
        name: z.string().trim().min(1).max(120).describe("Italian name, e.g. «Lasagne della nonna»."),
        servings: z.number().int().min(1).max(100).describe("Number of servings the whole dish makes."),
        cookedWeightG: z.number().positive().max(50_000).optional().describe("Weight of the whole cooked dish in grams."),
        servingGrams: z
          .number()
          .positive()
          .max(20_000)
          .optional()
          .describe("Fixed weight of one serving in grams. When set, servings follows from the cooked weight."),
        notes: z.string().trim().max(2000).optional(),
        ingredients: ingredientsSchema,
      }),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    },
    async (input) => {
      try {
        const recipeId = await insertRecipe(userId, input);
        const created = await getLoggableRecipe(userId, recipeId);
        if (!created) throw new Error("Recipe not found.");
        return textResult({
          recipe: describeRecipeCandidate(created),
          warnings: recipeWarnings(created.hasCookedWeight),
        });
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  server.registerTool(
    "log_weight",
    {
      title: "Registra il peso",
      description:
        "Record a weigh-in of the user, with the other body measurements when the user gives them. Returns the new measurementId and the weight trend. Logging the same weight twice on the same day does nothing.",
      inputSchema: otherMeasurementsSchema.extend({
        weightKg: metricSchema("weightKg", "Weight in kg."),
        day: daySchema,
      }),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async ({ day, ...values }) => {
      try {
        const measuredOn = day ?? todayIsoDate();
        const [duplicate] = await database
          .select({ id: measurement.id })
          .from(measurement)
          .where(
            and(
              eq(measurement.userId, userId),
              eq(measurement.measuredOn, measuredOn),
              eq(measurement.weightKg, values.weightKg),
            ),
          );
        const measurementId = duplicate?.id ?? (await writeMeasurement(userId, { ...values, measuredOn }));
        return textResult({
          logged: !duplicate,
          measurementId,
          day: measuredOn,
          weightKg: values.weightKg,
          trend: describeWeightTrend(await weights(userId)),
        });
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  server.registerTool(
    "get_progress",
    {
      title: "Leggi i progressi",
      description:
        "Read the user's progress: daily totals of the last days, average intake, goals, this week's kcal budget, the weight trend and the adaptive estimate of maintenance kcal from intake and weight.",
      inputSchema: z.object({
        days: z.number().int().min(7).max(91).optional().describe("Number of days to read, today included. Defaults to 14."),
      }),
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async ({ days }) => {
      try {
        const today = todayIsoDate();
        const periodDays = days ?? 14;
        const loadedDays = Math.max(periodDays, daysBetween(weekStart(today), today) + 1);
        const [dailyTotals, targets, weightPoints, adaptive, incompleteDays] = await Promise.all([
          getDailyTotals(userId, today, loadedDays),
          getDailyTargets(userId),
          weights(userId),
          getAdaptiveGoal(userId, today),
          listIncompleteDays(userId, addDays(today, -(loadedDays - 1)), today),
        ]);
        return textResult(
          describeProgress({
            today,
            days: periodDays,
            dailyTotals,
            targets,
            weights: weightPoints,
            incompleteDays,
            maintenance: adaptive.estimate,
            suggestedTargetKcal: adaptive.suggestion?.kcal ?? null,
          }),
        );
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  server.registerTool(
    "get_food",
    {
      title: "Leggi un alimento",
      description:
        "Read every value of a food: name, brand, barcode, unit, energy, macros, sugars, saturated fat, fiber and salt per 100 g (or 100 ml), portions, and whether it is a favorite or the user's own. Use it before update_food.",
      inputSchema: z.object({ foodId: z.uuid() }),
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async ({ foodId }) => {
      try {
        return textResult(describeFoodDetail(await foodDetail(userId, foodId)));
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  server.registerTool(
    "update_food",
    {
      title: "Modifica un alimento",
      description:
        "Change a food of the catalog. Pass only the fields to change; null clears an optional value, portions replaces every portion. Changing a food of the global catalog creates the user's own copy, which replaces it from then on: use the returned foodId. Past diary entries keep their values. Returns the updated food and warnings about suspicious values.",
      inputSchema: z.object({
        foodId: z.uuid(),
        name: z.string().trim().min(1).max(120).optional(),
        brand: z.string().trim().max(80).nullable().optional(),
        barcode: z.string().max(40).nullable().optional().describe("EAN barcode digits."),
        unit: z.enum(["g", "ml"]).optional(),
        kcal: per100("Energy in kcal").optional(),
        protein: per100("Protein in grams").optional(),
        carbs: per100("Carbohydrates in grams").optional(),
        fat: per100("Fat in grams").optional(),
        sugars: clearablePer100("Sugars in grams"),
        saturatedFat: clearablePer100("Saturated fat in grams"),
        fiber: clearablePer100("Fiber in grams"),
        salt: clearablePer100("Salt in grams"),
        portions: portionsSchema.optional().describe("Every named portion of the food; an empty list removes them."),
      }),
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false },
    },
    async ({ foodId, barcode, ...changes }) => {
      try {
        const current = await foodDetail(userId, foodId);
        const code = barcode ? normalizeBarcode(barcode) : barcode;
        if (barcode && !code) throw new Error("A barcode has 6 to 14 digits.");
        const input = {
          name: changes.name ?? current.name,
          brand: changes.brand === undefined ? current.brand : changes.brand,
          barcode: code === undefined ? current.barcode : code,
          unit: changes.unit ?? current.unit,
          kcal: changes.kcal ?? current.kcal,
          protein: changes.protein ?? current.protein,
          carbs: changes.carbs ?? current.carbs,
          fat: changes.fat ?? current.fat,
          sugars: changes.sugars === undefined ? current.sugars : changes.sugars,
          saturatedFat: changes.saturatedFat === undefined ? current.saturatedFat : changes.saturatedFat,
          fiber: changes.fiber === undefined ? current.fiber : changes.fiber,
          salt: changes.salt === undefined ? current.salt : changes.salt,
          portions: changes.portions ?? current.portions,
        };
        const updatedId = await editFood(userId, current.id, input);
        return textResult({
          food: describeFoodDetail(await foodDetail(userId, updatedId)),
          copiedFromGlobalCatalog: updatedId !== current.id,
          warnings: kcalWarnings(input),
        });
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  server.registerTool(
    "delete_food",
    {
      title: "Elimina un alimento",
      description:
        "Delete one of the user's own foods (own: true) from the catalog. Foods of the global catalog cannot be deleted. Past diary entries keep their values; recipes and saved meals that use the food stop showing it.",
      inputSchema: z.object({ foodId: z.uuid() }),
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false },
    },
    async ({ foodId }) => {
      try {
        const archived = await archiveOwnFood(userId, foodId);
        return textResult({ deleted: archived.name });
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  server.registerTool(
    "set_favorite",
    {
      title: "Preferiti",
      description: "Add a food or a recipe to the user's favorites, or remove it. Pass foodId or recipeId.",
      inputSchema: z.object({
        foodId: z.uuid().optional(),
        recipeId: z.uuid().optional(),
        favorite: z.boolean(),
      }),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async ({ foodId, recipeId, favorite }) => {
      try {
        if (Boolean(foodId) === Boolean(recipeId)) throw new Error("Pass either foodId or recipeId.");
        const marked = foodId
          ? await markFoodFavorite(userId, await visibleFoodId(userId, foodId), favorite)
          : await markRecipeFavorite(userId, recipeId!, favorite);
        return textResult({ name: marked.name, favorite });
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  server.registerTool(
    "get_recipe",
    {
      title: "Leggi una ricetta",
      description:
        "Read a recipe of the user: ingredients with foodId and raw grams, servings, fixed serving weight, cooked weight, notes and values per 100 g and per serving. Use it before update_recipe.",
      inputSchema: z.object({ recipeId: z.uuid() }),
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async ({ recipeId }) => {
      try {
        return textResult(await recipeDetail(userId, recipeId));
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  server.registerTool(
    "update_recipe",
    {
      title: "Modifica una ricetta",
      description:
        "Change a recipe of the user. Pass only the fields to change; ingredients replaces the whole list, so call get_recipe first and send every ingredient to keep. cookedWeightG null removes the cooked weight, servingGrams null removes the fixed serving weight. Past diary entries keep their values. Returns the updated recipe.",
      inputSchema: z.object({
        recipeId: z.uuid(),
        name: z.string().trim().min(1).max(120).optional(),
        servings: z.number().int().min(1).max(100).optional(),
        cookedWeightG: z.number().positive().max(50_000).nullable().optional().describe("Weight of the whole cooked dish in grams."),
        servingGrams: z
          .number()
          .positive()
          .max(20_000)
          .nullable()
          .optional()
          .describe("Fixed weight of one serving in grams; null goes back to counting servings."),
        notes: z.string().trim().max(2000).nullable().optional(),
        ingredients: ingredientsSchema.optional(),
      }),
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false },
    },
    async ({ recipeId, ...changes }) => {
      try {
        const current = await getRecipeForEditing(userId, recipeId);
        if (!current) throw new Error("Recipe not found.");
        const input = {
          name: changes.name ?? current.name,
          servings: changes.servings ?? current.servings,
          cookedWeightG: changes.cookedWeightG === undefined ? current.cookedWeightG : changes.cookedWeightG,
          servingGrams: changes.servingGrams === undefined ? current.servingGrams : changes.servingGrams,
          notes: changes.notes === undefined ? current.notes : changes.notes,
          ingredients:
            changes.ingredients ??
            current.ingredients.map((ingredient) => ({ foodId: ingredient.foodId, grams: ingredient.grams })),
        };
        await editRecipe(userId, recipeId, input);
        return textResult({ recipe: await recipeDetail(userId, recipeId), warnings: recipeWarnings(Boolean(input.cookedWeightG)) });
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  server.registerTool(
    "delete_recipe",
    {
      title: "Elimina una ricetta",
      description:
        "Delete a recipe of the user. Past diary entries keep their values; saved meals that use the recipe stop showing it.",
      inputSchema: z.object({ recipeId: z.uuid() }),
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false },
    },
    async ({ recipeId }) => {
      try {
        const archived = await archiveOwnRecipe(userId, recipeId);
        return textResult({ deleted: archived.name });
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  server.registerTool(
    "save_meal",
    {
      title: "Salva un pasto",
      description:
        "Save the foods and recipes logged in a meal of a day as a saved meal, to log them again later in one step. Quick entries are not saved. Returns the saved meal.",
      inputSchema: z.object({
        day: daySchema,
        meal: z.enum(mealTypes).describe("Meal to save: breakfast, lunch, dinner or snack."),
        name: z.string().trim().min(1).max(80).describe("Short Italian name, e.g. «Colazione solita»."),
      }),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    },
    async ({ day, meal, name }) => {
      try {
        const saved = await saveMealFromEntries(userId, { day: day ?? todayIsoDate(), meal, name });
        const view = await getSavedMeal(userId, saved.id);
        if (!view) throw new Error("Saved meal not found.");
        return textResult({ savedMeal: describeSavedMeal(view), skippedQuickEntries: saved.skippedCount });
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  server.registerTool(
    "update_saved_meal",
    {
      title: "Modifica un pasto salvato",
      description:
        "Rename a saved meal or remove some of its items. Use the savedMealId and itemId values returned by search_foods or recent_foods. Returns the updated saved meal.",
      inputSchema: z.object({
        savedMealId: z.uuid(),
        name: z.string().trim().min(1).max(80).optional(),
        removeItemIds: z.array(z.uuid()).max(100).optional(),
      }),
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false },
    },
    async ({ savedMealId, name, removeItemIds }) => {
      try {
        const current = await getSavedMeal(userId, savedMealId);
        if (!current) throw new Error("Saved meal not found.");
        await editSavedMeal(userId, {
          savedMealId,
          name: name ?? current.name,
          removedItemIds: removeItemIds ?? [],
        });
        const updated = await getSavedMeal(userId, savedMealId);
        return textResult({ savedMeal: updated && describeSavedMeal(updated) });
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  server.registerTool(
    "delete_saved_meal",
    {
      title: "Elimina un pasto salvato",
      description: "Delete a saved meal. The foods, recipes and diary entries stay.",
      inputSchema: z.object({ savedMealId: z.uuid() }),
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false },
    },
    async ({ savedMealId }) => {
      try {
        const deleted = await removeSavedMeal(userId, savedMealId);
        return textResult({ deleted: deleted.name });
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  server.registerTool(
    "store_meal",
    {
      title: "Metti da parte un pasto",
      description:
        "Store a meal the user cooked and put in the fridge or freezer, to log it later one portion at a time. Pass the foods and recipes of ONE portion in items, or fromMeal to copy a meal already logged in the diary (one portion as logged). Returns the stored meal.",
      inputSchema: z.object({
        name: z.string().trim().min(1).max(80).describe("Short Italian name, e.g. «Lasagna»."),
        location: z.enum(storageLocations).describe("fridge or freezer."),
        portions: z.number().int().min(1).max(maximumStoredPortions).describe("Number of identical portions stored."),
        preparedOn: daySchema.describe("ISO date the meal was cooked. Defaults to today."),
        items: z
          .array(storedMealItemSchema)
          .min(1)
          .max(30)
          .optional()
          .describe("Foods, recipes or quick items of one portion. Recipes with cooked grams or servings."),
        fromMeal: z
          .object({ day: daySchema, meal: z.enum(mealTypes) })
          .optional()
          .describe("A logged meal to copy as one portion, instead of items."),
      }),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    },
    async ({ name, location, portions, preparedOn, items, fromMeal }) => {
      try {
        if (!items === !fromMeal) throw new Error("Pass either items or fromMeal.");
        const stored = { name, location, portions, preparedOn: preparedOn ?? todayIsoDate() };
        const id = items
          ? await createStoredMeal(userId, { ...stored, items: items.map((item) => entryItemSchema.parse(item)) })
          : (await storeMealFromDiary(userId, { ...stored, day: fromMeal!.day ?? todayIsoDate(), meal: fromMeal!.meal }))
              .id;
        const view = await getStoredMeal(userId, id);
        if (!view) throw new Error("Stored meal not found.");
        return textResult({ storedMeal: describeStoredMeal(view, todayIsoDate()) });
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  server.registerTool(
    "update_stored_meal",
    {
      title: "Modifica un pasto messo da parte",
      description:
        "Change a stored meal: name, fridge or freezer, preparation date, portions left, items of one portion to remove or add. Pass only the fields to change. Use the storedMealId and itemId values returned by search_foods or recent_foods.",
      inputSchema: z.object({
        storedMealId: z.uuid(),
        name: z.string().trim().min(1).max(80).optional(),
        location: z.enum(storageLocations).optional(),
        preparedOn: daySchema.describe("ISO date the meal was cooked."),
        portionsLeft: z.number().int().min(1).max(maximumStoredPortions).optional(),
        removeItemIds: z.array(z.uuid()).max(100).optional(),
        addItems: z.array(storedMealItemSchema).max(30).optional(),
      }),
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: false },
    },
    async ({ storedMealId, name, location, preparedOn, portionsLeft, removeItemIds, addItems }) => {
      try {
        const current = await getStoredMeal(userId, storedMealId);
        if (!current) throw new Error("Stored meal not found or finished.");
        await editStoredMeal(userId, {
          storedMealId,
          name: name ?? current.name,
          location: location ?? current.location,
          preparedOn: preparedOn ?? current.preparedOn,
          portions: portionsLeft ?? current.portions,
          removedItemIds: removeItemIds ?? [],
          addedItems: (addItems ?? []).map((item) => entryItemSchema.parse(item)),
        });
        const updated = await getStoredMeal(userId, storedMealId);
        return textResult({ storedMeal: updated && describeStoredMeal(updated, todayIsoDate()) });
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  server.registerTool(
    "delete_stored_meal",
    {
      title: "Elimina un pasto messo da parte",
      description: "Delete a stored meal, for example because the user threw it away. Diary entries already logged stay.",
      inputSchema: z.object({ storedMealId: z.uuid() }),
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false },
    },
    async ({ storedMealId }) => {
      try {
        const deleted = await removeStoredMeal(userId, storedMealId);
        return textResult({ deleted: deleted.name });
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  server.registerTool(
    "list_measurements",
    {
      title: "Elenca le misurazioni",
      description:
        "List the user's weigh-ins and body measurements, newest first, with their measurementId for update_measurement and delete_measurement.",
      inputSchema: z.object({
        days: z.number().int().min(1).max(730).optional().describe("Number of days to read, today included. Defaults to 30."),
      }),
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async ({ days }) => {
      try {
        const fromDay = addDays(todayIsoDate(), -((days ?? 30) - 1));
        const measurements = await listMeasurements(userId);
        return textResult({
          fromDay,
          measurements: measurements
            .filter((row) => row.measuredOn >= fromDay)
            .reverse()
            .map(describeMeasurement),
        });
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  server.registerTool(
    "update_measurement",
    {
      title: "Modifica una misurazione",
      description:
        "Change a weigh-in or body measurement. Pass only the fields to change; null clears an optional value. Returns the updated measurement.",
      inputSchema: z.object({
        measurementId: z.uuid(),
        day: daySchema.describe("New ISO date (yyyy-mm-dd) of the measurement."),
        weightKg: metricSchema("weightKg", "Weight in kg.").optional(),
        clear: z
          .array(otherMeasurementsSchema.keyof())
          .optional()
          .describe("Optional values to remove from the measurement."),
        ...otherMeasurementsSchema.shape,
      }),
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false },
    },
    async ({ measurementId, day, weightKg, clear, ...changes }) => {
      try {
        const current = (await listMeasurements(userId)).find((row) => row.id === measurementId);
        if (!current) throw new Error("Measurement not found.");
        const input: MeasurementInput = {
          ...current,
          ...changes,
          ...Object.fromEntries((clear ?? []).map((key) => [key, null])),
          measuredOn: day ?? current.measuredOn,
          weightKg: weightKg ?? current.weightKg,
        };
        await writeMeasurement(userId, input);
        const updated = (await listMeasurements(userId)).find((row) => row.id === measurementId);
        return textResult({ measurement: updated && describeMeasurement(updated) });
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  server.registerTool(
    "delete_measurement",
    {
      title: "Elimina una misurazione",
      description: "Delete a weigh-in or body measurement. Returns the weight trend.",
      inputSchema: z.object({ measurementId: z.uuid() }),
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false },
    },
    async ({ measurementId }) => {
      try {
        const deleted = await removeMeasurement(userId, measurementId);
        return textResult({
          deleted: { day: deleted.measuredOn, weightKg: deleted.weightKg },
          trend: describeWeightTrend(await weights(userId)),
        });
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  server.registerTool(
    "get_profile",
    {
      title: "Leggi il profilo",
      description:
        "Read the user's profile: sex, birth date, height, latest weight, activity level, goal (lose, maintain, gain), weekly rate, target weight and daily targets (custom: true when set by hand or from the adaptive estimate).",
      inputSchema: z.object({}),
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async () => {
      try {
        const { profile, latestWeight } = await getProfileWithLatestWeight(userId);
        return textResult(describeProfile(profile, latestWeight));
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  server.registerTool(
    "update_profile",
    {
      title: "Modifica profilo e obiettivi",
      description:
        "Change the user's profile and daily targets. Pass only the fields to change. Targets are computed from sex, age, height, latest weight, activity, goal and weekly rate, unless they are custom: customTargets sets them by hand, null goes back to the computed ones, and when omitted custom targets stay as they are. Record the weight with log_weight, not here. Returns the updated profile.",
      inputSchema: z.object({
        sex: z.enum(["male", "female"]).optional(),
        birthDate: z.string().refine(isIsoDate, "Use an ISO date such as 1990-05-01.").optional(),
        heightCm: z.number().min(100).max(250).optional(),
        activityLevel: z.enum(["sedentary", "light", "moderate", "active", "very_active"]).optional(),
        goal: z.enum(["lose", "maintain", "gain"]).optional(),
        weeklyRateKg: z.number().min(0.1).max(1).optional().describe("Kg per week to lose or gain."),
        targetWeightKg: z.number().min(30).max(300).nullable().optional(),
        customTargets: z
          .object({
            kcal: z.number().int().min(800).max(6000),
            proteinG: z.number().int().min(0).max(500),
            carbsG: z.number().int().min(0).max(1000),
            fatG: z.number().int().min(0).max(400),
          })
          .nullable()
          .optional(),
      }),
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false },
    },
    async (changes) => {
      try {
        const { profile } = await getProfileWithLatestWeight(userId);
        const sex = changes.sex ?? profile?.sex;
        const birthDate = changes.birthDate ?? profile?.birthDate;
        const heightCm = changes.heightCm ?? profile?.heightCm;
        if (!sex || !birthDate || !heightCm) throw new Error("The profile is incomplete: pass sex, birthDate and heightCm.");
        const savedTargets =
          profile?.targetsCustomized && profile.targetKcal
            ? {
                kcal: profile.targetKcal,
                proteinG: profile.targetProteinG ?? 0,
                carbsG: profile.targetCarbsG ?? 0,
                fatG: profile.targetFatG ?? 0,
              }
            : null;
        await writeProfile(userId, {
          sex,
          birthDate,
          heightCm,
          activityLevel: changes.activityLevel ?? profile?.activityLevel ?? "light",
          goal: changes.goal ?? profile?.goal ?? "maintain",
          weeklyRateKg: changes.weeklyRateKg ?? profile?.weeklyRateKg ?? 0.5,
          targetWeightKg: changes.targetWeightKg === undefined ? profile?.targetWeightKg : changes.targetWeightKg,
          customTargets: changes.customTargets === undefined ? savedTargets : changes.customTargets,
        });
        const updated = await getProfileWithLatestWeight(userId);
        return textResult(describeProfile(updated.profile, updated.latestWeight));
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  server.registerTool(
    "apply_suggested_targets",
    {
      title: "Applica l'obiettivo suggerito",
      description:
        "Replace the daily targets with the ones suggested by the adaptive estimate of maintenance kcal (maintenance.suggestedTargetKcal in get_progress), keeping the user's goal and weekly rate. Ask the user before calling it. Returns the new and the previous targets.",
      inputSchema: z.object({}),
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false },
    },
    async () => {
      try {
        const { applied, previous } = await applyAdaptiveTargets(userId);
        return textResult({
          targets: { kcal: applied.kcal, protein: applied.proteinG, carbs: applied.carbsG, fat: applied.fatG },
          previous: { kcal: previous.kcal, protein: previous.proteinG, carbs: previous.carbsG, fat: previous.fatG },
        });
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  return server;
}
