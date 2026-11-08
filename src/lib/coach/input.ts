import { addDays, daysBetween, formatDayWithArticle } from "../nutrition/days";
import { type MealType, mealLabels } from "../nutrition/meals";
import { type WeeklyBudget, weeklyBudget } from "../nutrition/weekly-budget";
import { weekStart } from "../nutrition/weeks";
import { type CoachEvent, type CoachLevel, coachLevelLabels } from "./level";
import { rechargeAllowanceKcal, type RechargeState, type RechargeStatus } from "./recharge";
import type { ProteinStreak } from "./streak";
import type { ArrivalReason, CoachWeight, WeightTrendDirection } from "./weight";

export const coachMessageKinds = ["notification", "weigh_in", "weekly_report"] as const;
export type CoachMessageKind = (typeof coachMessageKinds)[number];

const kindLabels: Record<CoachMessageKind, string> = {
  notification: "notifica",
  weigh_in: "pesata",
  weekly_report: "resoconto_settimanale",
};

const rechargeLabels: Record<RechargeStatus, string> = {
  locked: "bloccata",
  unlocked: "sbloccata",
  active: "attiva oggi",
  used: "già usata questa settimana",
};

const trendLabels: Record<WeightTrendDirection, string> = { down: "in calo", stable: "stabile", up: "in salita" };

const arrivalNotes: Record<ArrivalReason, string | null> = {
  observed: null,
  "not-enough-data": "pesate insufficienti per calcolare il ritmo reale",
  stalled: "peso fermo nelle ultime settimane: al ritmo attuale non arriva",
  "moving-away": "il peso si sta allontanando dall'obiettivo: al ritmo attuale non arriva",
  reached: "obiettivo raggiunto",
  "no-data": "nessuna pesata",
};

const eventLabels: Record<CoachEvent["kind"], string> = {
  overshoot: "sforamento senza ricarica",
  streak_broken: "serie interrotta",
  streak_milestone: "traguardo della serie",
  recharge_unlocked: "ricarica appena sbloccata",
};

const missingMealHours: Partial<Record<MealType, number>> = { breakfast: 10, lunch: 15, dinner: 21 };

export function missingMeals(loggedMeals: readonly MealType[], hour: number): MealType[] {
  return (Object.entries(missingMealHours) as [MealType, number][])
    .filter(([meal, fromHour]) => hour >= fromHour && !loggedMeals.includes(meal))
    .map(([meal]) => meal);
}

export function coachEvents({
  kind,
  today,
  todayKcal,
  targetKcal,
  recharge,
  streak,
  deliveredKeys,
}: {
  kind: CoachMessageKind;
  today: string;
  todayKcal: number;
  targetKcal: number;
  recharge: RechargeState;
  streak: ProteinStreak;
  deliveredKeys: ReadonlySet<string>;
}): CoachEvent[] {
  if (kind !== "notification") return [];
  const events: CoachEvent[] = [];
  if (todayKcal > rechargeAllowanceKcal(recharge, targetKcal))
    events.push({ kind: "overshoot", key: `overshoot:${today}` });
  const once: CoachEvent[] = [];
  if (streak.brokenDays !== null) once.push({ kind: "streak_broken", key: `streak-broken:${today}` });
  if (streak.milestone !== null && streak.startDay !== null) {
    once.push({ kind: "streak_milestone", key: `streak-milestone:${streak.startDay}:${streak.milestone}` });
  }
  if (recharge.status === "unlocked")
    once.push({ kind: "recharge_unlocked", key: `recharge-unlocked:${weekStart(today)}` });
  return [...events, ...once.filter((event) => !deliveredKeys.has(event.key))];
}

export type WeeklyReportStats = {
  loggedDays: number;
  averageKcal: number | null;
  averageProteinG: number | null;
  proteinTargetDays: number;
  rechargeDay: string | null;
  rechargeDeserved: boolean | null;
  budget: WeeklyBudget;
};

export function weeklyReportStats({
  today,
  targetKcal,
  targetProteinG,
  dailyTotals,
  incompleteDays,
  rechargeDays,
}: {
  today: string;
  targetKcal: number;
  targetProteinG: number;
  dailyTotals: readonly { day: string; kcal: number; protein: number }[];
  incompleteDays: readonly string[];
  rechargeDays: readonly string[];
}): WeeklyReportStats {
  const start = weekStart(today);
  const excluded = new Set(incompleteDays);
  const week = dailyTotals.filter((totals) => totals.day >= start && totals.day <= today && !excluded.has(totals.day));
  const budget = weeklyBudget({ day: today, targetKcal, dailyKcal: dailyTotals, incompleteDays });
  const rechargeDay = rechargeDays.find((day) => day >= start && day <= addDays(start, 6)) ?? null;
  const averageOf = (read: (totals: (typeof week)[number]) => number) =>
    week.length === 0 ? null : week.reduce((sum, totals) => sum + read(totals), 0) / week.length;
  return {
    loggedDays: week.length,
    averageKcal: averageOf((totals) => totals.kcal),
    averageProteinG: averageOf((totals) => totals.protein),
    proteinTargetDays: week.filter((totals) => totals.protein >= targetProteinG).length,
    rechargeDay,
    rechargeDeserved: rechargeDay === null ? null : budget.remainingKcal >= 0,
    budget,
  };
}

export type CoachSnapshot = {
  kind: CoachMessageKind;
  today: string;
  time: string;
  hour: number;
  targets: { kcal: number; proteinG: number };
  todayTotals: { kcal: number; protein: number };
  loggedMeals: readonly MealType[];
  weekly: WeeklyBudget;
  recharge: RechargeState;
  streak: ProteinStreak;
  weight: CoachWeight;
  level: CoachLevel;
  events: readonly CoachEvent[];
  recentMessages: readonly string[];
  report: WeeklyReportStats | null;
};

const roundKcal = (value: number) => Math.round(value);
const roundGrams = (value: number) => Math.round(value);
const roundKg = (value: number) => Math.round(value * 10) / 10;

function weightInput(weight: CoachWeight, today: string) {
  const target = weight.target;
  return {
    peso: {
      ultima_pesata: weight.lastWeighIn
        ? { kg: roundKg(weight.lastWeighIn.kg), giorni_fa: daysBetween(weight.lastWeighIn.day, today) }
        : null,
      variazione_dalla_pesata_precedente_kg: weight.changeFromPrevious ? roundKg(weight.changeFromPrevious.kg) : null,
      giorni_dalla_pesata_precedente:
        weight.changeFromPrevious && weight.lastWeighIn
          ? daysBetween(weight.changeFromPrevious.previousDay, weight.lastWeighIn.day)
          : null,
      media_7_giorni_kg: weight.average7Kg === null ? null : roundKg(weight.average7Kg),
      trend_settimanale_kg: weight.weeklyTrendKg === null ? null : roundKg(weight.weeklyTrendKg),
      trend: weight.trend === null ? null : trendLabels[weight.trend],
      probabile_acqua_glicogeno_sale: weight.likelyWater,
    },
    obiettivo_peso: target
      ? {
          kg: roundKg(target.kg),
          data_prevista: target.arrivalDay ? formatDayWithArticle(target.arrivalDay, today) : null,
          giorni_all_arrivo: target.arrivalDay ? daysBetween(today, target.arrivalDay) : null,
          spostamento_giorni_dall_ultima_volta: target.shiftDays,
          nota: arrivalNotes[target.reason],
        }
      : null,
  };
}

export function buildCoachInput(snapshot: CoachSnapshot) {
  const { targets, todayTotals, weekly, recharge, streak, report } = snapshot;
  return {
    tipo: kindLabels[snapshot.kind],
    ora: snapshot.time,
    oggi: {
      kcal: roundKcal(todayTotals.kcal),
      obiettivo_kcal: targets.kcal,
      kcal_massime_oggi: rechargeAllowanceKcal(recharge, targets.kcal),
      proteine_g: roundGrams(todayTotals.protein),
      obiettivo_proteine_g: targets.proteinG,
    },
    budget_settimanale: {
      kcal_residue: roundKcal(weekly.remainingKcal),
      giorni_rimasti: weekly.daysLeft,
      kcal_suggerite_oggi: weekly.suggestedTodayKcal,
    },
    ricarica: {
      stato: rechargeLabels[recharge.status],
      kcal_ricarica: recharge.dayKcal,
      kcal_avanzate_settimana: recharge.bankedKcal,
      kcal_mancanti_per_sbloccarla: recharge.status === "locked" ? recharge.missingKcal : 0,
    },
    serie: {
      giorni_sopra_obiettivo_proteine: streak.days,
      obiettivo_proteine_raggiunto_oggi: streak.todayReached,
      traguardo: streak.milestone,
      serie_interrotta_ieri_giorni: streak.brokenDays,
    },
    pasti_non_registrati: missingMeals(snapshot.loggedMeals, snapshot.hour).map((meal) =>
      mealLabels[meal].toLowerCase(),
    ),
    ...weightInput(snapshot.weight, snapshot.today),
    livello: coachLevelLabels[snapshot.level],
    eventi: snapshot.events.map((event) => eventLabels[event.kind]),
    ultimi_messaggi: snapshot.recentMessages,
    ...(report
      ? {
          settimana: {
            giorni_registrati: report.loggedDays,
            media_kcal: report.averageKcal === null ? null : roundKcal(report.averageKcal),
            media_proteine_g: report.averageProteinG === null ? null : roundGrams(report.averageProteinG),
            giorni_sopra_obiettivo_proteine: report.proteinTargetDays,
            ricarica_usata: report.rechargeDay !== null,
            ricarica_meritata: report.rechargeDeserved,
            budget_kcal: report.budget.budgetKcal,
            kcal_mangiate: roundKcal(report.budget.eatenKcal),
            kcal_residue_a_fine_settimana: roundKcal(report.budget.remainingKcal),
          },
        }
      : {}),
  };
}

export type CoachInput = ReturnType<typeof buildCoachInput>;
