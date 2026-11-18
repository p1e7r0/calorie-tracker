import { describe, expect, it } from "vitest";
import { dayTargetKcal, rechargeAllowanceKcal, rechargeState } from "./recharge";

const targetKcal = 1700;

describe("rechargeState", () => {
  it("unlocks as much as was saved, across weeks", () => {
    const state = rechargeState({
      day: "2026-11-24",
      targetKcal,
      dailyKcal: [
        { day: "2026-11-20", kcal: 1500 },
        { day: "2026-11-21", kcal: 1600 },
        { day: "2026-11-22", kcal: 1700 },
        { day: "2026-11-23", kcal: 1450 },
        { day: "2026-11-24", kcal: 2400 },
      ],
      events: [],
    });
    expect(state).toEqual({
      status: "unlocked",
      sinceDay: "2026-11-16",
      bankedKcal: 550,
      missingKcal: 0,
      bonusKcal: 0,
      dayKcal: 2250,
    });
  });

  it("stays locked below the minimum and says how much is missing", () => {
    const state = rechargeState({
      day: "2026-11-19",
      targetKcal,
      dailyKcal: [
        { day: "2026-11-17", kcal: 1650 },
        { day: "2026-11-18", kcal: 1700 },
      ],
      events: [],
    });
    expect(state).toMatchObject({
      status: "locked",
      bankedKcal: 50,
      missingKcal: 250,
    });
  });

  it("subtracts the days over target", () => {
    const state = rechargeState({
      day: "2026-11-20",
      targetKcal,
      dailyKcal: [
        { day: "2026-11-17", kcal: 1300 },
        { day: "2026-11-18", kcal: 2200 },
      ],
      events: [],
    });
    expect(state).toMatchObject({
      status: "locked",
      bankedKcal: -100,
      missingKcal: 400,
      dayKcal: 1700,
    });
  });

  it("ignores unlogged, partial and incomplete days", () => {
    const state = rechargeState({
      day: "2026-11-20",
      targetKcal,
      dailyKcal: [
        { day: "2026-11-17", kcal: 900 },
        { day: "2026-11-18", kcal: 400 },
      ],
      incompleteDays: ["2026-11-17"],
      events: [],
    });
    expect(state).toMatchObject({ status: "locked", bankedKcal: 0 });
  });

  it("starts again after a recharge, counting what was left of it", () => {
    const state = rechargeState({
      day: "2026-11-26",
      targetKcal,
      dailyKcal: [
        { day: "2026-11-18", kcal: 1000 },
        { day: "2026-11-24", kcal: 2000 },
        { day: "2026-11-25", kcal: 1600 },
      ],
      events: [{ day: "2026-11-24", outcome: "used", bonusKcal: 500 }],
    });
    expect(state).toMatchObject({
      status: "unlocked",
      sinceDay: "2026-11-24",
      bankedKcal: 300,
    });
  });

  it("starts from zero the day after a refusal", () => {
    const state = rechargeState({
      day: "2026-11-26",
      targetKcal,
      dailyKcal: [
        { day: "2026-11-18", kcal: 1000 },
        { day: "2026-11-24", kcal: 1500 },
        { day: "2026-11-25", kcal: 1600 },
      ],
      events: [{ day: "2026-11-24", outcome: "declined", bonusKcal: 0 }],
    });
    expect(state).toMatchObject({ status: "unlocked", bankedKcal: 300 });
  });

  it("is active or declined on the day of the choice", () => {
    const input = {
      day: "2026-11-24",
      targetKcal,
      dailyKcal: [{ day: "2026-11-24", kcal: 1900 }],
    };
    expect(
      rechargeState({
        ...input,
        events: [{ day: "2026-11-24", outcome: "used", bonusKcal: 450 }],
      }),
    ).toEqual({
      status: "active",
      sinceDay: "2026-11-24",
      bankedKcal: 450,
      missingKcal: 0,
      bonusKcal: 450,
      dayKcal: 2150,
    });
    expect(
      rechargeState({
        ...input,
        events: [{ day: "2026-11-24", outcome: "declined", bonusKcal: 0 }],
      }),
    ).toMatchObject({ status: "declined", dayKcal: 1700 });
  });

  it("is postponed only on the day it was postponed", () => {
    const input = {
      targetKcal,
      dailyKcal: [{ day: "2026-11-17", kcal: 1200 }],
      events: [],
      postponedOn: "2026-11-19",
    };
    expect(rechargeState({ ...input, day: "2026-11-19" }).status).toBe("postponed");
    expect(rechargeState({ ...input, day: "2026-11-20" }).status).toBe("unlocked");
  });

  it("does not count the days before the start of the bank", () => {
    const state = rechargeState({
      day: "2026-11-17",
      targetKcal,
      dailyKcal: [{ day: "2026-11-10", kcal: 500 }],
      events: [{ day: "2026-11-04", outcome: "used", bonusKcal: 300 }],
    });
    expect(state).toMatchObject({ sinceDay: "2026-11-16", bankedKcal: 0 });
  });
});

describe("recharge allowance", () => {
  const base = {
    sinceDay: "2026-11-16",
    bankedKcal: 400,
    missingKcal: 0,
    bonusKcal: 0,
    dayKcal: 2100,
  };

  it("raises the day target only on an active recharge day", () => {
    expect(dayTargetKcal({ ...base, status: "active" }, targetKcal)).toBe(2100);
    expect(dayTargetKcal({ ...base, status: "unlocked" }, targetKcal)).toBe(1700);
  });

  it("allows the saved kcal while the recharge can still be used", () => {
    expect(rechargeAllowanceKcal({ ...base, status: "unlocked" }, targetKcal)).toBe(2100);
    expect(rechargeAllowanceKcal({ ...base, status: "postponed" }, targetKcal)).toBe(2100);
    expect(rechargeAllowanceKcal({ ...base, status: "locked" }, targetKcal)).toBe(1700);
    expect(rechargeAllowanceKcal({ ...base, status: "declined" }, targetKcal)).toBe(1700);
  });
});
