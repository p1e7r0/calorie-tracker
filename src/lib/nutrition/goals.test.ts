import { describe, expect, it } from "vitest";
import { ageOn, basalMetabolicRate, computeDailyTargets, kcalAboveTarget } from "./goals";

describe("ageOn", () => {
  it("counts completed years", () => {
    expect(ageOn("1990-10-16", "2026-10-15")).toBe(35);
    expect(ageOn("1990-10-15", "2026-10-15")).toBe(36);
  });
});

describe("basalMetabolicRate", () => {
  it("applies Mifflin-St Jeor for men and women", () => {
    expect(basalMetabolicRate({ sex: "male", weightKg: 80, heightCm: 180, age: 35 })).toBe(1755);
    expect(basalMetabolicRate({ sex: "female", weightKg: 60, heightCm: 165, age: 30 })).toBe(1320.25);
  });
});

describe("computeDailyTargets", () => {
  const person = { sex: "male", weightKg: 80, heightCm: 180, age: 35, activityLevel: "moderate" } as const;

  it("keeps maintenance kcal when the goal is to maintain", () => {
    const targets = computeDailyTargets({ ...person, goal: "maintain", weeklyRateKg: 0.5 });
    expect(targets.maintenanceKcal).toBe(2720);
    expect(targets.kcal).toBe(2720);
  });

  it("subtracts the deficit for the weekly rate when losing weight", () => {
    const targets = computeDailyTargets({ ...person, goal: "lose", weeklyRateKg: 0.5 });
    expect(targets.kcal).toBe(2170);
    expect(targets.proteinG).toBe(160);
    expect(targets.fatG).toBe(60);
    expect(targets.carbsG).toBe(248);
  });

  it("never goes below the safety minimum", () => {
    const targets = computeDailyTargets({
      sex: "female",
      weightKg: 50,
      heightCm: 155,
      age: 60,
      activityLevel: "sedentary",
      goal: "lose",
      weeklyRateKg: 1,
    });
    expect(targets.kcal).toBe(1200);
  });
});

describe("kcalAboveTarget", () => {
  it("returns the rounded excess over the target", () => {
    expect(kcalAboveTarget(2350.4, 2000)).toBe(350);
    expect(kcalAboveTarget(2000.4, 2000)).toBe(0);
  });

  it("returns zero on or below the target", () => {
    expect(kcalAboveTarget(2000, 2000)).toBe(0);
    expect(kcalAboveTarget(1500, 2000)).toBe(0);
  });

  it("returns zero without a value or a target", () => {
    expect(kcalAboveTarget(null, 2000)).toBe(0);
    expect(kcalAboveTarget(2500, null)).toBe(0);
  });
});
