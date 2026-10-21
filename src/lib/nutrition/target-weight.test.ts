import { describe, expect, it } from "vitest";
import { addDays, formatDayWithArticle } from "./days";
import { formatSignedDecimal } from "./format";
import { describeTargetWeightProjection, observedWeeklyChange, projectTargetWeight } from "./target-weight";

const today = "2026-10-16";

function weeklyWeights(values: number[]) {
  return values.map((value, index) => ({ day: addDays(today, -7 * (values.length - 1 - index)), value }));
}

describe("observedWeeklyChange", () => {
  it("fits the weigh-ins of the last four weeks", () => {
    expect(observedWeeklyChange(weeklyWeights([80, 79.6, 79.2, 78.8]), today)).toBeCloseTo(-0.4, 5);
  });

  it("needs at least three weigh-ins spread over two weeks", () => {
    expect(observedWeeklyChange(weeklyWeights([80, 79.6]), today)).toBeNull();
    expect(
      observedWeeklyChange(
        [
          { day: addDays(today, -6), value: 80 },
          { day: addDays(today, -3), value: 79.8 },
          { day: today, value: 79.6 },
        ],
        today,
      ),
    ).toBeNull();
  });

  it("ignores weigh-ins older than the window", () => {
    expect(
      observedWeeklyChange(
        [
          { day: addDays(today, -60), value: 85 },
          { day: addDays(today, -45), value: 84 },
          { day: addDays(today, -30), value: 83 },
        ],
        today,
      ),
    ).toBeNull();
  });
});

describe("projectTargetWeight", () => {
  const base = { today, plannedWeeklyRateKg: 0.5, targetKg: 75 };

  it("uses the observed rate when it moves toward the target", () => {
    const projection = projectTargetWeight({ ...base, goal: "lose", weights: weeklyWeights([80, 79.6, 79.2, 78.8]) });
    expect(projection).toMatchObject({
      status: "projected",
      rateSource: "observed",
      plannedReason: null,
      expectedDay: "2026-12-22",
    });
    if (projection.status !== "projected") return;
    expect(projection.currentKg).toBeCloseTo(78.8, 5);
    expect(projection.remainingKg).toBeCloseTo(3.8, 5);
    expect(projection.weeklyChangeKg).toBeCloseTo(-0.4, 5);
  });

  it("falls back to the planned rate without enough weigh-ins", () => {
    const projection = projectTargetWeight({ ...base, goal: "lose", weights: [{ day: today, value: 80 }] });
    expect(projection).toMatchObject({
      status: "projected",
      rateSource: "planned",
      plannedReason: "not-enough-data",
      weeklyChangeKg: -0.5,
      remainingKg: 5,
      expectedDay: "2026-12-25",
    });
  });

  it("falls back to the planned rate when the trend moves away from the target", () => {
    const projection = projectTargetWeight({
      ...base,
      plannedWeeklyRateKg: 0.25,
      goal: "lose",
      weights: weeklyWeights([78, 78.2, 78.4, 78.6]),
    });
    expect(projection).toMatchObject({
      status: "projected",
      rateSource: "planned",
      plannedReason: "moving-away",
      weeklyChangeKg: -0.25,
      expectedDay: "2027-01-25",
    });
  });

  it("falls back to the planned rate when the weight is stable", () => {
    const projection = projectTargetWeight({
      ...base,
      targetKg: 65,
      goal: "gain",
      weights: weeklyWeights([60, 60, 60, 60]),
    });
    expect(projection).toMatchObject({
      status: "projected",
      rateSource: "planned",
      plannedReason: "stalled",
      weeklyChangeKg: 0.5,
      expectedDay: "2026-12-25",
    });
  });

  it("projects a weight gain with the observed rate", () => {
    const projection = projectTargetWeight({
      ...base,
      targetKg: 63.1,
      goal: "gain",
      weights: weeklyWeights([60, 60.3, 60.6, 60.9]),
    });
    expect(projection).toMatchObject({ status: "projected", rateSource: "observed" });
    if (projection.status !== "projected") return;
    expect(projection.weeklyChangeKg).toBeCloseTo(0.3, 5);
    expect(projection.expectedDay).toBe("2026-12-07");
  });

  it("uses the seven-day trend as the current weight", () => {
    const projection = projectTargetWeight({
      ...base,
      goal: "lose",
      weights: [
        { day: addDays(today, -2), value: 76 },
        { day: today, value: 74.9 },
      ],
    });
    expect(projection).toMatchObject({ status: "projected" });
    if (projection.status !== "projected") return;
    expect(projection.currentKg).toBeCloseTo(75.45, 5);
  });

  it("says when the target has been reached", () => {
    expect(projectTargetWeight({ ...base, goal: "lose", weights: [{ day: today, value: 74.8 }] })).toMatchObject({
      status: "reached",
    });
    expect(
      projectTargetWeight({ ...base, targetKg: 70, goal: "gain", weights: [{ day: today, value: 70.05 }] }),
    ).toMatchObject({ status: "reached" });
  });

  it("does not project without weigh-ins or with the maintain goal", () => {
    expect(projectTargetWeight({ ...base, goal: "lose", weights: [] })).toEqual({ status: "no-data", targetKg: 75 });
    expect(projectTargetWeight({ ...base, goal: "maintain", weights: [{ day: today, value: 80 }] })).toEqual({
      status: "maintain",
      targetKg: 75,
    });
  });

  it("ignores weigh-ins after today", () => {
    expect(projectTargetWeight({ ...base, goal: "lose", weights: [{ day: addDays(today, 1), value: 80 }] })).toEqual({
      status: "no-data",
      targetKg: 75,
    });
  });
});

describe("describeTargetWeightProjection", () => {
  const base = { today, plannedWeeklyRateKg: 0.5, targetKg: 75 };

  it("describes the observed rate", () => {
    const projection = projectTargetWeight({ ...base, goal: "lose", weights: weeklyWeights([80, 79.6, 79.2, 78.8]) });
    expect(describeTargetWeightProjection(projection, today)).toBe(
      "Ti mancano 3,8 kg. Al ritmo attuale (−0,4 kg a settimana) arrivi a 75 kg verso il 22 dicembre.",
    );
  });

  it("explains why it uses the planned rate", () => {
    expect(
      describeTargetWeightProjection(
        projectTargetWeight({ ...base, goal: "lose", weights: [{ day: today, value: 80 }] }),
        today,
      ),
    ).toBe(
      "Ti mancano 5 kg. Servono più pesate per conoscere il tuo ritmo reale: al ritmo che hai scelto (−0,5 kg a settimana) arriveresti a 75 kg verso il 25 dicembre.",
    );
    expect(
      describeTargetWeightProjection(
        projectTargetWeight({
          ...base,
          plannedWeeklyRateKg: 0.25,
          goal: "lose",
          weights: weeklyWeights([78, 78.2, 78.4, 78.6]),
        }),
        today,
      ),
    ).toBe(
      "Ti mancano 3,6 kg. Nelle ultime settimane il peso si allontana dall'obiettivo (+0,2 kg a settimana): al ritmo che hai scelto (−0,25 kg a settimana) arriveresti a 75 kg verso il 25 gennaio 2027.",
    );
    expect(
      describeTargetWeightProjection(
        projectTargetWeight({ ...base, targetKg: 65, goal: "gain", weights: weeklyWeights([60, 60, 60, 60]) }),
        today,
      ),
    ).toBe(
      "Ti mancano 5 kg. Nelle ultime settimane il peso è stabile: al ritmo che hai scelto (+0,5 kg a settimana) arriveresti a 65 kg verso il 25 dicembre.",
    );
  });

  it("uses the singular when one kilogram is left", () => {
    const projection = projectTargetWeight({ ...base, goal: "lose", weights: [{ day: today, value: 76 }] });
    expect(describeTargetWeightProjection(projection, today)).toMatch(/^Ti manca 1 kg\. /);
    const almost = projectTargetWeight({ ...base, goal: "lose", weights: [{ day: today, value: 75.96 }] });
    expect(describeTargetWeightProjection(almost, today)).toMatch(/^Ti manca 1 kg\. /);
    const more = projectTargetWeight({ ...base, goal: "lose", weights: [{ day: today, value: 76.1 }] });
    expect(describeTargetWeightProjection(more, today)).toMatch(/^Ti mancano 1,1 kg\. /);
  });

  it("describes the other states", () => {
    expect(describeTargetWeightProjection({ status: "reached", targetKg: 75, currentKg: 74.8 }, today)).toBe(
      "Hai raggiunto il peso obiettivo di 75 kg.",
    );
    expect(describeTargetWeightProjection({ status: "no-data", targetKg: 72.5 }, today)).toBe(
      "Peso obiettivo 72,5 kg. Aggiungi una misurazione per sapere quanto ti manca.",
    );
    expect(describeTargetWeightProjection({ status: "maintain", targetKg: 75 }, today)).toBe("Peso obiettivo 75 kg.");
  });
});

describe("formatDayWithArticle", () => {
  it("adds the Italian article and the year only when it differs", () => {
    expect(formatDayWithArticle("2026-12-22", today)).toBe("il 22 dicembre");
    expect(formatDayWithArticle("2026-03-08", today)).toBe("l'8 marzo");
    expect(formatDayWithArticle("2027-01-11", today)).toBe("l'11 gennaio 2027");
    expect(formatDayWithArticle("2027-01-01", today)).toBe("il 1° gennaio 2027");
  });
});

describe("formatSignedDecimal", () => {
  it("uses the minus sign and rounds to one decimal", () => {
    expect(formatSignedDecimal(-0.43)).toBe("−0,4");
    expect(formatSignedDecimal(1.25)).toBe("+1,3");
    expect(formatSignedDecimal(0.04)).toBe("0");
  });
});
