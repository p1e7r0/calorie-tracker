import { describe, expect, it } from "vitest";
import {
  describePortions,
  describeStoredMealAge,
  isStorageLocation,
  isStoredMealOld,
  sortStoredMeals,
  storedMealAgeDays,
} from "./stored-meals";

describe("storedMealAgeDays", () => {
  it("counts whole days and never goes below zero", () => {
    expect(storedMealAgeDays("2026-10-20", "2026-10-22")).toBe(2);
    expect(storedMealAgeDays("2026-10-22", "2026-10-22")).toBe(0);
    expect(storedMealAgeDays("2026-10-23", "2026-10-22")).toBe(0);
  });
});

describe("isStoredMealOld", () => {
  it("flags the fridge after three days", () => {
    expect(isStoredMealOld("fridge", "2026-10-19", "2026-10-22")).toBe(false);
    expect(isStoredMealOld("fridge", "2026-10-18", "2026-10-22")).toBe(true);
  });

  it("flags the freezer after ninety days", () => {
    expect(isStoredMealOld("freezer", "2026-07-24", "2026-10-22")).toBe(false);
    expect(isStoredMealOld("freezer", "2026-07-23", "2026-10-22")).toBe(true);
  });
});

describe("describeStoredMealAge", () => {
  it("uses days for recent meals and months after sixty days", () => {
    expect(describeStoredMealAge("2026-10-22", "2026-10-22")).toBe("preparato oggi");
    expect(describeStoredMealAge("2026-10-21", "2026-10-22")).toBe("preparato ieri");
    expect(describeStoredMealAge("2026-10-17", "2026-10-22")).toBe("preparato 5 giorni fa");
    expect(describeStoredMealAge("2026-08-24", "2026-10-22")).toBe("preparato 59 giorni fa");
    expect(describeStoredMealAge("2026-07-01", "2026-10-22")).toBe("preparato 3 mesi fa");
  });
});

describe("describePortions", () => {
  it("uses the singular for one portion", () => {
    expect(describePortions(1)).toBe("1 porzione");
    expect(describePortions(3)).toBe("3 porzioni");
  });
});

describe("isStorageLocation", () => {
  it("accepts only fridge and freezer", () => {
    expect(isStorageLocation("fridge")).toBe(true);
    expect(isStorageLocation("freezer")).toBe(true);
    expect(isStorageLocation("pantry")).toBe(false);
    expect(isStorageLocation(undefined)).toBe(false);
  });
});

describe("sortStoredMeals", () => {
  it("puts old meals first, then the fridge, then the oldest preparation", () => {
    const meals = [
      { name: "Ragù", location: "freezer" as const, preparedOn: "2026-10-01" },
      { name: "Minestrone", location: "fridge" as const, preparedOn: "2026-10-21" },
      { name: "Lasagna", location: "fridge" as const, preparedOn: "2026-10-15" },
      { name: "Polpette", location: "fridge" as const, preparedOn: "2026-10-20" },
      { name: "Brodo", location: "freezer" as const, preparedOn: "2026-10-01" },
    ];
    expect(sortStoredMeals(meals, "2026-10-22").map((meal) => meal.name)).toEqual([
      "Lasagna",
      "Polpette",
      "Minestrone",
      "Brodo",
      "Ragù",
    ]);
  });
});
