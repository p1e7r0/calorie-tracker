import { describe, expect, it } from "vitest";
import { dayTargetKcal, rechargeAllowanceKcal, rechargeState } from "./recharge";

const targetKcal = 1700;

describe("rechargeState", () => {
  it("unlocks when the kcal saved this week cover a 2000 kcal day", () => {
    const state = rechargeState({
      day: "2026-11-05",
      targetKcal,
      dailyKcal: [
        { day: "2026-11-02", kcal: 1500 },
        { day: "2026-11-03", kcal: 1600 },
        { day: "2026-11-04", kcal: 1700 },
        { day: "2026-11-05", kcal: 2400 },
      ],
      rechargeDays: [],
    });
    expect(state).toEqual({ status: "unlocked", dayKcal: 2000, rechargeDay: null, bankedKcal: 300, missingKcal: 0 });
  });

  it("stays locked and says how much is missing", () => {
    const state = rechargeState({
      day: "2026-11-04",
      targetKcal,
      dailyKcal: [
        { day: "2026-11-02", kcal: 1650 },
        { day: "2026-11-03", kcal: 1700 },
      ],
      rechargeDays: [],
    });
    expect(state).toMatchObject({ status: "locked", bankedKcal: 50, missingKcal: 250 });
  });

  it("is locked on Monday, with nothing saved yet", () => {
    const state = rechargeState({ day: "2026-11-02", targetKcal, dailyKcal: [], rechargeDays: [] });
    expect(state).toMatchObject({ status: "locked", bankedKcal: 0, missingKcal: 300 });
  });

  it("counts unlogged and incomplete past days as on target", () => {
    const state = rechargeState({
      day: "2026-11-05",
      targetKcal,
      dailyKcal: [{ day: "2026-11-03", kcal: 900 }],
      incompleteDays: ["2026-11-03"],
      rechargeDays: [],
    });
    expect(state).toMatchObject({ status: "locked", bankedKcal: 0 });
  });

  it("is active on the recharge day and used on the other days of the week", () => {
    const input = { targetKcal, dailyKcal: [], rechargeDays: ["2026-11-04", "2026-10-28"] };
    expect(rechargeState({ ...input, day: "2026-11-04" }).status).toBe("active");
    expect(rechargeState({ ...input, day: "2026-11-06" }).status).toBe("used");
    expect(rechargeState({ ...input, day: "2026-11-09" }).status).toBe("locked");
  });

  it("is always unlocked when the daily target is already above the recharge day", () => {
    const state = rechargeState({ day: "2026-11-02", targetKcal: 2200, dailyKcal: [], rechargeDays: [] });
    expect(state.status).toBe("unlocked");
  });
});

describe("recharge allowance", () => {
  it("raises the day target only on an active recharge day", () => {
    const base = { dayKcal: 2000, rechargeDay: null, bankedKcal: 0, missingKcal: 0 };
    expect(dayTargetKcal({ ...base, status: "active" }, targetKcal)).toBe(2000);
    expect(dayTargetKcal({ ...base, status: "unlocked" }, targetKcal)).toBe(1700);
    expect(rechargeAllowanceKcal({ ...base, status: "unlocked" }, targetKcal)).toBe(2000);
    expect(rechargeAllowanceKcal({ ...base, status: "locked" }, targetKcal)).toBe(1700);
    expect(rechargeAllowanceKcal({ ...base, status: "used" }, targetKcal)).toBe(1700);
  });
});
