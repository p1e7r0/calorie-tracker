import { describe, expect, it } from "vitest";
import { averageByWeek, weekStart } from "./weeks";

describe("weekStart", () => {
  it("returns the Monday of the week", () => {
    expect(weekStart("2026-10-15")).toBe("2026-10-12");
    expect(weekStart("2026-10-12")).toBe("2026-10-12");
    expect(weekStart("2026-10-18")).toBe("2026-10-12");
  });
});

describe("averageByWeek", () => {
  it("averages the logged days of each week", () => {
    expect(
      averageByWeek(
        [
          { day: "2026-10-05", kcal: 2000 },
          { day: "2026-10-07", kcal: 1800 },
          { day: "2026-10-13", kcal: 2100 },
        ],
        (item) => item.kcal,
      ),
    ).toEqual([
      { week: "2026-10-05", average: 1900, count: 2 },
      { week: "2026-10-12", average: 2100, count: 1 },
    ]);
  });
});
