import { formatDecimal, formatGrams } from "./format";

export type QuantifiedEntry = {
  kind: "food" | "recipe" | "quick";
  grams: number | null;
  servings: number | null;
  portionLabel: string | null;
  unit: "g" | "ml";
};

export function describeEntryQuantity(entry: QuantifiedEntry) {
  if (entry.kind === "quick") return null;
  if (entry.portionLabel) return entry.portionLabel;
  if (entry.grams) return `${formatGrams(entry.grams)} ${entry.unit}`;
  if (entry.servings) {
    return entry.servings === 1 ? "1 porzione" : `${formatDecimal(entry.servings)} porzioni`;
  }
  return null;
}
