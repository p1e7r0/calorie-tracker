export const bodyMetrics = [
  { key: "weightKg", label: "Peso", shortLabel: "Peso", unit: "kg", minimum: 25, maximum: 400 },
  { key: "bodyFatPercent", label: "Massa grassa", shortLabel: "Grasso", unit: "%", minimum: 2, maximum: 75 },
  { key: "musclePercent", label: "Massa muscolare", shortLabel: "Muscolo", unit: "%", minimum: 5, maximum: 80 },
  { key: "visceralFat", label: "Grasso viscerale", shortLabel: "Viscerale", unit: "", minimum: 1, maximum: 60 },
  { key: "bodyWaterPercent", label: "Acqua corporea", shortLabel: "Acqua", unit: "%", minimum: 20, maximum: 80 },
  { key: "boneMassKg", label: "Massa ossea", shortLabel: "Ossa", unit: "kg", minimum: 0.5, maximum: 10 },
  { key: "waistCm", label: "Circonferenza vita", shortLabel: "Vita", unit: "cm", minimum: 30, maximum: 250 },
  { key: "hipCm", label: "Circonferenza fianchi", shortLabel: "Fianchi", unit: "cm", minimum: 30, maximum: 250 },
] as const;

export type BodyMetric = (typeof bodyMetrics)[number];
export type BodyMetricKey = BodyMetric["key"];
