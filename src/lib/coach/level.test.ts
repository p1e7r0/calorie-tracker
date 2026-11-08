import { describe, expect, it } from "vitest";
import { defaultLevelProbabilities, drawLevel, levelProbabilitiesFromEnvironment, resolveLevel } from "./level";

describe("drawLevel", () => {
  const probabilities = { fierce: 0.2, jackpot: 0.05, silence: 0.1 };

  it("maps the random number onto the configured probabilities", () => {
    expect(drawLevel(probabilities, 0)).toBe("jackpot");
    expect(drawLevel(probabilities, 0.049)).toBe("jackpot");
    expect(drawLevel(probabilities, 0.05)).toBe("fierce");
    expect(drawLevel(probabilities, 0.249)).toBe("fierce");
    expect(drawLevel(probabilities, 0.25)).toBe("silence");
    expect(drawLevel(probabilities, 0.349)).toBe("silence");
    expect(drawLevel(probabilities, 0.35)).toBe("normal");
    expect(drawLevel(probabilities, 0.999)).toBe("normal");
  });

  it("is normal most of the time", () => {
    const counts = { normal: 0, fierce: 0, jackpot: 0, silence: 0 };
    for (let index = 0; index < 1000; index += 1) counts[drawLevel(probabilities, index / 1000)] += 1;
    expect(counts).toEqual({ normal: 650, fierce: 200, jackpot: 50, silence: 100 });
  });
});

describe("levelProbabilitiesFromEnvironment", () => {
  it("reads the probabilities and falls back on invalid values", () => {
    expect(levelProbabilitiesFromEnvironment({})).toEqual(defaultLevelProbabilities);
    expect(
      levelProbabilitiesFromEnvironment({
        COACH_PROBABILITY_FIERCE: "0,3",
        COACH_PROBABILITY_JACKPOT: "0.02",
        COACH_PROBABILITY_SILENCE: "abc",
      }),
    ).toEqual({ fierce: 0.3, jackpot: 0.02, silence: 0.1 });
  });

  it("ignores probabilities that add up to more than one", () => {
    expect(
      levelProbabilitiesFromEnvironment({ COACH_PROBABILITY_FIERCE: "0.8", COACH_PROBABILITY_SILENCE: "0.5" }),
    ).toEqual(defaultLevelProbabilities);
  });
});

describe("resolveLevel", () => {
  it("forces the fierce level on an overshoot or a broken streak", () => {
    expect(resolveLevel({ drawn: "jackpot", events: [{ kind: "overshoot", key: "a" }], allowSilence: true })).toBe(
      "fierce",
    );
    expect(
      resolveLevel({
        drawn: "silence",
        events: [
          { kind: "streak_broken", key: "a" },
          { kind: "streak_milestone", key: "b" },
        ],
        allowSilence: true,
      }),
    ).toBe("fierce");
  });

  it("turns an unlocked recharge or a streak milestone into a jackpot", () => {
    expect(
      resolveLevel({ drawn: "silence", events: [{ kind: "recharge_unlocked", key: "a" }], allowSilence: true }),
    ).toBe("jackpot");
  });

  it("keeps the drawn level otherwise, without silence where it is not allowed", () => {
    expect(resolveLevel({ drawn: "silence", events: [], allowSilence: true })).toBe("silence");
    expect(resolveLevel({ drawn: "silence", events: [], allowSilence: false })).toBe("normal");
    expect(resolveLevel({ drawn: "fierce", events: [], allowSilence: false })).toBe("fierce");
  });
});
