export type OpenFoodFactsCandidate = {
  code: string;
  name: string;
  brand: string | null;
  kcal: number;
  protein: number;
  carbs: number;
  sugars: number | null;
  fat: number;
  saturatedFat: number | null;
  fiber: number | null;
  salt: number | null;
  servingGrams: number | null;
};

type RawNutriments = Record<string, unknown>;

export type RawOpenFoodFactsProduct = {
  code?: unknown;
  product_name?: unknown;
  product_name_it?: unknown;
  brands?: unknown;
  nutriments?: RawNutriments;
  serving_quantity?: unknown;
};

function numberOrNull(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function rounded(value: number) {
  return Math.round(value * 10) / 10;
}

export function normalizeBarcode(value: string) {
  const digits = value.replace(/\D/g, "");
  return digits.length >= 6 && digits.length <= 14 ? digits : null;
}

export function normalizeOpenFoodFactsProduct(product: RawOpenFoodFactsProduct): OpenFoodFactsCandidate | null {
  const code = typeof product.code === "string" ? normalizeBarcode(product.code) : null;
  const name = [product.product_name_it, product.product_name]
    .find((value): value is string => typeof value === "string" && value.trim().length > 0)
    ?.trim();
  const nutriments = product.nutriments ?? {};
  const kcalFromEnergy = numberOrNull(nutriments["energy_100g"]);
  const kcal = numberOrNull(nutriments["energy-kcal_100g"]) ?? (kcalFromEnergy === null ? null : kcalFromEnergy / 4.184);
  if (!code || !name || kcal === null || kcal > 1000) return null;

  const rawBrand = Array.isArray(product.brands) ? product.brands[0] : product.brands;
  const brand = typeof rawBrand === "string" ? rawBrand.split(",")[0].trim() || null : null;
  const optional = (key: string) => {
    const value = numberOrNull(nutriments[key]);
    return value === null ? null : rounded(value);
  };
  const servingGrams = numberOrNull(product.serving_quantity);

  return {
    code,
    name,
    brand,
    kcal: Math.round(kcal),
    protein: optional("proteins_100g") ?? 0,
    carbs: optional("carbohydrates_100g") ?? 0,
    sugars: optional("sugars_100g"),
    fat: optional("fat_100g") ?? 0,
    saturatedFat: optional("saturated-fat_100g"),
    fiber: optional("fiber_100g"),
    salt: optional("salt_100g"),
    servingGrams: servingGrams && servingGrams > 0 && servingGrams <= 2000 ? rounded(servingGrams) : null,
  };
}
