import "server-only";
import { and, asc, eq } from "drizzle-orm";
import { z } from "zod";
import { database } from "@/db";
import { measurement } from "@/db/schema";
import { type BodyMetricKey, bodyMetrics } from "@/lib/nutrition/body-metrics";
import { isIsoDate, todayIsoDate } from "@/lib/nutrition/days";

export async function listMeasurements(userId: string) {
  const rows = await database
    .select()
    .from(measurement)
    .where(eq(measurement.userId, userId))
    .orderBy(asc(measurement.measuredOn), asc(measurement.createdAt));
  return rows.map((row) => ({
    id: row.id,
    measuredOn: row.measuredOn,
    weightKg: row.weightKg,
    bodyFatPercent: row.bodyFatPercent,
    musclePercent: row.musclePercent,
    visceralFat: row.visceralFat,
    bodyWaterPercent: row.bodyWaterPercent,
    boneMassKg: row.boneMassKg,
    waistCm: row.waistCm,
    hipCm: row.hipCm,
    note: row.note,
  }));
}

export type MeasurementView = Awaited<ReturnType<typeof listMeasurements>>[number];

function metricNumber(key: BodyMetricKey) {
  const metric = bodyMetrics.find((candidate) => candidate.key === key)!;
  return z
    .number()
    .min(metric.minimum, `${metric.label}: valore troppo basso.`)
    .max(metric.maximum, `${metric.label}: valore troppo alto.`);
}

export const measurementSchema = z.object({
  id: z.uuid().nullish(),
  measuredOn: z
    .string()
    .refine(isIsoDate, "Data non valida.")
    .refine((day) => day <= todayIsoDate(), "La data non può essere nel futuro."),
  note: z.string().trim().max(200).nullish(),
  weightKg: metricNumber("weightKg"),
  bodyFatPercent: metricNumber("bodyFatPercent").nullish(),
  musclePercent: metricNumber("musclePercent").nullish(),
  visceralFat: metricNumber("visceralFat").nullish(),
  bodyWaterPercent: metricNumber("bodyWaterPercent").nullish(),
  boneMassKg: metricNumber("boneMassKg").nullish(),
  waistCm: metricNumber("waistCm").nullish(),
  hipCm: metricNumber("hipCm").nullish(),
});

export type MeasurementInput = z.input<typeof measurementSchema>;

export async function writeMeasurement(userId: string, input: MeasurementInput) {
  const { id, ...parsed } = measurementSchema.parse(input);
  const values = {
    measuredOn: parsed.measuredOn,
    weightKg: parsed.weightKg,
    bodyFatPercent: parsed.bodyFatPercent ?? null,
    musclePercent: parsed.musclePercent ?? null,
    visceralFat: parsed.visceralFat ?? null,
    bodyWaterPercent: parsed.bodyWaterPercent ?? null,
    boneMassKg: parsed.boneMassKg ?? null,
    waistCm: parsed.waistCm ?? null,
    hipCm: parsed.hipCm ?? null,
    note: parsed.note || null,
  };
  if (id) {
    const [updated] = await database
      .update(measurement)
      .set(values)
      .where(and(eq(measurement.id, id), eq(measurement.userId, userId)))
      .returning({ id: measurement.id });
    if (!updated) throw new Error("Misurazione non trovata.");
    return updated.id;
  }
  const [created] = await database
    .insert(measurement)
    .values({ ...values, userId })
    .returning({ id: measurement.id });
  return created.id;
}

export async function removeMeasurement(userId: string, measurementId: string) {
  const [deleted] = await database
    .delete(measurement)
    .where(and(eq(measurement.id, z.uuid().parse(measurementId)), eq(measurement.userId, userId)))
    .returning({ id: measurement.id, measuredOn: measurement.measuredOn, weightKg: measurement.weightKg });
  if (!deleted) throw new Error("Misurazione non trovata.");
  return deleted;
}
