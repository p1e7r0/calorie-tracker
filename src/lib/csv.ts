export type CsvValue = string | number | null | undefined;

const separator = ";";

function formatCell(value: CsvValue) {
  if (value === null || value === undefined) return "";
  const text = typeof value === "number" ? String(Math.round(value * 100) / 100).replace(".", ",") : value;
  return /[";\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function toCsv(header: readonly string[], rows: readonly (readonly CsvValue[])[]) {
  const lines = [header, ...rows].map((row) => row.map(formatCell).join(separator));
  return `﻿${lines.join("\r\n")}\r\n`;
}
