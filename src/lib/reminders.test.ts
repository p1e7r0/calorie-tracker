import { describe, expect, it } from "vitest";
import { eveningReminder, isoWeekday, weighInReminder } from "./reminders";

describe("eveningReminder", () => {
  it("nudges when nothing was logged", () => {
    expect(eveningReminder([])?.title).toBe("Oggi non hai registrato niente");
  });

  it("asks for dinner when it is missing", () => {
    expect(eveningReminder(["breakfast", "lunch"])).toMatchObject({ title: "Manca la cena", url: "/add?meal=dinner" });
  });

  it("stays quiet when dinner is logged", () => {
    expect(eveningReminder(["breakfast", "dinner"])).toBeNull();
  });
});

describe("weighInReminder", () => {
  it("uses ISO weekdays, Monday is 1 and Sunday is 7", () => {
    expect(isoWeekday("2026-10-12")).toBe(1);
    expect(isoWeekday("2026-10-18")).toBe(7);
  });

  it("fires only on the chosen weekday", () => {
    expect(weighInReminder(5, "2026-10-16")?.url).toBe("/progress");
    expect(weighInReminder(1, "2026-10-16")).toBeNull();
    expect(weighInReminder(null, "2026-10-16")).toBeNull();
  });
});
