import { describe, expect, it } from "vitest";
import { isMassShareMetric, massFromPercent } from "./body-metrics";

describe("isMassShareMetric", () => {
  it("accepts only the metrics that are a share of body weight", () => {
    expect(isMassShareMetric("bodyFatPercent")).toBe(true);
    expect(isMassShareMetric("musclePercent")).toBe(true);
    expect(isMassShareMetric("bodyWaterPercent")).toBe(false);
    expect(isMassShareMetric("weightKg")).toBe(false);
    expect(isMassShareMetric("boneMassKg")).toBe(false);
  });
});

describe("massFromPercent", () => {
  it("converts a percentage of body weight to kilograms", () => {
    expect(massFromPercent(80, 25)).toBe(20);
    expect(massFromPercent(81.1, 25.4)).toBe(20.6);
    expect(massFromPercent(82.4, 26)).toBe(21.42);
  });

  it("keeps two decimals so the moving average is not quantized", () => {
    expect(massFromPercent(70.3, 41.7)).toBe(29.32);
  });
});
