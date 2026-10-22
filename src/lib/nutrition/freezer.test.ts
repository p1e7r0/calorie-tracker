import { describe, expect, it } from "vitest";
import { countPortionsByBatch, describeFrozenAge, describePortion, describePortionsLeft } from "./freezer";

describe("describeFrozenAge", () => {
  it("uses days, weeks or months depending on the span", () => {
    expect(describeFrozenAge("2026-10-22", "2026-10-22")).toBe("congelato oggi");
    expect(describeFrozenAge("2026-10-21", "2026-10-22")).toBe("congelato ieri");
    expect(describeFrozenAge("2026-10-12", "2026-10-22")).toBe("congelato 10 giorni fa");
    expect(describeFrozenAge("2026-09-22", "2026-10-22")).toBe("congelato 4 settimane fa");
    expect(describeFrozenAge("2026-08-10", "2026-10-22")).toBe("congelato 2 mesi fa");
    expect(describeFrozenAge("2025-10-22", "2026-10-22")).toBe("congelato 12 mesi fa");
  });

  it("treats a date in the future as today", () => {
    expect(describeFrozenAge("2026-10-25", "2026-10-22")).toBe("congelato oggi");
  });
});

describe("describePortionsLeft", () => {
  it("shows the total while the batch is untouched", () => {
    expect(describePortionsLeft(6, 6)).toBe("6 porzioni");
    expect(describePortionsLeft(1, 1)).toBe("1 porzione");
  });

  it("shows what is left once portions are eaten", () => {
    expect(describePortionsLeft(3, 6)).toBe("ne restano 3 di 6");
    expect(describePortionsLeft(1, 6)).toBe("ne resta 1 di 6");
  });
});

describe("countPortionsByBatch", () => {
  it("counts one portion per entry and skips entries outside the freezer", () => {
    const counts = countPortionsByBatch([
      { freezerBatchId: "a" },
      { freezerBatchId: null },
      { freezerBatchId: "a" },
      { freezerBatchId: "b" },
    ]);
    expect(Object.fromEntries(counts)).toEqual({ a: 2, b: 1 });
  });
});

describe("describePortion", () => {
  it("shows grams, millilitres or recipe servings", () => {
    expect(describePortion({ grams: 250, servings: null, unit: "g" })).toBe("250 g");
    expect(describePortion({ grams: 300, servings: null, unit: "ml" })).toBe("300 ml");
    expect(describePortion({ grams: null, servings: 1, unit: "g" })).toBe("1 porzione della ricetta");
    expect(describePortion({ grams: null, servings: 1.5, unit: "g" })).toBe("1,5 porzioni della ricetta");
  });
});
