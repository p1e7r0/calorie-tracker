import { describe, expect, it } from "vitest";
import { changeOverDays, dailySeries, lastValuePerDay, movingAverage } from "./trends";

describe("lastValuePerDay", () => {
  it("keeps the last measurement of each day, sorted", () => {
    expect(
      lastValuePerDay([
        { day: "2026-10-02", value: 80 },
        { day: "2026-10-01", value: 81 },
        { day: "2026-10-02", value: 79.5 },
      ]),
    ).toEqual([
      { day: "2026-10-01", value: 81 },
      { day: "2026-10-02", value: 79.5 },
    ]);
  });
});

describe("movingAverage", () => {
  it("averages the points within the previous seven calendar days", () => {
    const averages = movingAverage([
      { day: "2026-10-01", value: 80 },
      { day: "2026-10-03", value: 82 },
      { day: "2026-10-07", value: 78 },
      { day: "2026-10-08", value: 76 },
    ]);
    expect(averages.map((point) => point.value)).toEqual([80, 81, 80, 78.66666666666667]);
  });
});

describe("changeOverDays", () => {
  it("compares the latest value with the newest value at least n days older", () => {
    expect(
      changeOverDays(
        [
          { day: "2026-09-01", value: 84 },
          { day: "2026-09-10", value: 83 },
          { day: "2026-10-12", value: 81.5 },
        ],
        30,
      ),
    ).toEqual({ change: -1.5, fromDay: "2026-09-10" });
  });

  it("falls back to the oldest value when the history is shorter", () => {
    expect(
      changeOverDays(
        [
          { day: "2026-10-01", value: 82 },
          { day: "2026-10-12", value: 81.5 },
        ],
        30,
      ),
    ).toEqual({ change: -0.5, fromDay: "2026-10-01" });
  });

  it("returns null with a single day of history", () => {
    expect(changeOverDays([{ day: "2026-10-12", value: 81.5 }], 30)).toBeNull();
  });
});

describe("dailySeries", () => {
  it("lists every day in the range", () => {
    expect(dailySeries("2026-09-29", "2026-10-02")).toEqual(["2026-09-29", "2026-09-30", "2026-10-01", "2026-10-02"]);
  });
});
