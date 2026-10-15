import { describe, expect, it } from "vitest";
import { kcalFromMacros, roundNutrients, scaleNutrients, sumNutrients } from "./nutrients";

const pasta = { kcal: 356, protein: 12.5, carbs: 72, fat: 1.5 };

describe("scaleNutrients", () => {
  it("scales values given per 100 g to the eaten quantity", () => {
    const nutrients = scaleNutrients(pasta, 80);
    expect(nutrients.kcal).toBeCloseTo(284.8);
    expect(nutrients.protein).toBeCloseTo(10);
    expect(nutrients.carbs).toBeCloseTo(57.6);
    expect(nutrients.fat).toBeCloseTo(1.2);
  });

  it("returns zero for zero grams", () => {
    expect(scaleNutrients(pasta, 0)).toEqual({ kcal: 0, protein: 0, carbs: 0, fat: 0 });
  });
});

describe("sumNutrients", () => {
  it("adds every nutrient", () => {
    expect(sumNutrients([pasta, pasta])).toEqual({ kcal: 712, protein: 25, carbs: 144, fat: 3 });
  });

  it("returns zero for an empty list", () => {
    expect(sumNutrients([])).toEqual({ kcal: 0, protein: 0, carbs: 0, fat: 0 });
  });
});

describe("roundNutrients", () => {
  it("rounds kcal to integers and macros to one decimal", () => {
    expect(roundNutrients({ kcal: 284.8, protein: 10.04, carbs: 57.66, fat: 1.25 })).toEqual({
      kcal: 285,
      protein: 10,
      carbs: 57.7,
      fat: 1.3,
    });
  });
});

describe("kcalFromMacros", () => {
  it("uses 4/4/9 kcal per gram", () => {
    expect(kcalFromMacros({ protein: 10, carbs: 20, fat: 5 })).toBe(165);
  });
});
