import "server-only";
import { and, asc, desc, eq, gte, lte } from "drizzle-orm";
import { database } from "@/db";
import { profile, rechargeDay } from "@/db/schema";
import { isRechargeAvailable, rechargeBankStartDay, type RechargeEvent, rechargeState } from "@/lib/coach/recharge";
import { addDays, daysBetween, todayIsoDate } from "@/lib/nutrition/days";
import { getDailyTargets } from "./diary";
import { listIncompleteDays } from "./incomplete-days";
import { getDailyTotals } from "./statistics";

const eventColumns = { day: rechargeDay.day, outcome: rechargeDay.outcome, bonusKcal: rechargeDay.bonusKcal };

export async function listRechargeEvents(userId: string, fromDay: string, toDay: string): Promise<RechargeEvent[]> {
  return database
    .select(eventColumns)
    .from(rechargeDay)
    .where(and(eq(rechargeDay.userId, userId), gte(rechargeDay.day, fromDay), lte(rechargeDay.day, toDay)))
    .orderBy(asc(rechargeDay.day));
}

async function latestRechargeEvent(userId: string, day: string): Promise<RechargeEvent | null> {
  const [row] = await database
    .select(eventColumns)
    .from(rechargeDay)
    .where(and(eq(rechargeDay.userId, userId), lte(rechargeDay.day, day)))
    .orderBy(desc(rechargeDay.day))
    .limit(1);
  return row ?? null;
}

export async function getRechargeState(userId: string, day: string) {
  const [targets, lastEvent, [settings]] = await Promise.all([
    getDailyTargets(userId),
    latestRechargeEvent(userId, day),
    database.select({ postponedOn: profile.rechargePostponedOn }).from(profile).where(eq(profile.userId, userId)),
  ]);
  if (!targets) return null;
  const sinceDay = lastEvent && lastEvent.day >= rechargeBankStartDay ? lastEvent.day : rechargeBankStartDay;
  const [dailyKcal, incompleteDays] =
    sinceDay < day
      ? await Promise.all([
          getDailyTotals(userId, addDays(day, -1), daysBetween(sinceDay, day)),
          listIncompleteDays(userId, sinceDay, addDays(day, -1)),
        ])
      : [[], []];
  return rechargeState({
    day,
    targetKcal: targets.kcal,
    dailyKcal,
    incompleteDays,
    events: lastEvent ? [lastEvent] : [],
    postponedOn: settings?.postponedOn ?? null,
  });
}

export type RechargeAction = "use" | "decline" | "clear" | "postpone" | "resume";

export async function changeRecharge(userId: string, action: RechargeAction) {
  const day = todayIsoDate();
  const state = await getRechargeState(userId, day);
  if (!state) throw new Error("Imposta prima l'obiettivo giornaliero.");
  if (action === "clear") {
    await database.delete(rechargeDay).where(and(eq(rechargeDay.userId, userId), eq(rechargeDay.day, day)));
  } else if (action === "postpone" || action === "resume") {
    await database
      .update(profile)
      .set({ rechargePostponedOn: action === "postpone" ? day : null })
      .where(eq(profile.userId, userId));
  } else {
    if (state.status === "active") throw new Error("Oggi è già il giorno di ricarica.");
    if (state.status === "declined") throw new Error("Hai già rifiutato la ricarica di oggi.");
    if (!isRechargeAvailable(state)) {
      throw new Error(`La ricarica non è ancora sbloccata: ti mancano ${state.missingKcal} kcal da mettere da parte.`);
    }
    const used = action === "use";
    await database
      .insert(rechargeDay)
      .values({ userId, day, outcome: used ? "used" : "declined", bonusKcal: used ? state.bankedKcal : 0 })
      .onConflictDoNothing();
  }
  return { day, state: await getRechargeState(userId, day) };
}
