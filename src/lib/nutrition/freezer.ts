import { daysBetween } from "./days";
import { formatDecimal, formatGrams } from "./format";

export const maxFreezerPortions = 50;

export function describeFrozenAge(frozenOn: string, today: string) {
  const days = Math.max(0, daysBetween(frozenOn, today));
  if (days === 0) return "congelato oggi";
  if (days === 1) return "congelato ieri";
  if (days < 14) return `congelato ${days} giorni fa`;
  if (days < 60) return `congelato ${Math.round(days / 7)} settimane fa`;
  const months = Math.round(days / 30);
  return months === 1 ? "congelato 1 mese fa" : `congelato ${months} mesi fa`;
}

export function describePortion({
  grams,
  servings,
  unit,
}: {
  grams: number | null;
  servings: number | null;
  unit: "g" | "ml";
}) {
  if (grams !== null) return `${formatGrams(grams)} ${unit}`;
  const amount = servings ?? 1;
  return amount === 1 ? "1 porzione della ricetta" : `${formatDecimal(amount)} porzioni della ricetta`;
}

export function describePortionsLeft(portionsLeft: number, portions: number) {
  if (portionsLeft === portions) return portions === 1 ? "1 porzione" : `${portions} porzioni`;
  return portionsLeft === 1 ? `ne resta 1 di ${portions}` : `ne restano ${portionsLeft} di ${portions}`;
}

export function countPortionsByBatch(entries: readonly { freezerBatchId: string | null }[]) {
  const counts = new Map<string, number>();
  for (const { freezerBatchId } of entries) {
    if (freezerBatchId) counts.set(freezerBatchId, (counts.get(freezerBatchId) ?? 0) + 1);
  }
  return counts;
}
