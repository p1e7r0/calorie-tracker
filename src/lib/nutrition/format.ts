const integerFormatter = new Intl.NumberFormat("it-IT", { maximumFractionDigits: 0 });
const decimalFormatter = new Intl.NumberFormat("it-IT", { maximumFractionDigits: 1 });

export function formatKcal(value: number) {
  return integerFormatter.format(Math.round(value));
}

export function formatGrams(value: number) {
  return Math.abs(value) < 10 ? decimalFormatter.format(value) : integerFormatter.format(value);
}

export function formatDecimal(value: number) {
  return decimalFormatter.format(value);
}

export function formatSignedDecimal(value: number) {
  const rounded = Math.round(value * 10) / 10;
  const sign = rounded > 0 ? "+" : rounded < 0 ? "−" : "";
  return `${sign}${decimalFormatter.format(Math.abs(rounded))}`;
}

export function parseDecimal(value: string) {
  const normalized = value.trim().replace(/\s/g, "").replace(",", ".");
  if (normalized === "") return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}
