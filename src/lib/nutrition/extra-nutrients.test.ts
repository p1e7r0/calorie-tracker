import { describe, expect, it } from "vitest";
import { multiplyExtras, roundExtras, scaleExtras, sumExtras } from "./extra-nutrients";

describe("extra nutrients", () => {
  it("scales known values and keeps unknown ones unknown", () => {
    const scaled = scaleExtras({ fiber: 4, sugars: null, saturatedFat: 1.5, salt: 0.2 }, 150);
    expect(scaled).toMatchObject({ fiber: 6, sugars: null, saturatedFat: 2.25 });
    expect(scaled.salt).toBeCloseTo(0.3);
    expect(roundExtras(multiplyExtras({ fiber: 1, sugars: 2, saturatedFat: null, salt: 0.333 }, 3))).toEqual({
      fiber: 3,
      sugars: 6,
      saturatedFat: null,
      salt: 1,
    });
  });

  it("sums only the values it knows", () => {
    expect(
      sumExtras([
        { fiber: 2, sugars: null, saturatedFat: null, salt: 0.5 },
        { fiber: 3, sugars: null, saturatedFat: 1, salt: null },
      ]),
    ).toEqual({ fiber: 5, sugars: null, saturatedFat: 1, salt: 0.5 });
  });
});
