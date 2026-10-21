export type FoodCheckValues = {
  unit: "g" | "ml";
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  sugars?: number | null;
  saturatedFat?: number | null;
  fiber?: number | null;
};

export type FoodValueIssue = { path: "protein" | "sugars" | "saturatedFat"; message: string };

const roundingTolerance = 0.1;
const macroSumTolerance = 1;

export function foodValueIssues(values: FoodCheckValues): FoodValueIssue[] {
  const issues: FoodValueIssue[] = [];
  if (values.unit === "g" && values.protein + values.carbs + values.fat > 100 + macroSumTolerance) {
    issues.push({ path: "protein", message: "Proteine, carboidrati e grassi insieme superano 100 g su 100 g." });
  }
  if (values.sugars != null && values.sugars > values.carbs + roundingTolerance) {
    issues.push({ path: "sugars", message: "Gli zuccheri non possono superare i carboidrati." });
  }
  if (values.saturatedFat != null && values.saturatedFat > values.fat + roundingTolerance) {
    issues.push({ path: "saturatedFat", message: "I grassi saturi non possono superare i grassi." });
  }
  return issues;
}

export function kcalFromMacros(values: Pick<FoodCheckValues, "protein" | "carbs" | "fat" | "fiber">) {
  return 4 * values.protein + 4 * values.carbs + 9 * values.fat + 2 * (values.fiber ?? 0);
}

export function kcalMismatch(values: FoodCheckValues) {
  const expectedKcal = kcalFromMacros(values);
  const tolerance = Math.max(20, expectedKcal * 0.15);
  if (Math.abs(values.kcal - expectedKcal) <= tolerance) return null;
  return { expectedKcal: Math.round(expectedKcal) };
}
