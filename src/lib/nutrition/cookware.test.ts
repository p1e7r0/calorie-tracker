import { describe, expect, it } from "vitest";
import { netCookedWeight, parseWeightGrams } from "./cookware";

describe("parseWeightGrams", () => {
  it("reads plain and decimal grams", () => {
    expect(parseWeightGrams("850")).toBe(850);
    expect(parseWeightGrams(" 850,5 ")).toBe(850.5);
    expect(parseWeightGrams("850.5")).toBe(850.5);
  });

  it("treats a dot followed by three digits as a thousands separator", () => {
    expect(parseWeightGrams("1.250")).toBe(1250);
    expect(parseWeightGrams("12.345,5")).toBe(12345.5);
    expect(parseWeightGrams("1 250")).toBe(1250);
  });

  it("rejects empty and invalid values", () => {
    expect(parseWeightGrams("")).toBeNull();
    expect(parseWeightGrams("abc")).toBeNull();
  });
});

describe("netCookedWeight", () => {
  it("removes the cookware weight and rounds to whole grams", () => {
    expect(netCookedWeight(2140, 1250)).toBe(890);
    expect(netCookedWeight(2140.6, 1250)).toBe(891);
  });

  it("returns null when the total does not exceed the cookware", () => {
    expect(netCookedWeight(1250, 1250)).toBeNull();
    expect(netCookedWeight(900, 1250)).toBeNull();
  });

  it("returns null when a value is missing", () => {
    expect(netCookedWeight(null, 1250)).toBeNull();
    expect(netCookedWeight(2140, null)).toBeNull();
  });
});
