import "server-only";
import { asc, eq } from "drizzle-orm";
import { database } from "@/db";
import { measurement } from "@/db/schema";

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
