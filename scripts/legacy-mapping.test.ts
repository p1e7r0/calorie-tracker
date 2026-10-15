import { describe, expect, it } from "vitest";
import { mapLegacyFood, mapLegacyMeasurement } from "./legacy-mapping";

describe("mapLegacyFood", () => {
  it("maps a dataset food to the global catalog and keeps micronutrients", () => {
    const mapped = mapLegacyFood(
      {
        _id: "61ed805d7207c3078d2ffd04",
        id: "644",
        name: "Acquavite di ciliegie (Kirsch)",
        category: "Bevande alcoliche/Spiritosi",
        unit: "ml",
        kcal: 233,
        fat_g: 0,
        protein_g: 0,
        carbohydrates_g: 0,
        alcohol_g: 33.3,
        potassium_k_mg: 2.9,
        sodium_na_mg: null,
        priority: 1,
      },
      "user-1",
    );
    expect(mapped.isFavorite).toBe(true);
    expect(mapped.values).toMatchObject({
      ownerId: null,
      source: "swiss",
      sourceReference: "644",
      unit: "ml",
      kcal: 233,
      micronutrients: { alcohol_g: 33.3, potassium_k_mg: 2.9 },
    });
  });

  it("maps a personal food with values stored as strings", () => {
    const mapped = mapLegacyFood(
      { _id: "62682c258a377ed0b2725bb2", name: " Cacao magro, Naturaplan ", kcal: "317", protein_g: "20,5", unit: "g100" },
      "user-1",
    );
    expect(mapped.values).toMatchObject({
      ownerId: "user-1",
      source: "user",
      sourceReference: "62682c258a377ed0b2725bb2",
      name: "Cacao magro, Naturaplan",
      unit: "g",
      kcal: 317,
      protein: 20.5,
      carbs: 0,
      micronutrients: null,
    });
  });
});

describe("mapLegacyMeasurement", () => {
  it("parses string values and uses the Rome calendar day", () => {
    expect(
      mapLegacyMeasurement(
        { weight: "89.9", fat_percentage: "29.2", muscle_percentage: "33.7", visceral_fat: "11", date: "2026-01-04T23:30:00.000Z" },
        "user-1",
      ),
    ).toEqual({
      userId: "user-1",
      measuredOn: "2026-01-05",
      weightKg: 89.9,
      bodyFatPercent: 29.2,
      musclePercent: 33.7,
      visceralFat: 11,
    });
  });

  it("skips measurements without a weight", () => {
    expect(mapLegacyMeasurement({ date: "2026-01-05" }, "user-1")).toBeNull();
  });
});
