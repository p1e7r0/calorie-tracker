import "server-only";
import { and, eq, gte, sql } from "drizzle-orm";
import { database } from "@/db";
import { diaryEntry } from "@/db/schema";
import { addDays } from "@/lib/nutrition/days";

export type DailyTotals = { day: string; kcal: number; protein: number; carbs: number; fat: number };

export async function getDailyTotals(userId: string, today: string, days: number): Promise<DailyTotals[]> {
  const fromDay = addDays(today, -(days - 1));
  const rows = await database
    .select({
      day: diaryEntry.day,
      kcal: sql<number>`sum(${diaryEntry.kcal})::float`,
      protein: sql<number>`sum(${diaryEntry.protein})::float`,
      carbs: sql<number>`sum(${diaryEntry.carbs})::float`,
      fat: sql<number>`sum(${diaryEntry.fat})::float`,
    })
    .from(diaryEntry)
    .where(and(eq(diaryEntry.userId, userId), gte(diaryEntry.day, fromDay)))
    .groupBy(diaryEntry.day)
    .orderBy(diaryEntry.day);
  return rows.filter((row) => row.day <= today);
}
