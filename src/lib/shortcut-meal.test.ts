import { describe, expect, it } from "vitest";
import { describeShortcutLog, describeShortcutUndo, resolveFoodChoices } from "./shortcut-meal";

const foods = [
  { description: "pasta al pomodoro", query: "pasta di semola cotta", grams: 200, estimatedKcal: 300 },
  { description: "una mela", query: "mela cruda", grams: 150, estimatedKcal: 78 },
  { description: "torta della nonna", query: "torta della nonna", grams: 100, estimatedKcal: 380 },
];

const candidates = [
  { ref: "F1", foodId: "pasta-cruda", item: 1 },
  { ref: "F2", foodId: "pasta-cotta", item: 1 },
  { ref: "F3", foodId: "mela", item: 2 },
];

describe("resolveFoodChoices", () => {
  it("maps chosen references to foods and keeps quick estimates", () => {
    const items = resolveFoodChoices(foods, candidates, [
      { item: 1, food: "F2", grams: 220.4, portionLabel: null, quick: null },
      { item: 2, food: "F3", grams: 150, portionLabel: " 1 mela ", quick: null },
      { item: 3, food: null, grams: 100, portionLabel: null, quick: { label: "torta della nonna", kcal: 410.6, protein: 6.04, carbs: 52, fat: 19 } },
    ]);
    expect(items).toEqual([
      { type: "food", foodId: "pasta-cotta", grams: 220, portionLabel: null },
      { type: "food", foodId: "mela", grams: 150, portionLabel: "1 mela" },
      { type: "quick", label: "Torta della nonna", kcal: 411, protein: 6, carbs: 52, fat: 19 },
    ]);
  });

  it("rejects references that belong to another item and falls back to the first estimate", () => {
    const items = resolveFoodChoices(foods.slice(0, 2), candidates, [
      { item: 1, food: "F3", grams: 200, portionLabel: null, quick: null },
    ]);
    expect(items).toEqual([
      { type: "quick", label: "Pasta al pomodoro", kcal: 300, protein: 0, carbs: 0, fat: 0 },
      { type: "quick", label: "Una mela", kcal: 78, protein: 0, carbs: 0, fat: 0 },
    ]);
  });

  it("keeps the first quantity when the chosen grams are impossible", () => {
    const [item] = resolveFoodChoices(foods.slice(0, 1), candidates, [
      { item: 1, food: "F1", grams: 0, portionLabel: null, quick: null },
    ]);
    expect(item).toEqual({ type: "food", foodId: "pasta-cruda", grams: 200, portionLabel: null });
  });
});

describe("describeShortcutLog", () => {
  const entries = [
    { label: "Pasta di semola, cotta", grams: 200, servings: null, kcal: 262 },
    { label: "Lasagne", grams: null, servings: 1.5, kcal: 620 },
  ];

  it("summarizes today's meal with the kcal left", () => {
    expect(
      describeShortcutLog({ day: "2026-10-20", today: "2026-10-20", meal: "lunch", entries, remainingKcal: 640 }),
    ).toBe("Ho registrato a pranzo: Pasta di semola, cotta, 200 g; Lasagne, 1,5 porzioni. Totale 882 kcal. Ti restano 640 kcal.");
  });

  it("names past days and the excess over the goal", () => {
    expect(
      describeShortcutLog({ day: "2026-10-19", today: "2026-10-20", meal: "dinner", entries, remainingKcal: -50 }),
    ).toBe("Ho registrato ieri a cena: Pasta di semola, cotta, 200 g; Lasagne, 1,5 porzioni. Totale 882 kcal.");
    expect(
      describeShortcutLog({ day: "2026-10-20", today: "2026-10-20", meal: "snack", entries: entries.slice(0, 1), remainingKcal: -50 }),
    ).toBe("Ho registrato tra gli spuntini: Pasta di semola, cotta, 200 g. Totale 262 kcal. Hai superato l'obiettivo di 50 kcal.");
    expect(
      describeShortcutLog({ day: "2026-10-15", today: "2026-10-20", meal: "breakfast", entries: entries.slice(1), remainingKcal: null }),
    ).toBe("Ho registrato giovedì 15 ottobre a colazione: Lasagne, 1,5 porzioni. Totale 620 kcal.");
  });
});

describe("describeShortcutUndo", () => {
  it("lists the removed entries", () => {
    expect(describeShortcutUndo([])).toBe("Non c'è niente da annullare.");
    expect(describeShortcutUndo(["Mela, cruda", "Caffè"])).toBe("Ho eliminato: Mela, cruda; Caffè.");
  });
});
