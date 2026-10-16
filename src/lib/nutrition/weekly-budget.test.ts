import { describe, expect, it } from "vitest";
import { weeklyBudget } from "./weekly-budget";

describe("weeklyBudget", () => {
  it("spreads what is left of the week over the remaining days", () => {
    const budget = weeklyBudget({
      day: "2026-10-15",
      targetKcal: 2000,
      dailyKcal: [
        { day: "2026-10-11", kcal: 3000 },
        { day: "2026-10-12", kcal: 2000 },
        { day: "2026-10-13", kcal: 2600 },
        { day: "2026-10-14", kcal: 2400 },
        { day: "2026-10-15", kcal: 900 },
      ],
    });
    expect(budget).toEqual({
      weekStart: "2026-10-12",
      budgetKcal: 14000,
      eatenKcal: 7900,
      remainingKcal: 6100,
      daysLeft: 4,
      suggestedTodayKcal: 1750,
    });
  });

  it("counts past days without entries as on target", () => {
    const budget = weeklyBudget({
      day: "2026-10-16",
      targetKcal: 2000,
      dailyKcal: [{ day: "2026-10-14", kcal: 2600 }],
    });
    expect(budget).toMatchObject({ eatenKcal: 8600, remainingKcal: 5400, daysLeft: 3, suggestedTodayKcal: 1800 });
  });

  it("never suggests a negative amount", () => {
    const budget = weeklyBudget({
      day: "2026-10-18",
      targetKcal: 1500,
      dailyKcal: [{ day: "2026-10-12", kcal: 12000 }],
    });
    expect(budget.daysLeft).toBe(1);
    expect(budget.suggestedTodayKcal).toBe(0);
  });
});
