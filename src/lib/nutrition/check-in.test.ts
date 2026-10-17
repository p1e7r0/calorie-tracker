import { describe, expect, it } from "vitest";
import { isCheckInDue, maintenanceHistory, previousWeekSummary } from "./check-in";
import { addDays } from "./days";

const wednesday = "2026-10-14";

describe("previousWeekSummary", () => {
  it("averages the logged days of the previous calendar week", () => {
    const summary = previousWeekSummary(
      [
        { day: "2026-10-04", kcal: 3000, protein: 50 },
        { day: "2026-10-05", kcal: 2000, protein: 100 },
        { day: "2026-10-07", kcal: 1800, protein: 80 },
        { day: "2026-10-11", kcal: 0, protein: 0 },
        { day: "2026-10-12", kcal: 2500, protein: 120 },
      ],
      wednesday,
    );
    expect(summary).toEqual({ weekStart: "2026-10-05", loggedDays: 2, averageKcal: 1900, averageProteinG: 90 });
  });

  it("returns nothing when the previous week is empty", () => {
    expect(previousWeekSummary([{ day: "2026-10-13", kcal: 2000, protein: 90 }], wednesday)).toBeNull();
  });
});

describe("isCheckInDue", () => {
  it("is due once per week, starting on Monday", () => {
    expect(isCheckInDue({ today: wednesday, lastCheckInWeek: null })).toBe(true);
    expect(isCheckInDue({ today: wednesday, lastCheckInWeek: "2026-10-05" })).toBe(true);
    expect(isCheckInDue({ today: wednesday, lastCheckInWeek: "2026-10-12" })).toBe(false);
    expect(isCheckInDue({ today: "2026-10-19", lastCheckInWeek: "2026-10-12" })).toBe(true);
  });
});

describe("maintenanceHistory", () => {
  it("estimates the maintenance as of each past Monday and of today, oldest first", () => {
    const dailyIntakes = Array.from({ length: 70 }, (_, index) => ({ day: addDays(wednesday, -(index + 1)), value: 2000 }));
    const weights = Array.from({ length: 9 }, (_, index) => ({
      day: addDays(wednesday, -7 * index),
      value: 80 + index * 0.5,
    }));
    const history = maintenanceHistory({ dailyIntakes, weights, today: wednesday, weeks: 8 });
    expect(history.map((point) => point.day)).toEqual([
      "2026-08-24",
      "2026-08-31",
      "2026-09-07",
      "2026-09-14",
      "2026-09-21",
      "2026-09-28",
      "2026-10-05",
      wednesday,
    ]);
    expect(history[0].maintenanceKcal).toBeNull();
    expect(history.at(-1)?.maintenanceKcal).toBe(2550);
  });
});
