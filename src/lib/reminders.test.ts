import { describe, expect, it } from "vitest";
import { eveningReminder, isoWeekday, weeklySummaryReminder, weighInReminder } from "./reminders";

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

describe("weeklySummaryReminder", () => {
  const summary = { weekStart: "2026-10-05", loggedDays: 6, averageKcal: 1920.4, averageProteinG: 82.3 };

  it("sums up the week and points to the check-in", () => {
    expect(weeklySummaryReminder({ summary, maintenanceKcal: 2380, isWeighInDay: false })).toEqual({
      title: "La tua settimana",
      body: "Media 1920 kcal e 82 g di proteine in 6 giorni. Fabbisogno stimato 2380 kcal: guarda se aggiornare l'obiettivo.",
      url: "/",
    });
  });

  it("mentions the weigh-in instead of sending a second notification", () => {
    expect(weeklySummaryReminder({ summary, maintenanceKcal: null, isWeighInDay: true })).toMatchObject({
      body: "Media 1920 kcal e 82 g di proteine in 6 giorni. Oggi è anche il giorno della pesata.",
      url: "/progress",
    });
  });

  it("stays quiet after an empty week", () => {
    expect(weeklySummaryReminder({ summary: null, maintenanceKcal: 2380, isWeighInDay: false })).toBeNull();
  });
});
