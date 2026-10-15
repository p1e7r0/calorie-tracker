"use client";

import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { mealLabels, mealTypes, type MealType } from "@/lib/nutrition/meals";

export function MealPicker({
  value,
  onValueChange,
  className,
}: {
  value: MealType;
  onValueChange: (meal: MealType) => void;
  className?: string;
}) {
  return (
    <ToggleGroup
      variant="outline"
      spacing={0}
      value={[value]}
      onValueChange={(values) => {
        const [selected] = values;
        if (selected) onValueChange(selected as MealType);
      }}
      aria-label="Pasto"
      className={className}
    >
      {mealTypes.map((meal) => (
        <ToggleGroupItem key={meal} value={meal} className="flex-1 px-1 text-[0.8rem]">
          {mealLabels[meal]}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}
