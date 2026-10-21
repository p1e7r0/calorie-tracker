import "server-only";
import { and, eq, isNull, sql } from "drizzle-orm";
import { database } from "@/db";
import { food, foodPortion } from "@/db/schema";
import {
  normalizeOpenFoodFactsProduct,
  type OpenFoodFactsCandidate,
  type RawOpenFoodFactsProduct,
} from "@/lib/open-food-facts";
import { visibleFoodCondition } from "./foods";

const userAgent = "Bilancia/0.1 (https://github.com/p1e7r0/calorie-tracker)";
const fields = "code,product_name,product_name_it,brands,nutriments,serving_quantity";

async function fetchJson(url: string, { notFoundIsEmpty = false } = {}) {
  const response = await fetch(url, {
    headers: { "User-Agent": userAgent, Accept: "application/json" },
    signal: AbortSignal.timeout(8000),
    cache: "no-store",
  });
  if (notFoundIsEmpty && response.status === 404) return null;
  if (!response.ok) throw new Error(`Open Food Facts responded with ${response.status}`);
  return response.json() as Promise<unknown>;
}

export async function searchOpenFoodFacts(query: string): Promise<OpenFoodFactsCandidate[]> {
  const url = new URL("https://search.openfoodfacts.org/search");
  url.searchParams.set("q", query);
  url.searchParams.set("langs", "it");
  url.searchParams.set("page_size", "25");
  url.searchParams.set("fields", fields);
  const body = (await fetchJson(url.toString())) as { hits?: RawOpenFoodFactsProduct[] };
  return (body.hits ?? [])
    .map(normalizeOpenFoodFactsProduct)
    .filter((candidate): candidate is OpenFoodFactsCandidate => candidate !== null);
}

export async function fetchOpenFoodFactsProduct(code: string) {
  const body = (await fetchJson(`https://world.openfoodfacts.org/api/v2/product/${code}.json?fields=${fields}`, {
    notFoundIsEmpty: true,
  })) as { status?: number; product?: RawOpenFoodFactsProduct } | null;
  if (body?.status !== 1 || !body.product) return null;
  return normalizeOpenFoodFactsProduct({ ...body.product, code });
}

export async function importOpenFoodFactsCandidate(candidate: OpenFoodFactsCandidate) {
  return database.transaction(async (transaction) => {
    const inserted = await transaction
      .insert(food)
      .values({
        ownerId: null,
        source: "open_food_facts",
        sourceReference: candidate.code,
        barcode: candidate.code,
        name: candidate.name,
        brand: candidate.brand,
        unit: "g",
        kcal: candidate.kcal,
        protein: candidate.protein,
        carbs: candidate.carbs,
        sugars: candidate.sugars,
        fat: candidate.fat,
        saturatedFat: candidate.saturatedFat,
        fiber: candidate.fiber,
        salt: candidate.salt,
      })
      .onConflictDoNothing()
      .returning({ id: food.id });

    if (inserted[0]) {
      if (candidate.servingGrams) {
        await transaction
          .insert(foodPortion)
          .values({ foodId: inserted[0].id, label: "1 porzione", grams: candidate.servingGrams });
      }
      return inserted[0].id;
    }

    const [existing] = await transaction
      .select({ id: food.id })
      .from(food)
      .where(
        and(
          eq(food.source, "open_food_facts"),
          eq(food.sourceReference, candidate.code),
          isNull(food.ownerId),
        ),
      );
    return existing.id;
  });
}

export async function findVisibleFoodByBarcode(userId: string, barcode: string) {
  const [match] = await database
    .select({ id: food.id })
    .from(food)
    .where(and(visibleFoodCondition(userId), eq(food.barcode, barcode)))
    .orderBy(sql`(${food.ownerId} is not null) desc`)
    .limit(1);
  return match?.id ?? null;
}
