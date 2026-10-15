export type Nutrients = {
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
};

export const emptyNutrients: Nutrients = { kcal: 0, protein: 0, carbs: 0, fat: 0 };

export function scaleNutrients(per100: Nutrients, quantity: number): Nutrients {
  const factor = quantity / 100;
  return {
    kcal: per100.kcal * factor,
    protein: per100.protein * factor,
    carbs: per100.carbs * factor,
    fat: per100.fat * factor,
  };
}

export function multiplyNutrients(nutrients: Nutrients, factor: number): Nutrients {
  return {
    kcal: nutrients.kcal * factor,
    protein: nutrients.protein * factor,
    carbs: nutrients.carbs * factor,
    fat: nutrients.fat * factor,
  };
}

export function sumNutrients(items: readonly Nutrients[]): Nutrients {
  return items.reduce(
    (total, item) => ({
      kcal: total.kcal + item.kcal,
      protein: total.protein + item.protein,
      carbs: total.carbs + item.carbs,
      fat: total.fat + item.fat,
    }),
    emptyNutrients,
  );
}

export function roundNutrients(nutrients: Nutrients): Nutrients {
  return {
    kcal: Math.round(nutrients.kcal),
    protein: Math.round(nutrients.protein * 10) / 10,
    carbs: Math.round(nutrients.carbs * 10) / 10,
    fat: Math.round(nutrients.fat * 10) / 10,
  };
}

export function kcalFromMacros({ protein, carbs, fat }: Omit<Nutrients, "kcal">) {
  return protein * 4 + carbs * 4 + fat * 9;
}
