import { describe, expect, it } from "vitest";
import { addDays } from "../nutrition/days";
import { coachWeight } from "./weight";

const today = "2026-11-08";

function losing(days: number, startKg: number, dailyLossKg: number) {
  return Array.from({ length: days }, (_, index) => ({
    day: addDays(today, index - days + 1),
    value: Math.round((startKg - index * dailyLossKg) * 10) / 10,
  }));
}

describe("coachWeight", () => {
  it("summarizes the last weigh-in, the 7-day average and its weekly trend", () => {
    const result = coachWeight({
      weights: losing(21, 82, 0.1),
      today,
      targetKg: 75,
      plannedWeeklyRateKg: 0.5,
      previousArrivalDay: null,
    });
    expect(result.lastWeighIn).toEqual({ day: today, kg: 80 });
    expect(result.changeFromPrevious?.kg).toBeCloseTo(-0.1);
    expect(result.average7Kg).toBeCloseTo(80.3);
    expect(result.weeklyTrendKg).toBeCloseTo(-0.7);
    expect(result.trend).toBe("down");
    expect(result.likelyWater).toBe(false);
    expect(result.target).toMatchObject({ kg: 75, reason: "observed", shiftDays: null });
    expect(result.target?.arrivalDay).toBe(addDays(today, 53));
  });

  it("flags a jump of half a kilo as water when the average does not go up", () => {
    const weights = [...losing(20, 82, 0.1).slice(0, 19), { day: addDays(today, -1), value: 80.1 }];
    weights.push({ day: today, value: 80.7 });
    const result = coachWeight({ weights, today, targetKg: 75, plannedWeeklyRateKg: 0.5, previousArrivalDay: null });
    expect(result.changeFromPrevious?.kg).toBeCloseTo(0.6);
    expect(result.trend).toBe("down");
    expect(result.likelyWater).toBe(true);
  });

  it("says how many days the arrival date moved since the last message", () => {
    const result = coachWeight({
      weights: losing(21, 82, 0.1),
      today,
      targetKg: 75,
      plannedWeeklyRateKg: 0.5,
      previousArrivalDay: addDays(today, 47),
    });
    expect(result.target?.shiftDays).toBe(6);
  });

  it("has no arrival date when the weight is stalled or there are too few weigh-ins", () => {
    const stalled = Array.from({ length: 21 }, (_, index) => ({ day: addDays(today, index - 20), value: 80 }));
    expect(
      coachWeight({ weights: stalled, today, targetKg: 75, plannedWeeklyRateKg: 0.5, previousArrivalDay: null }).target,
    ).toEqual({ kg: 75, arrivalDay: null, reason: "stalled", shiftDays: null });
    expect(
      coachWeight({
        weights: [{ day: today, value: 80 }],
        today,
        targetKg: 75,
        plannedWeeklyRateKg: 0.5,
        previousArrivalDay: null,
      }),
    ).toMatchObject({
      changeFromPrevious: null,
      trend: null,
      target: { reason: "not-enough-data", arrivalDay: null },
    });
  });

  it("works without weigh-ins or target weight", () => {
    expect(
      coachWeight({ weights: [], today, targetKg: null, plannedWeeklyRateKg: 0.5, previousArrivalDay: null }),
    ).toEqual({
      lastWeighIn: null,
      changeFromPrevious: null,
      average7Kg: null,
      weeklyTrendKg: null,
      trend: null,
      likelyWater: false,
      target: null,
    });
  });
});
