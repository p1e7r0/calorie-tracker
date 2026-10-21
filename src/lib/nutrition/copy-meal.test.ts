import { describe, expect, it } from "vitest";
import { copiedEntriesLabel, defaultCopySourceDay, entryCountLabel, isCopyOntoItself } from "./copy-meal";

describe("entryCountLabel", () => {
  it("uses the singular for one entry", () => {
    expect(entryCountLabel(1)).toBe("1 voce");
  });

  it("uses the plural otherwise", () => {
    expect(entryCountLabel(0)).toBe("0 voci");
    expect(entryCountLabel(4)).toBe("4 voci");
  });
});

describe("copiedEntriesLabel", () => {
  it("agrees with the number of entries", () => {
    expect(copiedEntriesLabel(1)).toBe("1 voce copiata");
    expect(copiedEntriesLabel(3)).toBe("3 voci copiate");
  });
});

describe("defaultCopySourceDay", () => {
  it("starts from the day before the viewed day", () => {
    expect(defaultCopySourceDay("2026-10-18", "2026-10-18")).toBe("2026-10-17");
    expect(defaultCopySourceDay("2026-03-01", "2026-10-18")).toBe("2026-02-28");
  });

  it("never proposes a future day", () => {
    expect(defaultCopySourceDay("2026-10-25", "2026-10-18")).toBe("2026-10-18");
  });
});

describe("isCopyOntoItself", () => {
  it("detects the same meal of the same day", () => {
    expect(isCopyOntoItself({ fromDay: "2026-10-18", fromMeal: "lunch", toDay: "2026-10-18", toMeal: "lunch" })).toBe(
      true,
    );
  });

  it("allows another day or another meal", () => {
    expect(isCopyOntoItself({ fromDay: "2026-10-17", fromMeal: "lunch", toDay: "2026-10-18", toMeal: "lunch" })).toBe(
      false,
    );
    expect(isCopyOntoItself({ fromDay: "2026-10-18", fromMeal: "lunch", toDay: "2026-10-18", toMeal: "dinner" })).toBe(
      false,
    );
  });
});
