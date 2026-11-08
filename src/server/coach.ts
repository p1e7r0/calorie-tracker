import "server-only";
import { and, desc, eq, gte, inArray } from "drizzle-orm";
import { database } from "@/db";
import { coachMessage, diaryEntry, profile, pushSubscription, user } from "@/db/schema";
import { type CoachMessageKind, buildCoachInput, coachEvents, weeklyReportStats } from "@/lib/coach/input";
import { drawLevel, levelProbabilitiesFromEnvironment, resolveLevel } from "@/lib/coach/level";
import { coachSystemPrompt } from "@/lib/coach/prompt";
import { rechargeState } from "@/lib/coach/recharge";
import { proteinStreak } from "@/lib/coach/streak";
import { cleanCoachText, coachTitles, notificationMaximumLength, shortenToLength } from "@/lib/coach/text";
import { coachWeight } from "@/lib/coach/weight";
import { addDays, currentHour, currentTime, todayIsoDate } from "@/lib/nutrition/days";
import { weeklyBudget } from "@/lib/nutrition/weekly-budget";
import { weekStart } from "@/lib/nutrition/weeks";
import { isoWeekday } from "@/lib/reminders";
import { isAiEnabled, writeCoachText } from "./ai";
import { listIncompleteDays } from "./incomplete-days";
import { listMeasurements } from "./measurements";
import { isPushEnabled, sendPushToUsers } from "./push";
import { listRechargeDays } from "./recharge-days";
import { getDailyTotals } from "./statistics";

export const isCoachAvailable = isAiEnabled && isPushEnabled;

export const coachSlots = ["morning", "lunch", "afternoon", "evening", "weekly"] as const;
export type CoachSlot = (typeof coachSlots)[number];

export const dailyNotificationLimit = 4;
const historyDays = 120;
const recentMessageCount = 3;
const levelProbabilities = levelProbabilitiesFromEnvironment(process.env);

const urls: Record<CoachMessageKind, string> = { notification: "/", weigh_in: "/progress", weekly_report: "/progress" };

export type CoachOutcome =
  | "sent"
  | "silence"
  | "skip"
  | "limit"
  | "duplicate"
  | "not-delivered"
  | "no-targets"
  | "disabled";

async function coachUsers(userIds?: readonly string[]) {
  const rows = await database
    .selectDistinct({ userId: profile.userId })
    .from(profile)
    .innerJoin(pushSubscription, eq(pushSubscription.userId, profile.userId))
    .where(
      userIds
        ? and(eq(profile.coachEnabled, true), inArray(profile.userId, [...userIds]))
        : eq(profile.coachEnabled, true),
    );
  return rows.map((row) => row.userId);
}

async function loadContext(userId: string, today: string) {
  const fromDay = addDays(today, -historyDays);
  const start = weekStart(today);
  const [[account], [settings], dailyTotals, incompleteDays, rechargeDays, measurements, loggedMeals, messages] =
    await Promise.all([
      database.select({ name: user.name }).from(user).where(eq(user.id, userId)),
      database.select().from(profile).where(eq(profile.userId, userId)),
      getDailyTotals(userId, today, historyDays + 1),
      listIncompleteDays(userId, fromDay, today),
      listRechargeDays(userId, start, addDays(start, 6)),
      listMeasurements(userId),
      database
        .selectDistinct({ meal: diaryEntry.meal })
        .from(diaryEntry)
        .where(and(eq(diaryEntry.userId, userId), eq(diaryEntry.day, today))),
      database
        .select()
        .from(coachMessage)
        .where(and(eq(coachMessage.userId, userId), gte(coachMessage.day, addDays(today, -14))))
        .orderBy(desc(coachMessage.createdAt)),
    ]);
  return {
    name: account?.name.trim().split(/\s+/)[0] || "atleta",
    settings: settings ?? null,
    dailyTotals,
    incompleteDays,
    rechargeDays,
    measurements,
    loggedMeals: loggedMeals.map((row) => row.meal),
    messages,
  };
}

async function generateText(system: string, input: object, kind: CoachMessageKind) {
  const content = JSON.stringify(input);
  const first = cleanCoachText(await writeCoachText({ system, content }), kind);
  if (first.status !== "too-long") return first;
  const retry = cleanCoachText(
    await writeCoachText({
      system,
      content: `${content}\n\nLa versione precedente era lunga ${first.text.length} caratteri: «${first.text}». Riscrivila in massimo ${notificationMaximumLength} caratteri.`,
    }),
    kind,
  );
  if (retry.status !== "too-long") return retry;
  return { status: "ok" as const, text: shortenToLength(retry.text) };
}

export async function runCoach(
  userId: string,
  kind: CoachMessageKind,
  { slot = null, now = new Date() }: { slot?: CoachSlot | null; now?: Date } = {},
): Promise<CoachOutcome> {
  if (!isCoachAvailable) return "disabled";
  const today = todayIsoDate(now);
  const context = await loadContext(userId, today);
  const { settings, messages } = context;
  if (!settings?.coachEnabled) return "disabled";
  if (!settings.targetKcal || !settings.targetProteinG) return "no-targets";

  const todaysMessages = messages.filter((message) => message.day === today);
  if (slot && todaysMessages.some((message) => message.slot === slot)) return "duplicate";
  if (kind === "weigh_in" && todaysMessages.some((message) => message.kind === "weigh_in" && message.sent)) {
    return "duplicate";
  }
  const sentToday = todaysMessages.filter((message) => message.sent && message.kind !== "weekly_report").length;
  if (kind !== "weekly_report" && sentToday >= dailyNotificationLimit) return "limit";

  const targets = { kcal: settings.targetKcal, proteinG: settings.targetProteinG };
  const totals = context.dailyTotals.find((row) => row.day === today);
  const todayTotals = { kcal: totals?.kcal ?? 0, protein: totals?.protein ?? 0 };
  const recharge = rechargeState({
    day: today,
    targetKcal: targets.kcal,
    dailyKcal: context.dailyTotals,
    incompleteDays: context.incompleteDays,
    rechargeDays: context.rechargeDays,
  });
  const streak = proteinStreak({
    today,
    dailyProtein: context.dailyTotals,
    targetProteinG: targets.proteinG,
    incompleteDays: context.incompleteDays,
  });
  const sentMessages = messages.filter((message) => message.sent);
  const weight = coachWeight({
    weights: context.measurements.map((row) => ({ day: row.measuredOn, value: row.weightKg })),
    today,
    targetKg: settings.targetWeightKg,
    plannedWeeklyRateKg: settings.weeklyRateKg,
    previousArrivalDay: sentMessages.find((message) => message.arrivalDay)?.arrivalDay ?? null,
  });
  const events = coachEvents({
    kind,
    today,
    todayKcal: todayTotals.kcal,
    targetKcal: targets.kcal,
    recharge,
    streak,
    deliveredKeys: new Set(sentMessages.flatMap((message) => message.eventKeys)),
  });
  const level =
    kind === "weekly_report"
      ? "fierce"
      : resolveLevel({
          drawn: drawLevel(levelProbabilities, Math.random()),
          events,
          allowSilence: kind === "notification",
        });
  const input = buildCoachInput({
    kind,
    today,
    time: currentTime(now),
    hour: currentHour(now),
    targets,
    todayTotals,
    loggedMeals: context.loggedMeals,
    weekly: weeklyBudget({
      day: today,
      targetKcal: targets.kcal,
      dailyKcal: context.dailyTotals,
      incompleteDays: context.incompleteDays,
    }),
    recharge,
    streak,
    weight,
    level,
    events,
    recentMessages: sentMessages
      .slice(0, recentMessageCount)
      .reverse()
      .map((message) => message.text ?? ""),
    report:
      kind === "weekly_report"
        ? weeklyReportStats({
            today,
            targetKcal: targets.kcal,
            targetProteinG: targets.proteinG,
            dailyTotals: context.dailyTotals,
            incompleteDays: context.incompleteDays,
            rechargeDays: context.rechargeDays,
          })
        : null,
  });
  const record = { userId, kind, day: today, slot, level, input };

  if (level === "silence") {
    await database.insert(coachMessage).values(record);
    return "silence";
  }
  const system = coachSystemPrompt({
    name: context.name,
    targetKcal: targets.kcal,
    targetProteinG: targets.proteinG,
    targetWeightKg: settings.targetWeightKg,
  });
  const result = await generateText(system, input, kind);
  if (result.status === "skip") {
    await database.insert(coachMessage).values(record);
    return "skip";
  }
  const delivery = await sendPushToUsers([userId], () => ({
    title: coachTitles[kind],
    body: result.text,
    url: urls[kind],
  }));
  const sent = delivery.sent > 0;
  await database.insert(coachMessage).values({
    ...record,
    text: result.text,
    sent,
    eventKeys: sent ? events.map((event) => event.key) : [],
    arrivalDay: weight.target?.arrivalDay ?? null,
  });
  return sent ? "sent" : "not-delivered";
}

export async function runCoachSlot(slot: CoachSlot, now = new Date()) {
  const kind: CoachMessageKind = slot === "weekly" ? "weekly_report" : "notification";
  if (!isCoachAvailable) return { users: 0, outcomes: {} };
  if (kind === "weekly_report" && isoWeekday(todayIsoDate(now)) !== 7) return { users: 0, outcomes: {} };
  const userIds = await coachUsers();
  const outcomes: Record<string, number> = {};
  for (const userId of userIds) {
    let outcome: CoachOutcome | "error";
    try {
      outcome = await runCoach(userId, kind, { slot, now });
    } catch (error) {
      console.error("Coach message failed", error instanceof Error ? error.message : error);
      outcome = "error";
    }
    outcomes[outcome] = (outcomes[outcome] ?? 0) + 1;
  }
  return { users: userIds.length, outcomes };
}

export async function runCoachWeighIn(userId: string, measuredOn: string) {
  if (!isCoachAvailable || measuredOn !== todayIsoDate()) return;
  try {
    if ((await coachUsers([userId])).length === 0) return;
    await runCoach(userId, "weigh_in");
  } catch (error) {
    console.error("Coach weigh-in message failed", error instanceof Error ? error.message : error);
  }
}
