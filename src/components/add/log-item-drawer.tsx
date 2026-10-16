"use client";

import { useState } from "react";
import { MacroLine } from "@/components/diary/macro-line";
import { gramsShortcut, QuantityField, type QuantityShortcut } from "@/components/diary/quantity-field";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { formatDecimal, formatGrams, formatKcal, parseDecimal } from "@/lib/nutrition/format";
import { mealLabels, type MealType } from "@/lib/nutrition/meals";
import { multiplyNutrients, scaleNutrients } from "@/lib/nutrition/nutrients";
import type { LoggableFood, LoggableItem, LoggableRecipe } from "@/server/loggable";
import { useLogEntry } from "./use-log-entry";

function toInputValue(value: number) {
  return formatDecimal(value).replace(/\./g, "");
}

export function LogItemDrawer({
  item,
  day,
  meal,
  onOpenChange,
  onLogged,
  onUndone,
}: {
  item: LoggableItem;
  day: string;
  meal: MealType;
  onOpenChange: (open: boolean) => void;
  onLogged: () => void;
  onUndone?: () => void;
}) {
  return (
    <Drawer open onOpenChange={onOpenChange}>
      <DrawerContent>
        {item.type === "food" ? (
          <FoodQuantity food={item} day={day} meal={meal} onLogged={onLogged} onUndone={onUndone} />
        ) : (
          <RecipeQuantity recipe={item} day={day} meal={meal} onLogged={onLogged} onUndone={onUndone} />
        )}
      </DrawerContent>
    </Drawer>
  );
}

function FoodQuantity({
  food,
  day,
  meal,
  onLogged,
  onUndone,
}: {
  food: LoggableFood;
  day: string;
  meal: MealType;
  onLogged: () => void;
  onUndone?: () => void;
}) {
  const defaultGrams = food.lastGrams ?? food.portions[0]?.grams ?? 100;
  const [quantity, setQuantity] = useState(() => toInputValue(defaultGrams));
  const [portionLabel, setPortionLabel] = useState<string | null>(null);
  const { isPending, log } = useLogEntry(onLogged, onUndone);
  const grams = parseDecimal(quantity);
  const preview = scaleNutrients(food.per100, grams ?? 0);

  const shortcuts: QuantityShortcut[] = [
    ...(food.lastGrams ? [gramsShortcut("Ultima volta", food.lastGrams, food.unit)] : []),
    ...food.portions.map((portion) => gramsShortcut(portion.label, portion.grams, food.unit, true)),
  ];
  if (defaultGrams !== 100 && !shortcuts.some((shortcut) => shortcut.value === 100)) {
    shortcuts.push({ label: `100 ${food.unit}`, value: 100 });
  }

  return (
    <>
      <DrawerHeader>
        <DrawerTitle className="text-lg leading-snug">{food.name}</DrawerTitle>
        <DrawerDescription>
          {food.brand ? `${food.brand}. ` : ""}
          {formatKcal(food.per100.kcal)} kcal per 100 {food.unit}
        </DrawerDescription>
      </DrawerHeader>
      <div className="flex flex-col gap-4 overflow-y-auto p-4">
        <QuantityField
          label="Quantità"
          unit={food.unit}
          value={quantity}
          autoFocus
          step={10}
          shortcuts={shortcuts}
          onValueChange={(value, shortcut) => {
            setQuantity(value);
            setPortionLabel(shortcut?.isPortion ? shortcut.label : null);
          }}
        />
        <Preview kcal={preview.kcal}>
          <MacroLine nutrients={preview} />
        </Preview>
      </div>
      <DrawerFooter className="pb-[max(1rem,env(safe-area-inset-bottom))]">
        <Button
          size="lg"
          disabled={isPending || !grams || grams <= 0}
          onClick={() =>
            log(
              {
                day,
                meal,
                item: {
                  type: "food",
                  foodId: food.id,
                  grams: grams ?? 0,
                  portionLabel: portionLabel ? `${portionLabel} (${formatGrams(grams ?? 0)} ${food.unit})` : null,
                },
              },
              food.name,
            )
          }
        >
          Aggiungi a {mealLabels[meal].toLowerCase()}
        </Button>
      </DrawerFooter>
    </>
  );
}

function RecipeQuantity({
  recipe,
  day,
  meal,
  onLogged,
  onUndone,
}: {
  recipe: LoggableRecipe;
  day: string;
  meal: MealType;
  onLogged: () => void;
  onUndone?: () => void;
}) {
  const [mode, setMode] = useState<"servings" | "grams">(recipe.servings > 1 || !recipe.hasCookedWeight ? "servings" : "grams");
  const [quantity, setQuantity] = useState(() =>
    mode === "servings" ? "1" : toInputValue(Math.round(recipe.finalWeightG / recipe.servings)),
  );
  const { isPending, log } = useLogEntry(onLogged, onUndone);
  const amount = parseDecimal(quantity);
  const preview =
    mode === "servings"
      ? multiplyNutrients(recipe.perServing, amount ?? 0)
      : scaleNutrients(recipe.per100, amount ?? 0);

  const shortcuts: QuantityShortcut[] =
    mode === "servings"
      ? [
          { label: "½", value: 0.5 },
          { label: "1", value: 1 },
          { label: "1½", value: 1.5 },
          { label: "2", value: 2 },
        ]
      : [gramsShortcut("1 porzione", Math.round(recipe.finalWeightG / recipe.servings), "g")];

  return (
    <>
      <DrawerHeader>
        <DrawerTitle className="text-lg leading-snug">{recipe.name}</DrawerTitle>
        <DrawerDescription>
          Ricetta da {recipe.servings} {recipe.servings === 1 ? "porzione" : "porzioni"},{" "}
          {formatKcal(recipe.perServing.kcal)} kcal a porzione
        </DrawerDescription>
      </DrawerHeader>
      <div className="flex flex-col gap-4 overflow-y-auto p-4">
        <ToggleGroup
          variant="outline"
          spacing={0}
          value={[mode]}
          onValueChange={(values) => {
            const [selected] = values;
            if (!selected || selected === mode) return;
            setMode(selected as "servings" | "grams");
            setQuantity(
              selected === "servings" ? "1" : toInputValue(Math.round(recipe.finalWeightG / recipe.servings)),
            );
          }}
          className="w-full"
          aria-label="Unità"
        >
          <ToggleGroupItem value="servings" className="flex-1">
            Porzioni
          </ToggleGroupItem>
          <ToggleGroupItem value="grams" className="flex-1">
            {recipe.hasCookedWeight ? "Grammi da cotto" : "Grammi"}
          </ToggleGroupItem>
        </ToggleGroup>
        <QuantityField
          label={mode === "servings" ? "Porzioni" : "Quantità"}
          unit={mode === "servings" ? "porz." : "g"}
          value={quantity}
          autoFocus
          shortcuts={shortcuts}
          onValueChange={(value) => setQuantity(value)}
        />
        <Preview kcal={preview.kcal}>
          <MacroLine nutrients={preview} />
        </Preview>
      </div>
      <DrawerFooter className="pb-[max(1rem,env(safe-area-inset-bottom))]">
        <Button
          size="lg"
          disabled={isPending || !amount || amount <= 0}
          onClick={() =>
            log(
              {
                day,
                meal,
                item: {
                  type: "recipe",
                  recipeId: recipe.id,
                  grams: mode === "grams" ? amount : null,
                  servings: mode === "servings" ? amount : null,
                },
              },
              recipe.name,
            )
          }
        >
          Aggiungi a {mealLabels[meal].toLowerCase()}
        </Button>
      </DrawerFooter>
    </>
  );
}

function Preview({ kcal, children }: { kcal: number; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between rounded-xl bg-muted/60 px-3 py-2.5">
      {children}
      <span className="font-heading text-xl font-semibold">
        {formatKcal(kcal)} <span className="text-sm font-medium text-muted-foreground">kcal</span>
      </span>
    </div>
  );
}
