import { describe, expect, it } from "vitest";
import { proteinStreak } from "./streak";

const targetProteinG = 140;

function days(values: Record<string, number>) {
  return Object.entries(values).map(([day, protein]) => ({ day, protein }));
}

describe("proteinStreak", () => {
  it("counts consecutive days above the protein target, today included once reached", () => {
    const dailyProtein = days({
      "2026-11-03": 100,
      "2026-11-04": 150,
      "2026-11-05": 141,
      "2026-11-06": 140,
      "2026-11-07": 60,
    });
    expect(proteinStreak({ today: "2026-11-07", dailyProtein, targetProteinG })).toEqual({
      days: 3,
      startDay: "2026-11-04",
      todayReached: false,
      milestone: null,
      brokenDays: null,
    });
    const reached = [...dailyProtein.slice(0, 4), { day: "2026-11-07", protein: 145 }];
    expect(proteinStreak({ today: "2026-11-07", dailyProtein: reached, targetProteinG })).toMatchObject({
      days: 4,
      todayReached: true,
    });
  });

  it("marks every fifth day as a milestone", () => {
    const dailyProtein = days({
      "2026-11-03": 150,
      "2026-11-04": 150,
      "2026-11-05": 150,
      "2026-11-06": 150,
      "2026-11-07": 150,
    });
    expect(proteinStreak({ today: "2026-11-07", dailyProtein, targetProteinG })).toMatchObject({
      days: 5,
      milestone: 5,
      startDay: "2026-11-03",
    });
  });

  it("reports a streak broken yesterday", () => {
    const dailyProtein = days({
      "2026-11-02": 150,
      "2026-11-03": 150,
      "2026-11-04": 150,
      "2026-11-05": 150,
      "2026-11-06": 90,
    });
    expect(proteinStreak({ today: "2026-11-07", dailyProtein, targetProteinG })).toMatchObject({
      days: 0,
      startDay: null,
      brokenDays: 4,
    });
  });

  it("ignores short streaks and days without entries break the streak", () => {
    const dailyProtein = days({ "2026-11-04": 150, "2026-11-05": 150 });
    expect(proteinStreak({ today: "2026-11-07", dailyProtein, targetProteinG })).toMatchObject({
      days: 0,
      brokenDays: null,
    });
  });

  it("skips past days marked as incomplete", () => {
    const dailyProtein = days({ "2026-11-04": 150, "2026-11-05": 20, "2026-11-06": 150 });
    expect(
      proteinStreak({ today: "2026-11-07", dailyProtein, targetProteinG, incompleteDays: ["2026-11-05"] }),
    ).toMatchObject({ days: 2, startDay: "2026-11-04" });
  });
});
