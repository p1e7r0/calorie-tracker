import "server-only";
import { and, asc, eq, gte, lte } from "drizzle-orm";
import { database } from "@/db";
import { rechargeDay } from "@/db/schema";
import { rechargeState } from "@/lib/coach/recharge";
import { addDays, daysBetween, todayIsoDate } from "@/lib/nutrition/days";
import { weekStart } from "@/lib/nutrition/weeks";
import { getDailyTargets } from "./diary";
import { listIncompleteDays } from "./incomplete-days";
import { getDailyTotals } from "./statistics";

export async function listRechargeDays(userId: string, fromDay: string, toDay: string) {
  const rows = await database
    .select({ day: rechargeDay.day })
    .from(rechargeDay)
    .where(and(eq(rechargeDay.userId, userId), gte(rechargeDay.day, fromDay), lte(rechargeDay.day, toDay)))
    .orderBy(asc(rechargeDay.day));
  return rows.map((row) => row.day);
}

export async function getRechargeState(userId: string, day: string) {
  const start = weekStart(day);
  const [targets, dailyTotals, incompleteDays, rechargeDays] = await Promise.all([
    getDailyTargets(userId),
    getDailyTotals(userId, day, daysBetween(start, day) + 1),
    listIncompleteDays(userId, start, day),
    listRechargeDays(userId, start, addDays(start, 6)),
  ]);
  if (!targets) return null;
  return rechargeState({ day, targetKcal: targets.kcal, dailyKcal: dailyTotals, incompleteDays, rechargeDays });
}

export async function setRechargeDay(userId: string, active: boolean) {
  const day = todayIsoDate();
  const state = await getRechargeState(userId, day);
  if (!state) throw new Error("Imposta prima l'obiettivo giornaliero.");
  if (!active) {
    await database.delete(rechargeDay).where(and(eq(rechargeDay.userId, userId), eq(rechargeDay.day, day)));
    return { day, state: await getRechargeState(userId, day) };
  }
  if (state.status === "used") throw new Error("Hai già usato la ricarica di questa settimana.");
  if (state.status === "locked") {
    throw new Error(`La ricarica non è ancora sbloccata: ti mancano ${state.missingKcal} kcal avanzate.`);
  }
  await database.insert(rechargeDay).values({ userId, day }).onConflictDoNothing();
  return { day, state: await getRechargeState(userId, day) };
}
