import { describe, expect, it } from "vitest";
import { normalizeBarcode, normalizeOpenFoodFactsProduct } from "./open-food-facts";

describe("normalizeOpenFoodFactsProduct", () => {
  it("maps nutriments per 100 g and the serving size", () => {
    expect(
      normalizeOpenFoodFactsProduct({
        code: "8000500310427",
        product_name: "Nutella Biscuits",
        product_name_it: "Biscotti Nutella",
        brands: "Ferrero, Nutella biscuits",
        serving_quantity: "13.8",
        nutriments: {
          "energy-kcal_100g": 515,
          proteins_100g: 7.9,
          carbohydrates_100g: 64,
          sugars_100g: 32.123,
          fat_100g: 24.8,
          "saturated-fat_100g": 11.5,
          salt_100g: 0.559,
        },
      }),
    ).toEqual({
      code: "8000500310427",
      name: "Biscotti Nutella",
      brand: "Ferrero",
      kcal: 515,
      protein: 7.9,
      carbs: 64,
      sugars: 32.1,
      fat: 24.8,
      saturatedFat: 11.5,
      fiber: null,
      salt: 0.6,
      servingGrams: 13.8,
    });
  });

  it("derives kcal from kJ and accepts brands as an array", () => {
    const candidate = normalizeOpenFoodFactsProduct({
      code: "18759587",
      product_name: "Nutella",
      brands: ["Nutella"],
      nutriments: { energy_100g: 2230 },
    });
    expect(candidate?.kcal).toBe(533);
    expect(candidate?.brand).toBe("Nutella");
  });

  it("skips products without a name or energy", () => {
    expect(normalizeOpenFoodFactsProduct({ code: "2000000120663", product_name: "nutella" })).toBeNull();
    expect(normalizeOpenFoodFactsProduct({ code: "2000000120663", nutriments: { "energy-kcal_100g": 10 } })).toBeNull();
  });
});

describe("normalizeBarcode", () => {
  it("keeps only plausible barcodes", () => {
    expect(normalizeBarcode(" 8000500 310427 ")).toBe("8000500310427");
    expect(normalizeBarcode("123")).toBeNull();
  });
});
