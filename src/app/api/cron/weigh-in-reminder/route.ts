import { isNotNull } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { database } from "@/db";
import { profile } from "@/db/schema";
import { todayIsoDate } from "@/lib/nutrition/days";
import { weighInReminder } from "@/lib/reminders";
import { isAuthorizedCronRequest } from "@/server/cron";
import { sendPushToUsers } from "@/server/push";

export async function GET(request: NextRequest) {
  if (!isAuthorizedCronRequest(request)) return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
  const today = todayIsoDate();
  const users = await database
    .select({ userId: profile.userId, weekday: profile.reminderWeighInWeekday })
    .from(profile)
    .where(isNotNull(profile.reminderWeighInWeekday));
  const weekdayByUser = new Map(users.map((row) => [row.userId, row.weekday]));
  const result = await sendPushToUsers(
    users.map((row) => row.userId),
    (userId) => weighInReminder(weekdayByUser.get(userId) ?? null, today),
  );
  return NextResponse.json(result);
}
