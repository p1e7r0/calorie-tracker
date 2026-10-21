import { describe, expect, it } from "vitest";
import { foodValueIssues, kcalMismatch } from "./food-checks";

const yogurt = { unit: "g" as const, kcal: 97, protein: 9, carbs: 4, fat: 5, sugars: 4, saturatedFat: 3.2 };

describe("foodValueIssues", () => {
  it("accepts coherent values", () => {
    expect(foodValueIssues(yogurt)).toEqual([]);
  });

  it("accepts pure fat and small rounding errors", () => {
    expect(foodValueIssues({ unit: "g", kcal: 899, protein: 0, carbs: 0, fat: 100 })).toEqual([]);
    expect(foodValueIssues({ unit: "g", kcal: 740, protein: 0.6, carbs: 0.6, fat: 99.5 })).toEqual([]);
    expect(foodValueIssues({ ...yogurt, carbs: 0.5, sugars: 0.5 })).toEqual([]);
  });

  it("rejects macros above 100 g per 100 g", () => {
    expect(foodValueIssues({ unit: "g", kcal: 500, protein: 40, carbs: 50, fat: 20 })).toMatchObject([
      { path: "protein" },
    ]);
  });

  it("allows macros above 100 g per 100 ml, since liquids can be denser than water", () => {
    expect(foodValueIssues({ unit: "ml", kcal: 430, protein: 0.4, carbs: 100, fat: 6 })).toEqual([]);
  });

  it("rejects sugars above carbs and saturated fat above fat", () => {
    expect(foodValueIssues({ ...yogurt, sugars: 6 }).map((issue) => issue.path)).toEqual(["sugars"]);
    expect(foodValueIssues({ ...yogurt, saturatedFat: 6 }).map((issue) => issue.path)).toEqual(["saturatedFat"]);
  });
});

describe("kcalMismatch", () => {
  it("accepts energy close to 4/4/9 kcal per gram", () => {
    expect(kcalMismatch(yogurt)).toBeNull();
    expect(kcalMismatch({ unit: "g", kcal: 0, protein: 0, carbs: 0, fat: 0 })).toBeNull();
  });

  it("counts fiber at 2 kcal per gram", () => {
    expect(kcalMismatch({ unit: "g", kcal: 340, protein: 12, carbs: 60, fat: 2, fiber: 10 })).toBeNull();
  });

  it("reports energy far from the macros", () => {
    expect(kcalMismatch({ unit: "g", kcal: 150, protein: 9, carbs: 4, fat: 5 })).toEqual({ expectedKcal: 97 });
    expect(kcalMismatch({ unit: "ml", kcal: 70, protein: 0.1, carbs: 0.6, fat: 0 })).toEqual({ expectedKcal: 3 });
  });
});
