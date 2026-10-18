import { describe, expect, it } from "vitest";
import { estimateMaintenance, weightSlopePerDay } from "./adaptive";
import { addDays } from "./days";

const today = "2026-10-16";

function intakes(days: number, kcal: number) {
  return Array.from({ length: days }, (_, index) => ({ day: addDays(today, -(index + 1)), value: kcal }));
}

describe("weightSlopePerDay", () => {
  it("fits a straight line through the weigh-ins", () => {
    const weights = [
      { day: "2026-10-01", value: 90 },
      { day: "2026-10-08", value: 89.3 },
      { day: "2026-10-15", value: 88.6 },
    ];
    expect(weightSlopePerDay(weights)).toBeCloseTo(-0.1, 5);
  });

  it("returns zero with a single weigh-in", () => {
    expect(weightSlopePerDay([{ day: today, value: 80 }])).toBe(0);
  });
});

describe("estimateMaintenance", () => {
  it("adds the energy lost as weight to the average intake", () => {
    const estimate = estimateMaintenance({
      dailyIntakes: intakes(21, 2000),
      weights: [
        { day: addDays(today, -21), value: 90 },
        { day: addDays(today, -14), value: 89.5 },
        { day: addDays(today, -7), value: 89 },
        { day: today, value: 88.5 },
      ],
      today,
    });
    expect(estimate.status).toBe("ready");
    if (estimate.status !== "ready") return;
    expect(estimate.averageIntakeKcal).toBe(2000);
    expect(estimate.weeklyWeightChangeKg).toBe(-0.5);
    expect(estimate.maintenanceKcal).toBe(2550);
  });

  it("matches the intake when the weight is stable", () => {
    const estimate = estimateMaintenance({
      dailyIntakes: intakes(20, 2300),
      weights: [
        { day: addDays(today, -20), value: 75 },
        { day: today, value: 75 },
      ],
      today,
    });
    expect(estimate).toMatchObject({ status: "ready", maintenanceKcal: 2300 });
  });

  it("ignores days that look only partly logged", () => {
    const estimate = estimateMaintenance({
      dailyIntakes: [...intakes(14, 2000), { day: addDays(today, -20), value: 300 }],
      weights: [
        { day: addDays(today, -20), value: 75 },
        { day: today, value: 75 },
      ],
      today,
    });
    expect(estimate).toMatchObject({ status: "ready", loggedDays: 14, averageIntakeKcal: 2000 });
  });

  it("asks for more data with too few logged days or close weigh-ins", () => {
    expect(
      estimateMaintenance({
        dailyIntakes: intakes(10, 2000),
        weights: [
          { day: addDays(today, -20), value: 75 },
          { day: today, value: 75 },
        ],
        today,
      }),
    ).toEqual({ status: "insufficient", loggedDays: 10, weightSpanDays: 20, excludedIncompleteDays: 0 });
    expect(
      estimateMaintenance({
        dailyIntakes: intakes(20, 2000),
        weights: [
          { day: addDays(today, -5), value: 75 },
          { day: today, value: 75 },
        ],
        today,
      }),
    ).toEqual({ status: "insufficient", loggedDays: 20, weightSpanDays: 5, excludedIncompleteDays: 0 });
  });

  it("leaves out the days marked as incomplete", () => {
    const weights = [
      { day: addDays(today, -20), value: 75 },
      { day: today, value: 75 },
    ];
    const dailyIntakes = [...intakes(14, 2000), { day: addDays(today, -15), value: 1200 }];
    const estimate = estimateMaintenance({
      dailyIntakes,
      weights,
      today,
      incompleteDays: [addDays(today, -15), addDays(today, -40), today],
    });
    expect(estimate).toMatchObject({
      status: "ready",
      loggedDays: 14,
      averageIntakeKcal: 2000,
      excludedIncompleteDays: 1,
    });
    expect(
      estimateMaintenance({ dailyIntakes, weights, today, incompleteDays: [addDays(today, -1), addDays(today, -2)] }),
    ).toEqual({ status: "insufficient", loggedDays: 13, weightSpanDays: 20, excludedIncompleteDays: 2 });
  });

  it("flags results that make no physiological sense", () => {
    const estimate = estimateMaintenance({
      dailyIntakes: intakes(20, 1500),
      weights: [
        { day: addDays(today, -20), value: 80 },
        { day: today, value: 62 },
      ],
      today,
    });
    expect(estimate.status).toBe("implausible");
  });
});
