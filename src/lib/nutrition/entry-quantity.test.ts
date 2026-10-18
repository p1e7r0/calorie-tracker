import { describe, expect, it } from "vitest";
import { describeEntryQuantity } from "./entry-quantity";

const base = { grams: null, servings: null, portionLabel: null, unit: "g" as const };

describe("describeEntryQuantity", () => {
  it("hides the quantity of quick kcal", () => {
    expect(describeEntryQuantity({ ...base, kind: "quick", grams: 100 })).toBeNull();
  });

  it("prefers the portion label", () => {
    expect(describeEntryQuantity({ ...base, kind: "food", grams: 125, portionLabel: "1 vasetto" })).toBe("1 vasetto");
  });

  it("shows grams with Italian decimals", () => {
    expect(describeEntryQuantity({ ...base, kind: "food", grams: 120 })).toBe("120 g");
    expect(describeEntryQuantity({ ...base, kind: "food", grams: 7.5 })).toBe("7,5 g");
  });

  it("shows millilitres for liquid foods", () => {
    expect(describeEntryQuantity({ ...base, kind: "food", grams: 250, unit: "ml" })).toBe("250 ml");
  });

  it("shows recipe servings", () => {
    expect(describeEntryQuantity({ ...base, kind: "recipe", servings: 1 })).toBe("1 porzione");
    expect(describeEntryQuantity({ ...base, kind: "recipe", servings: 1.5 })).toBe("1,5 porzioni");
  });
});
