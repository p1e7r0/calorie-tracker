import { and, eq, inArray } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { database } from "@/db";
import { diaryEntry, profile } from "@/db/schema";
import { todayIsoDate } from "@/lib/nutrition/days";
import type { MealType } from "@/lib/nutrition/meals";
import { eveningReminder } from "@/lib/reminders";
import { isAuthorizedCronRequest } from "@/server/cron";
import { sendPushToUsers } from "@/server/push";

export async function GET(request: NextRequest) {
  if (!isAuthorizedCronRequest(request)) return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
  const today = todayIsoDate();
  const users = await database.select({ userId: profile.userId }).from(profile).where(eq(profile.reminderEvening, true));
  const userIds = users.map((row) => row.userId);
  if (userIds.length === 0) return NextResponse.json({ sent: 0, removed: 0 });

  const logged = await database
    .selectDistinct({ userId: diaryEntry.userId, meal: diaryEntry.meal })
    .from(diaryEntry)
    .where(and(eq(diaryEntry.day, today), inArray(diaryEntry.userId, userIds)));
  const mealsByUser = new Map<string, MealType[]>();
  for (const row of logged) mealsByUser.set(row.userId, [...(mealsByUser.get(row.userId) ?? []), row.meal]);

  const result = await sendPushToUsers(userIds, (userId) => eveningReminder(mealsByUser.get(userId) ?? []));
  return NextResponse.json(result);
}
