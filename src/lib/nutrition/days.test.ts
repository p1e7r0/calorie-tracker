import { describe, expect, it } from "vitest";
import { addDays, currentHour, formatDayLabel, isIsoDate, todayIsoDate } from "./days";
import { suggestMeal } from "./meals";
import { formatGrams, formatKcal, parseDecimal } from "./format";

describe("days", () => {
  it("uses the Rome calendar day around midnight", () => {
    expect(todayIsoDate(new Date("2026-10-15T22:30:00Z"))).toBe("2026-10-16");
    expect(currentHour(new Date("2026-10-15T22:30:00Z"))).toBe(0);
  });

  it("adds days across month boundaries", () => {
    expect(addDays("2026-10-31", 1)).toBe("2026-11-01");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
  });

  it("validates iso dates", () => {
    expect(isIsoDate("2026-02-30")).toBe(false);
    expect(isIsoDate("2026-02-28")).toBe(true);
    expect(isIsoDate("2024-05-20T19:33:53.000Z")).toBe(false);
  });

  it("labels nearby days in Italian", () => {
    expect(formatDayLabel("2026-10-15", "2026-10-15")).toBe("Oggi");
    expect(formatDayLabel("2026-10-14", "2026-10-15")).toBe("Ieri");
    expect(formatDayLabel("2026-10-12", "2026-10-15")).toBe("lun 12 ott");
  });
});

describe("suggestMeal", () => {
  it("maps the hour of the day to a meal", () => {
    expect(suggestMeal(7)).toBe("breakfast");
    expect(suggestMeal(13)).toBe("lunch");
    expect(suggestMeal(16)).toBe("snack");
    expect(suggestMeal(20)).toBe("dinner");
    expect(suggestMeal(1)).toBe("snack");
  });
});

describe("format", () => {
  it("formats numbers for Italian readers", () => {
    expect(formatKcal(1234.6)).toBe("1235");
    expect(formatKcal(12345)).toBe("12.345");
    expect(formatGrams(2.45)).toBe("2,5");
    expect(formatGrams(120.4)).toBe("120");
  });

  it("parses decimals typed with a comma", () => {
    expect(parseDecimal("12,5")).toBe(12.5);
    expect(parseDecimal(" ")).toBeNull();
    expect(parseDecimal("abc")).toBeNull();
  });
});
