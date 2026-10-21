import "server-only";
import { and, asc, eq, gte, lte } from "drizzle-orm";
import { database } from "@/db";
import { incompleteDay } from "@/db/schema";

export async function listIncompleteDays(userId: string, fromDay: string, toDay: string) {
  const rows = await database
    .select({ day: incompleteDay.day })
    .from(incompleteDay)
    .where(and(eq(incompleteDay.userId, userId), gte(incompleteDay.day, fromDay), lte(incompleteDay.day, toDay)))
    .orderBy(asc(incompleteDay.day));
  return rows.map((row) => row.day);
}

export async function setIncompleteDay(userId: string, day: string, incomplete: boolean) {
  if (incomplete) {
    await database.insert(incompleteDay).values({ userId, day }).onConflictDoNothing();
    return;
  }
  await database.delete(incompleteDay).where(and(eq(incompleteDay.userId, userId), eq(incompleteDay.day, day)));
}
