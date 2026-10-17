import "server-only";
import { and, desc, eq, inArray, isNull, notInArray, or, sql, type SQL } from "drizzle-orm";
import { database } from "@/db";
import { diaryEntry, favoriteFood, food, foodPortion } from "@/db/schema";
import { allowedTypos, searchWords } from "@/lib/search";
import type { LoggableFood } from "./loggable";

export function visibleFoodCondition(userId: string): SQL {
  const replacedByUser = database
    .select({ id: sql<string>`${food.replacesFoodId}` })
    .from(food)
    .where(and(eq(food.ownerId, userId), sql`${food.replacesFoodId} is not null`));
  return and(
    isNull(food.archivedAt),
    or(eq(food.ownerId, userId), and(isNull(food.ownerId), notInArray(food.id, replacedByUser))),
  )!;
}

const foodSearchText = sql`search_text(${food.name} || ' ' || coalesce(${food.brand}, ''))`;

function searchConditions(query: string): { fuzzy: SQL; exact: SQL } | undefined {
  const words = searchWords(query);
  if (words.length === 0) return undefined;
  return {
    fuzzy: and(
      ...words.map((word) => sql`fuzzy_word_match(${foodSearchText}, search_text(${word}), ${allowedTypos(word)})`),
    )!,
    exact: and(
      ...words.map((word) => sql`${foodSearchText} like '%' || search_text(${escapeLike(word)}) || '%'`),
    )!,
  };
}

function escapeLike(value: string) {
  return value.replace(/[\\%_]/g, (character) => `\\${character}`);
}

const foodColumns = {
  id: food.id,
  name: food.name,
  brand: food.brand,
  unit: food.unit,
  kcal: food.kcal,
  protein: food.protein,
  carbs: food.carbs,
  fat: food.fat,
  ownerId: food.ownerId,
  replacesFoodId: food.replacesFoodId,
};

type FoodRow = {
  id: string;
  name: string;
  brand: string | null;
  unit: "g" | "ml";
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  ownerId: string | null;
  replacesFoodId: string | null;
};

async function toLoggableFoods(userId: string, rows: FoodRow[]): Promise<LoggableFood[]> {
  if (rows.length === 0) return [];
  const foodIds = rows.map((row) => row.id);
  const replacedFoodIds = rows.flatMap((row) => (row.replacesFoodId ? [row.replacesFoodId] : []));
  const [portions, favorites, lastQuantities] = await Promise.all([
    database
      .select({ foodId: foodPortion.foodId, label: foodPortion.label, grams: foodPortion.grams })
      .from(foodPortion)
      .where(inArray(foodPortion.foodId, foodIds))
      .orderBy(foodPortion.position),
    database
      .select({ foodId: favoriteFood.foodId })
      .from(favoriteFood)
      .where(and(eq(favoriteFood.userId, userId), inArray(favoriteFood.foodId, foodIds))),
    database
      .selectDistinctOn([diaryEntry.foodId], {
        foodId: diaryEntry.foodId,
        grams: diaryEntry.grams,
        createdAt: diaryEntry.createdAt,
      })
      .from(diaryEntry)
      .where(and(eq(diaryEntry.userId, userId), inArray(diaryEntry.foodId, [...foodIds, ...replacedFoodIds])))
      .orderBy(diaryEntry.foodId, desc(diaryEntry.createdAt)),
  ]);
  const favoriteIds = new Set(favorites.map((favorite) => favorite.foodId));
  const lastQuantityByFood = new Map(lastQuantities.map((row) => [row.foodId, row]));
  function lastGramsOf(row: FoodRow) {
    const own = lastQuantityByFood.get(row.id);
    const replaced = row.replacesFoodId ? lastQuantityByFood.get(row.replacesFoodId) : undefined;
    const latest = own && replaced ? (own.createdAt >= replaced.createdAt ? own : replaced) : (own ?? replaced);
    return latest?.grams ?? null;
  }

  return rows.map((row) => ({
    type: "food",
    id: row.id,
    name: row.name,
    brand: row.brand,
    unit: row.unit,
    per100: { kcal: row.kcal, protein: row.protein, carbs: row.carbs, fat: row.fat },
    portions: portions
      .filter((portion) => portion.foodId === row.id)
      .map((portion) => ({ label: portion.label, grams: portion.grams })),
    lastGrams: lastGramsOf(row),
    isFavorite: favoriteIds.has(row.id),
    isOwn: row.ownerId === userId,
  }));
}

export async function searchFoods(userId: string, query: string, limit = 30) {
  const conditions = searchConditions(query);
  if (!conditions) return [];
  const normalizedQuery = query.trim();
  const usage = usageSubquery(userId);

  const rows = await database
    .select(foodColumns)
    .from(food)
    .leftJoin(usage, eq(usage.foodId, food.id))
    .leftJoin(favoriteFood, and(eq(favoriteFood.foodId, food.id), eq(favoriteFood.userId, userId)))
    .where(and(visibleFoodCondition(userId), conditions.fuzzy))
    .orderBy(
      sql`(${conditions.exact}) desc`,
      sql`(${favoriteFood.foodId} is not null) desc`,
      sql`coalesce(${usage.uses}, 0) desc`,
      sql`(search_text(${food.name}) like search_text(${escapeLike(normalizedQuery)}) || '%') desc`,
      sql`similarity(search_text(${food.name}), search_text(${normalizedQuery})) desc`,
      sql`length(${food.name})`,
    )
    .limit(limit);
  return toLoggableFoods(userId, rows);
}

export async function recentFoods(userId: string, limit = 15) {
  const recent = await database
    .select({ foodId: diaryEntry.foodId, lastUsed: sql<Date>`max(${diaryEntry.createdAt})` })
    .from(diaryEntry)
    .where(and(eq(diaryEntry.userId, userId), eq(diaryEntry.kind, "food")))
    .groupBy(diaryEntry.foodId)
    .orderBy(sql`max(${diaryEntry.createdAt}) desc`)
    .limit(limit);
  const foodIds = recent.map((row) => row.foodId).filter((foodId): foodId is string => Boolean(foodId));
  const foodsByRequestedId = await loggableFoodsByIds(userId, foodIds);
  return [...new Set(foodIds.flatMap((foodId) => foodsByRequestedId.get(foodId) ?? []))];
}

export async function visibleFoodIdsByRequested(userId: string, foodIds: string[]): Promise<Map<string, string>> {
  if (foodIds.length === 0) return new Map();
  const copies = await database
    .select({ id: food.id, replacesFoodId: food.replacesFoodId })
    .from(food)
    .where(and(eq(food.ownerId, userId), isNull(food.archivedAt), inArray(food.replacesFoodId, foodIds)));
  const copyByReplaced = new Map(copies.map((copy) => [copy.replacesFoodId, copy.id]));
  return new Map(foodIds.map((foodId) => [foodId, copyByReplaced.get(foodId) ?? foodId]));
}

export async function loggableFoodsByIds(userId: string, foodIds: string[]): Promise<Map<string, LoggableFood>> {
  if (foodIds.length === 0) return new Map();
  const visibleIdByRequested = await visibleFoodIdsByRequested(userId, foodIds);
  const rows = await database
    .select(foodColumns)
    .from(food)
    .where(and(visibleFoodCondition(userId), inArray(food.id, [...new Set(visibleIdByRequested.values())])));
  const loggableById = new Map((await toLoggableFoods(userId, rows)).map((loggable) => [loggable.id, loggable]));
  const foodsByRequestedId = new Map<string, LoggableFood>();
  for (const [requestedId, visibleId] of visibleIdByRequested) {
    const loggable = loggableById.get(visibleId);
    if (loggable) foodsByRequestedId.set(requestedId, loggable);
  }
  return foodsByRequestedId;
}

function usageSubquery(userId: string) {
  return database
    .select({ foodId: diaryEntry.foodId, uses: sql<number>`count(*)`.as("uses") })
    .from(diaryEntry)
    .where(eq(diaryEntry.userId, userId))
    .groupBy(diaryEntry.foodId)
    .as("usage");
}

export async function favoriteFoods(userId: string) {
  const usage = usageSubquery(userId);
  const rows = await database
    .select(foodColumns)
    .from(food)
    .innerJoin(favoriteFood, and(eq(favoriteFood.foodId, food.id), eq(favoriteFood.userId, userId)))
    .leftJoin(usage, eq(usage.foodId, food.id))
    .where(visibleFoodCondition(userId))
    .orderBy(sql`coalesce(${usage.uses}, 0) desc`, food.name);
  return toLoggableFoods(userId, rows);
}

export async function mostUsedFoods(userId: string, limit = 40) {
  const usage = usageSubquery(userId);
  const rows = await database
    .select(foodColumns)
    .from(food)
    .innerJoin(usage, eq(usage.foodId, food.id))
    .where(visibleFoodCondition(userId))
    .orderBy(sql`${usage.uses} desc`, food.name)
    .limit(limit);
  return toLoggableFoods(userId, rows);
}

export async function getVisibleFood(userId: string, foodId: string) {
  const [row] = await database
    .select()
    .from(food)
    .where(and(eq(food.id, foodId), visibleFoodCondition(userId)));
  return row ?? null;
}

export async function getLoggableFood(userId: string, foodId: string) {
  const row = await getVisibleFood(userId, foodId);
  if (!row) return null;
  const [loggable] = await toLoggableFoods(userId, [row]);
  return loggable;
}

export async function listOwnFoods(userId: string) {
  const usage = usageSubquery(userId);
  const rows = await database
    .select(foodColumns)
    .from(food)
    .leftJoin(usage, eq(usage.foodId, food.id))
    .where(and(eq(food.ownerId, userId), isNull(food.archivedAt)))
    .orderBy(sql`coalesce(${usage.uses}, 0) desc`, food.name);
  return toLoggableFoods(userId, rows);
}

export async function getFoodDetail(userId: string, foodId: string) {
  const row = await getVisibleFood(userId, foodId);
  if (!row) return null;
  const [portions, favorite] = await Promise.all([
    database
      .select({ label: foodPortion.label, grams: foodPortion.grams })
      .from(foodPortion)
      .where(eq(foodPortion.foodId, row.id))
      .orderBy(foodPortion.position),
    database
      .select({ foodId: favoriteFood.foodId })
      .from(favoriteFood)
      .where(and(eq(favoriteFood.userId, userId), eq(favoriteFood.foodId, row.id))),
  ]);
  return { ...row, portions, isFavorite: favorite.length > 0, isOwn: row.ownerId === userId };
}

export type FoodDetail = NonNullable<Awaited<ReturnType<typeof getFoodDetail>>>;
