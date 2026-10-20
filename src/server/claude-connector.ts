import "server-only";
import { McpServer } from "@modelcontextprotocol/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { database } from "@/db";
import { diaryEntry } from "@/db/schema";
import {
  connectorInstructions,
  describeDay,
  describeEntry,
  describeFoodCandidate,
  describeRecipeCandidate,
} from "@/lib/claude-connector";
import { currentHour, isIsoDate, todayIsoDate } from "@/lib/nutrition/days";
import { mealTypes, suggestMeal } from "@/lib/nutrition/meals";
import { getDailyTargets, getDiaryDay } from "./diary";
import { entryItemSchema, insertDiaryEntries } from "./diary-entries";
import { recentFoods, searchFoods } from "./foods";
import { listLoggableRecipes } from "./recipes";

const daySchema = z
  .string()
  .refine(isIsoDate, "Use an ISO date such as 2026-10-16.")
  .optional()
  .describe("ISO date (yyyy-mm-dd) in the Europe/Rome time zone. Defaults to today.");

const mealSchema = z
  .enum(mealTypes)
  .optional()
  .describe("breakfast, lunch, dinner or snack. Defaults to the meal that fits the current time in Italy.");

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
]);

function textResult(value: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(value) }] };
}

function errorResult(error: unknown) {
  const message = error instanceof Error ? error.message : "Something went wrong.";
  return { content: [{ type: "text" as const, text: message }], isError: true };
}

async function daySummary(userId: string, day: string) {
  const [diary, targets] = await Promise.all([getDiaryDay(userId, day), getDailyTargets(userId)]);
  return describeDay(day, diary, targets);
}

export function createClaudeConnectorServer(userId: string) {
  const server = new McpServer({ name: "bilancia", version: "1.0.0" }, { instructions: connectorInstructions });

  server.registerTool(
    "search_foods",
    {
      title: "Cerca alimenti",
      description:
        "Search the user's food catalog and recipes. Nutrition values are per 100 g (or 100 ml). Returns foods with portions, the last quantity the user logged and whether the food is a favorite or the user's own, plus matching recipes.",
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
        const recipes = (await listLoggableRecipes(userId, query)).slice(0, 4);
        return textResult({
          foods: foods.map(describeFoodCandidate),
          recipes: recipes.map(describeRecipeCandidate),
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
      description: "List the foods the user logged most recently, with the last quantity used. Useful for «the usual».",
      inputSchema: z.object({}),
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async () => {
      try {
        return textResult({ foods: (await recentFoods(userId, 20)).map(describeFoodCandidate) });
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
        "Add one or more items to a meal of the user's food diary. Each item is a catalog food with grams, a recipe with grams or servings, or a quick item with estimated kcal and macros. Returns the created entries and the updated day.",
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
        const targetMeal = meal ?? suggestMeal(currentHour());
        const created = await insertDiaryEntries(
          userId,
          targetDay,
          targetMeal,
          items.map((item) => entryItemSchema.parse(item)),
          "connector",
        );
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

  return server;
}
