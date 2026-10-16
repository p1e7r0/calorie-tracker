export const extraNutrients = [
  { key: "fiber", label: "Fibre" },
  { key: "sugars", label: "Zuccheri" },
  { key: "saturatedFat", label: "Grassi saturi" },
  { key: "salt", label: "Sale" },
] as const;

export type ExtraNutrientKey = (typeof extraNutrients)[number]["key"];
export type ExtraNutrients = Record<ExtraNutrientKey, number | null>;

export const emptyExtraNutrients: ExtraNutrients = { fiber: null, sugars: null, saturatedFat: null, salt: null };

function mapExtras(extras: ExtraNutrients, transform: (value: number) => number): ExtraNutrients {
  return {
    fiber: extras.fiber === null ? null : transform(extras.fiber),
    sugars: extras.sugars === null ? null : transform(extras.sugars),
    saturatedFat: extras.saturatedFat === null ? null : transform(extras.saturatedFat),
    salt: extras.salt === null ? null : transform(extras.salt),
  };
}

export function scaleExtras(per100: ExtraNutrients, grams: number) {
  return mapExtras(per100, (value) => (value * grams) / 100);
}

export function multiplyExtras(extras: ExtraNutrients, factor: number) {
  return mapExtras(extras, (value) => value * factor);
}

export function roundExtras(extras: ExtraNutrients) {
  return mapExtras(extras, (value) => Math.round(value * 100) / 100);
}

export function sumExtras(list: readonly ExtraNutrients[]): ExtraNutrients {
  return extraNutrients.reduce((totals, { key }) => {
    const known = list.map((extras) => extras[key]).filter((value): value is number => value !== null);
    return { ...totals, [key]: known.length === 0 ? null : known.reduce((sum, value) => sum + value, 0) };
  }, emptyExtraNutrients);
}

export function extrasFromRow(row: ExtraNutrients): ExtraNutrients {
  return { fiber: row.fiber, sugars: row.sugars, saturatedFat: row.saturatedFat, salt: row.salt };
}
