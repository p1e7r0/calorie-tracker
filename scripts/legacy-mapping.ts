import { todayIsoDate } from "../src/lib/nutrition/days";

export type LegacyFood = {
  _id: unknown;
  id?: string | null;
  name?: string;
  category?: string | null;
  unit?: string | null;
  priority?: number | string | null;
  [field: string]: unknown;
};

const coreFields = {
  kcal: "kcal",
  protein_g: "protein",
  carbohydrates_g: "carbs",
  sugars_g: "sugars",
  fat_g: "fat",
  fat_saturated_g: "saturatedFat",
  dietary_fibres_g: "fiber",
  salt_nacl_g: "salt",
} as const;

const ignoredFields = new Set([
  "_id",
  "id",
  "id_v4",
  "fir_id",
  "name",
  "synonyms",
  "category",
  "density",
  "unit",
  "priority",
  "proiority",
  "createdAt",
  "updatedAt",
]);

export function toNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = typeof value === "number" ? value : Number(String(value).replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
}

export function mapLegacyFood(legacyFood: LegacyFood, ownerId: string) {
  const isDataset = Boolean(legacyFood.id);
  const legacyId = String(legacyFood._id);
  const core = Object.fromEntries(
    Object.entries(coreFields).map(([legacyField, field]) => [field, toNumber(legacyFood[legacyField])]),
  ) as Record<(typeof coreFields)[keyof typeof coreFields], number | null>;

  const micronutrients: Record<string, number> = {};
  for (const [field, value] of Object.entries(legacyFood)) {
    if (ignoredFields.has(field) || field in coreFields) continue;
    const parsed = toNumber(value);
    if (parsed !== null && parsed !== 0) micronutrients[field] = parsed;
  }

  return {
    legacyId,
    isFavorite: toNumber(legacyFood.priority) === 1,
    values: {
      ownerId: isDataset ? null : ownerId,
      source: isDataset ? ("swiss" as const) : ("user" as const),
      sourceReference: isDataset ? String(legacyFood.id) : legacyId,
      name: String(legacyFood.name ?? "Senza nome").trim(),
      category: legacyFood.category ? String(legacyFood.category) : null,
      unit: legacyFood.unit === "ml" ? ("ml" as const) : ("g" as const),
      kcal: core.kcal ?? 0,
      protein: core.protein ?? 0,
      carbs: core.carbs ?? 0,
      sugars: core.sugars,
      fat: core.fat ?? 0,
      saturatedFat: core.saturatedFat,
      fiber: core.fiber,
      salt: core.salt,
      micronutrients: Object.keys(micronutrients).length > 0 ? micronutrients : null,
    },
  };
}

export function mapLegacyMeasurement(legacyMeasurement: Record<string, unknown>, userId: string) {
  const weightKg = toNumber(legacyMeasurement.weight);
  const measuredAt = new Date(String(legacyMeasurement.date));
  if (weightKg === null || Number.isNaN(measuredAt.getTime())) return null;
  return {
    userId,
    measuredOn: todayIsoDate(measuredAt),
    weightKg,
    bodyFatPercent: toNumber(legacyMeasurement.fat_percentage),
    musclePercent: toNumber(legacyMeasurement.muscle_percentage),
    visceralFat: toNumber(legacyMeasurement.visceral_fat),
  };
}
