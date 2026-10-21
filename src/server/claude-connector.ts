import "server-only";
import { McpServer } from "@modelcontextprotocol/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { database } from "@/db";
import { diaryEntry, measurement } from "@/db/schema";
import {
  connectorInstructions,
  describeDay,
  describeEntry,
  describeFoodCandidate,
  describeProgress,
  describeRecipeCandidate,
  describeSavedMeal,
  describeWeightTrend,
} from "@/lib/claude-connector";
import { bodyMetrics } from "@/lib/nutrition/body-metrics";
import { currentHour, daysBetween, isIsoDate, todayIsoDate } from "@/lib/nutrition/days";
import { kcalMismatch } from "@/lib/nutrition/food-checks";
import { type MealType, mealTypes, suggestMeal } from "@/lib/nutrition/meals";
import { weekStart } from "@/lib/nutrition/weeks";
import { normalizeBarcode } from "@/lib/open-food-facts";
import { nameMatchesQuery } from "@/lib/search";
import { getAdaptiveGoal } from "./adaptive-goal";
import { getDailyTargets, getDiaryDay } from "./diary";
import { type EntryItem, entryItemSchema, insertDiaryEntries } from "./diary-entries";
import { insertFood } from "./food-writes";
import { getLoggableFood, recentFoods, searchFoods } from "./foods";
import { listMeasurements } from "./measurements";
import {
  fetchOpenFoodFactsProduct,
  findVisibleFoodByBarcode,
  importOpenFoodFactsCandidate,
} from "./open-food-facts";
import { insertRecipe } from "./recipe-writes";
import { getLoggableRecipe, listLoggableRecipes } from "./recipes";
import { getSavedMeal, listSavedMealViews, markSavedMealUsed, savedMealEntryItems } from "./saved-meals";
import { getDailyTotals } from "./statistics";

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

const weightRange = bodyMetrics.find((metric) => metric.key === "weightKg")!;
const bodyFatRange = bodyMetrics.find((metric) => metric.key === "bodyFatPercent")!;

const per100 = (nutrient: string) => z.number().min(0).max(1000).describe(`${nutrient} per 100 g (or 100 ml).`);
const optionalPer100 = (nutrient: string) => per100(nutrient).optional();

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
]);

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
        "Search the user's food catalog, recipes and saved meals. Nutrition values are per 100 g (or 100 ml). Returns foods with portions, the last quantity the user logged and whether the food is a favorite or the user's own, plus matching recipes and saved meals.",
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
        const [recipes, savedMeals] = await Promise.all([
          listLoggableRecipes(userId, query),
          listSavedMealViews(userId),
        ]);
        return textResult({
          foods: foods.map(describeFoodCandidate),
          recipes: recipes.slice(0, 4).map(describeRecipeCandidate),
          savedMeals: savedMeals
            .filter((savedMeal) => nameMatchesQuery(savedMeal.name, query))
            .slice(0, 3)
            .map(describeSavedMeal),
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
        "List the foods the user logged most recently, with the last quantity used, and the user's saved meals. Useful for «the usual».",
      inputSchema: z.object({}),
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async () => {
      try {
        const [foods, savedMeals] = await Promise.all([recentFoods(userId, 20), listSavedMealViews(userId)]);
        return textResult({
          foods: foods.map(describeFoodCandidate),
          savedMeals: savedMeals.slice(0, 10).map(describeSavedMeal),
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
        "Add one or more items to a meal of the user's food diary. Each item is a catalog food with grams, a recipe with grams or servings, a saved meal, or a quick item with estimated kcal and macros. Returns the created entries and the updated day.",
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
        let savedMealDefault: MealType | null = null;
        for (const item of items) {
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
        return textResult({
          logged: created.map((row) =>
            describeEntry({
              ...row,
              nutrients: { kcal: row.kcal, protein: row.protein, carbs: row.carbs, fat: row.fat },
            }),
          ),
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
    "delete_entry",
    {
      title: "Elimina una voce",
      description: "Delete one entry from the user's food diary. Use the entryId returned by get_day or log_meal.",
      inputSchema: z.object({ entryId: z.uuid() }),
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false },
    },
    async ({ entryId }) => {
      try {
        const [deleted] = await database
          .delete(diaryEntry)
          .where(and(eq(diaryEntry.id, entryId), eq(diaryEntry.userId, userId)))
          .returning({ day: diaryEntry.day, label: diaryEntry.label });
        if (!deleted) throw new Error("Entry not found.");
        return textResult({ deleted: deleted.label, summary: await daySummary(userId, deleted.day) });
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
        portions: z
          .array(z.object({ label: z.string().trim().min(1).max(40), grams: z.number().positive().max(5000) }))
          .max(10)
          .optional()
          .describe("Named portions, e.g. «1 vasetto» of 170 g."),
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
        const mismatch = kcalMismatch(input);
        return textResult({
          created: true,
          food: await describeLoggableFood(userId, foodId),
          warnings: mismatch
            ? [
                `${input.kcal} kcal do not match the macros (about ${mismatch.expectedKcal} kcal at 4/4/9 kcal per gram). This is normal for alcohol or polyols; otherwise check the label and fix the food in the app.`,
              ]
            : [],
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
        notes: z.string().trim().max(2000).optional(),
        ingredients: z
          .array(
            z.object({
              foodId: z.uuid().describe("foodId returned by search_foods, recent_foods or create_food."),
              grams: z.number().positive().max(20_000).describe("Raw weight in grams (or ml)."),
            }),
          )
          .min(1)
          .max(60),
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
          warnings: created.hasCookedWeight
            ? []
            : ["No cooked weight: per100 refers to the raw weight. Log this recipe by servings, or ask for the cooked weight."],
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
        "Record a weigh-in of the user. Returns the weight trend. Logging the same weight twice on the same day does nothing.",
      inputSchema: z.object({
        weightKg: z.number().min(weightRange.minimum).max(weightRange.maximum),
        bodyFatPercent: z
          .number()
          .min(bodyFatRange.minimum)
          .max(bodyFatRange.maximum)
          .optional()
          .describe("Body fat percentage, when the scale measures it."),
        day: daySchema,
      }),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async ({ weightKg, bodyFatPercent, day }) => {
      try {
        const today = todayIsoDate();
        const measuredOn = day ?? today;
        if (measuredOn > today) throw new Error("The day cannot be in the future.");
        const [duplicate] = await database
          .select({ id: measurement.id })
          .from(measurement)
          .where(
            and(
              eq(measurement.userId, userId),
              eq(measurement.measuredOn, measuredOn),
              eq(measurement.weightKg, weightKg),
            ),
          );
        if (!duplicate) {
          await database
            .insert(measurement)
            .values({ userId, measuredOn, weightKg, bodyFatPercent: bodyFatPercent ?? null });
        }
        return textResult({
          logged: !duplicate,
          day: measuredOn,
          weightKg,
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
        const [dailyTotals, targets, weightPoints, adaptive] = await Promise.all([
          getDailyTotals(userId, today, Math.max(periodDays, daysBetween(weekStart(today), today) + 1)),
          getDailyTargets(userId),
          weights(userId),
          getAdaptiveGoal(userId, today),
        ]);
        return textResult(
          describeProgress({
            today,
            days: periodDays,
            dailyTotals,
            targets,
            weights: weightPoints,
            maintenance: adaptive.estimate,
            suggestedTargetKcal: adaptive.suggestion?.kcal ?? null,
          }),
        );
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  return server;
}
