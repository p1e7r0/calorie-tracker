import "server-only";
import { desc, eq } from "drizzle-orm";
import { database } from "@/db";
import { measurement, profile } from "@/db/schema";

export async function getProfileWithLatestWeight(userId: string) {
  const [[profileRow], [latestMeasurement]] = await Promise.all([
    database.select().from(profile).where(eq(profile.userId, userId)),
    database
      .select({ weightKg: measurement.weightKg, measuredOn: measurement.measuredOn })
      .from(measurement)
      .where(eq(measurement.userId, userId))
      .orderBy(desc(measurement.measuredOn), desc(measurement.createdAt))
      .limit(1),
  ]);
  return { profile: profileRow ?? null, latestWeight: latestMeasurement ?? null };
}

export type ProfileWithLatestWeight = Awaited<ReturnType<typeof getProfileWithLatestWeight>>;
