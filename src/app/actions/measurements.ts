"use server";

import { and, eq } from "drizzle-orm";
import { refresh } from "next/cache";
import { z } from "zod";
import { database } from "@/db";
import { measurement } from "@/db/schema";
import { requireUserId } from "@/lib/auth/session";
import { type BodyMetricKey, bodyMetrics } from "@/lib/nutrition/body-metrics";
import { isIsoDate, todayIsoDate } from "@/lib/nutrition/days";
import type { ActionResult } from "./diary";

function metricNumber(key: BodyMetricKey) {
  const metric = bodyMetrics.find((candidate) => candidate.key === key)!;
  return z
    .number()
    .min(metric.minimum, `${metric.label}: valore troppo basso.`)
    .max(metric.maximum, `${metric.label}: valore troppo alto.`);
}

const measurementSchema = z.object({
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

function failure(error: unknown): { ok: false; error: string } {
  if (error instanceof z.ZodError) return { ok: false, error: error.issues[0]?.message ?? "Controlla i valori." };
  if (error instanceof Error) return { ok: false, error: error.message };
  return { ok: false, error: "Qualcosa non ha funzionato. Riprova." };
}

export async function saveMeasurement(input: MeasurementInput): Promise<ActionResult> {
  try {
    const userId = await requireUserId();
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
      const updated = await database
        .update(measurement)
        .set(values)
        .where(and(eq(measurement.id, id), eq(measurement.userId, userId)))
        .returning({ id: measurement.id });
      if (updated.length === 0) throw new Error("Misurazione non trovata.");
    } else {
      await database.insert(measurement).values({ ...values, userId });
    }
    refresh();
    return { ok: true, data: undefined };
  } catch (error) {
    return failure(error);
  }
}

export async function deleteMeasurement(id: string): Promise<ActionResult> {
  try {
    const userId = await requireUserId();
    const deleted = await database
      .delete(measurement)
      .where(and(eq(measurement.id, z.uuid().parse(id)), eq(measurement.userId, userId)))
      .returning({ id: measurement.id });
    if (deleted.length === 0) throw new Error("Misurazione non trovata.");
    refresh();
    return { ok: true, data: undefined };
  } catch (error) {
    return failure(error);
  }
}
