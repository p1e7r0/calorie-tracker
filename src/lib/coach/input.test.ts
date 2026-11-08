import { describe, expect, it } from "vitest";
import { weeklyBudget } from "../nutrition/weekly-budget";
import { buildCoachInput, coachEvents, missingMeals, weeklyReportStats } from "./input";
import { coachSystemPrompt } from "./prompt";
import type { RechargeState } from "./recharge";
import type { ProteinStreak } from "./streak";

const recharge = (status: RechargeState["status"]): RechargeState => ({
  status,
  dayKcal: 2000,
  rechargeDay: null,
  bankedKcal: 320,
  missingKcal: status === "locked" ? 100 : 0,
});

const streak: ProteinStreak = { days: 5, startDay: "2026-11-04", todayReached: true, milestone: 5, brokenDays: null };

describe("missingMeals", () => {
  it("lists the main meals whose time has passed", () => {
    expect(missingMeals([], 9)).toEqual([]);
    expect(missingMeals([], 13)).toEqual(["breakfast"]);
    expect(missingMeals(["breakfast"], 16)).toEqual(["lunch"]);
    expect(missingMeals(["breakfast", "lunch", "snack"], 21)).toEqual(["dinner"]);
  });
});

describe("coachEvents", () => {
  const base = { kind: "notification" as const, today: "2026-11-08", targetKcal: 1700, streak };

  it("reports an overshoot beyond what the recharge allows", () => {
    const events = coachEvents({ ...base, todayKcal: 1900, recharge: recharge("locked"), deliveredKeys: new Set() });
    expect(events.map((event) => event.kind)).toEqual(["overshoot", "streak_milestone"]);
    const unlocked = coachEvents({
      ...base,
      todayKcal: 1900,
      recharge: recharge("unlocked"),
      deliveredKeys: new Set(),
    });
    expect(unlocked.map((event) => event.kind)).toEqual(["streak_milestone", "recharge_unlocked"]);
  });

  it("sends one-time events only once", () => {
    const events = coachEvents({
      ...base,
      todayKcal: 1000,
      recharge: recharge("unlocked"),
      deliveredKeys: new Set(["streak-milestone:2026-11-04:5", "recharge-unlocked:2026-11-02"]),
    });
    expect(events).toEqual([]);
  });

  it("has no events for weigh-ins and reports", () => {
    expect(
      coachEvents({
        ...base,
        kind: "weigh_in",
        todayKcal: 5000,
        recharge: recharge("locked"),
        deliveredKeys: new Set(),
      }),
    ).toEqual([]);
  });
});

describe("weeklyReportStats", () => {
  it("averages the logged days of the week and judges the recharge", () => {
    const stats = weeklyReportStats({
      today: "2026-11-08",
      targetKcal: 1700,
      targetProteinG: 140,
      dailyTotals: [
        { day: "2026-11-01", kcal: 3000, protein: 200 },
        { day: "2026-11-02", kcal: 1600, protein: 150 },
        { day: "2026-11-03", kcal: 1500, protein: 120 },
        { day: "2026-11-04", kcal: 2000, protein: 145 },
        { day: "2026-11-05", kcal: 900, protein: 30 },
      ],
      incompleteDays: ["2026-11-05"],
      rechargeDays: ["2026-11-04"],
    });
    expect(stats).toMatchObject({
      loggedDays: 3,
      averageKcal: 1700,
      proteinTargetDays: 2,
      rechargeDay: "2026-11-04",
      rechargeDeserved: true,
    });
    expect(stats.averageProteinG).toBeCloseTo(138.33);
  });
});

describe("buildCoachInput", () => {
  it("translates the snapshot into the JSON of the system prompt", () => {
    const input = buildCoachInput({
      kind: "notification",
      today: "2026-11-08",
      time: "13:05",
      hour: 13,
      targets: { kcal: 1700, proteinG: 140 },
      todayTotals: { kcal: 950.4, protein: 61.6 },
      loggedMeals: ["lunch"],
      weekly: weeklyBudget({ day: "2026-11-08", targetKcal: 1700, dailyKcal: [{ day: "2026-11-08", kcal: 950 }] }),
      recharge: recharge("unlocked"),
      streak,
      weight: {
        lastWeighIn: { day: "2026-11-08", kg: 80.04 },
        changeFromPrevious: { kg: 0.6, previousDay: "2026-11-07" },
        average7Kg: 80.31,
        weeklyTrendKg: -0.42,
        trend: "down",
        likelyWater: true,
        target: { kg: 75, arrivalDay: "2027-03-14", reason: "observed", shiftDays: 6 },
      },
      level: "jackpot",
      events: [{ kind: "recharge_unlocked", key: "recharge-unlocked:2026-11-02" }],
      recentMessages: ["Prima battuta."],
      report: null,
    });
    expect(input).toMatchObject({
      tipo: "notifica",
      ora: "13:05",
      oggi: { kcal: 950, obiettivo_kcal: 1700, kcal_massime_oggi: 2000, proteine_g: 62, obiettivo_proteine_g: 140 },
      budget_settimanale: { giorni_rimasti: 1 },
      ricarica: { stato: "sbloccata", kcal_ricarica: 2000, kcal_mancanti_per_sbloccarla: 0 },
      serie: { giorni_sopra_obiettivo_proteine: 5, traguardo: 5 },
      pasti_non_registrati: ["colazione"],
      peso: {
        ultima_pesata: { kg: 80, giorni_fa: 0 },
        variazione_dalla_pesata_precedente_kg: 0.6,
        media_7_giorni_kg: 80.3,
        trend: "in calo",
        probabile_acqua_glicogeno_sale: true,
      },
      obiettivo_peso: {
        kg: 75,
        data_prevista: "il 14 marzo 2027",
        spostamento_giorni_dall_ultima_volta: 6,
        nota: null,
      },
      livello: "jackpot",
      eventi: ["ricarica appena sbloccata"],
      ultimi_messaggi: ["Prima battuta."],
    });
    expect(input).not.toHaveProperty("settimana");
  });
});

describe("coachSystemPrompt", () => {
  it("fills in the name and the targets", () => {
    const prompt = coachSystemPrompt({ name: "Pietro", targetKcal: 1700, targetProteinG: 140, targetWeightKg: 75 });
    expect(prompt).toContain("Sei il coach alimentare di Pietro");
    expect(prompt).toContain("(1700 kcal, 140 g proteine)");
    expect(prompt).toContain("Cita la data prevista di arrivo a 75 kg.");
    expect(coachSystemPrompt({ name: "Anna", targetKcal: 1800, targetProteinG: 120, targetWeightKg: null })).toContain(
      "obiettivo: peso obiettivo non impostato",
    );
  });
});
