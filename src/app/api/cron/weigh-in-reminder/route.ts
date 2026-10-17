import { eq, inArray, isNotNull, or } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { database } from "@/db";
import { profile, pushSubscription } from "@/db/schema";
import { todayIsoDate } from "@/lib/nutrition/days";
import { isoWeekday, type PushMessage, weeklySummaryReminder, weighInReminder } from "@/lib/reminders";
import { getWeeklyPushSummary } from "@/server/adaptive-goal";
import { isAuthorizedCronRequest } from "@/server/cron";
import { isPushEnabled, sendPushToUsers } from "@/server/push";

export async function GET(request: NextRequest) {
  if (!isAuthorizedCronRequest(request)) return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
  const today = todayIsoDate();
  const users = await database
    .select({ userId: profile.userId, weekday: profile.reminderWeighInWeekday })
    .from(profile)
    .where(or(eq(profile.reminderEvening, true), isNotNull(profile.reminderWeighInWeekday)));
  const weekdayByUser = new Map(users.map((row) => [row.userId, row.weekday]));
  const summaryByUser = new Map<string, PushMessage | null>();

  if (isPushEnabled && isoWeekday(today) === 1 && users.length > 0) {
    const subscribers = await database
      .selectDistinct({ userId: pushSubscription.userId })
      .from(pushSubscription)
      .where(inArray(pushSubscription.userId, [...weekdayByUser.keys()]));
    for (const { userId } of subscribers) {
      const { summary, maintenanceKcal } = await getWeeklyPushSummary(userId, today);
      summaryByUser.set(
        userId,
        weeklySummaryReminder({ summary, maintenanceKcal, isWeighInDay: weekdayByUser.get(userId) === 1 }),
      );
    }
  }

  const result = await sendPushToUsers(
    [...weekdayByUser.keys()],
    (userId) => summaryByUser.get(userId) ?? weighInReminder(weekdayByUser.get(userId) ?? null, today),
  );
  return NextResponse.json(result);
}
