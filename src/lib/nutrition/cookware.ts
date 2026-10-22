export type CookwareView = {
  id: string;
  name: string;
  weightG: number;
};

const thousandsPattern = /^\d{1,3}(\.\d{3})+(,\d+)?$/;

export function parseWeightGrams(value: string) {
  const normalized = value.trim().replace(/\s/g, "");
  if (normalized === "") return null;
  const decimal = thousandsPattern.test(normalized) ? normalized.replace(/\./g, "") : normalized;
  const parsed = Number(decimal.replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
}

export function netCookedWeight(totalWeightG: number | null, cookwareWeightG: number | null) {
  if (totalWeightG === null || cookwareWeightG === null) return null;
  const net = Math.round(totalWeightG - cookwareWeightG);
  return net > 0 ? net : null;
}
