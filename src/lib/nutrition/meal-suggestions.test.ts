import { describe, expect, it } from "vitest";
import { rankMealSuggestions, type PastUse } from "./meal-suggestions";

const today = "2026-10-17";

describe("rankMealSuggestions", () => {
  it("puts what is usually eaten in that meal first", () => {
    const uses: PastUse[] = [
      { itemKey: "food:pasta", day: "2026-10-16", meal: "dinner" },
      { itemKey: "food:pasta", day: "2026-10-15", meal: "dinner" },
      { itemKey: "food:yogurt", day: "2026-10-14", meal: "breakfast" },
      { itemKey: "food:yogurt", day: "2026-10-13", meal: "breakfast" },
    ];
    const ranked = rankMealSuggestions(uses, today);
    expect(ranked.breakfast).toEqual(["food:yogurt", "food:pasta"]);
    expect(ranked.dinner).toEqual(["food:pasta", "food:yogurt"]);
  });

  it("prefers frequent and recent uses over a single old one", () => {
    const uses: PastUse[] = [
      { itemKey: "food:old", day: "2026-08-25", meal: "lunch" },
      { itemKey: "food:old", day: "2026-08-26", meal: "lunch" },
      { itemKey: "food:recent", day: "2026-10-16", meal: "lunch" },
    ];
    expect(rankMealSuggestions(uses, today).lunch).toEqual(["food:recent", "food:old"]);
  });

  it("ignores uses outside the window and in the future", () => {
    const uses: PastUse[] = [
      { itemKey: "food:ancient", day: "2026-07-01", meal: "snack" },
      { itemKey: "food:future", day: "2026-10-20", meal: "snack" },
      { itemKey: "recipe:soup", day: "2026-10-17", meal: "snack" },
    ];
    expect(rankMealSuggestions(uses, today).snack).toEqual(["recipe:soup"]);
  });

  it("keeps a stable order on ties and limits the list", () => {
    const uses: PastUse[] = [
      { itemKey: "food:a", day: "2026-10-10", meal: "lunch" },
      { itemKey: "food:b", day: "2026-10-10", meal: "lunch" },
      { itemKey: "food:c", day: "2026-10-10", meal: "lunch" },
    ];
    expect(rankMealSuggestions(uses, today, 2).lunch).toEqual(["food:a", "food:b"]);
  });
});
