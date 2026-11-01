"use client";

import { useState } from "react";
import type { AddEntryInput } from "@/app/actions/diary";
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
import { multiplyNutrients, type Nutrients, scaleNutrients } from "@/lib/nutrition/nutrients";
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
  const { isPending, log } = useLogEntry(onLogged, onUndone);
  return (
    <Drawer open onOpenChange={onOpenChange}>
      <DrawerContent>
        <ItemQuantity
          item={item}
          submitLabel={`Aggiungi a ${mealLabels[meal].toLowerCase()}`}
          isPending={isPending}
          onSubmit={(entryItem) => log({ day, meal, item: entryItem }, item.name)}
        />
      </DrawerContent>
    </Drawer>
  );
}

export type QuantityItem = AddEntryInput["item"];

type QuantityProperties = {
  submitLabel: string;
  isPending: boolean;
  onSubmit: (item: QuantityItem, nutrients: Nutrients) => void;
};

export function ItemQuantity({ item, ...properties }: QuantityProperties & { item: LoggableItem }) {
  return item.type === "food" ? (
    <FoodQuantity food={item} {...properties} />
  ) : (
    <RecipeQuantity recipe={item} {...properties} />
  );
}

function FoodQuantity({ food, submitLabel, isPending, onSubmit }: QuantityProperties & { food: LoggableFood }) {
  const defaultGrams = food.lastGrams ?? food.portions[0]?.grams ?? 100;
  const [quantity, setQuantity] = useState(() => toInputValue(defaultGrams));
  const [portionLabel, setPortionLabel] = useState<string | null>(null);
  const grams = parseDecimal(quantity);
  const preview = scaleNutrients(food.per100, grams ?? 0);
  const canLog = !isPending && grams !== null && grams > 0;

  function submit() {
    if (!canLog) return;
    onSubmit(
      {
        type: "food",
        foodId: food.id,
        grams,
        portionLabel: portionLabel ? `${portionLabel} (${formatGrams(grams)} ${food.unit})` : null,
      },
      preview,
    );
  }

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
      <form
        className="flex flex-col gap-4 overflow-y-auto p-4"
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
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
        <button type="submit" hidden />
      </form>
      <DrawerFooter className="pb-[max(1rem,env(safe-area-inset-bottom))]">
        <Button size="lg" disabled={!canLog} onClick={submit}>
          {submitLabel}
        </Button>
      </DrawerFooter>
    </>
  );
}

function RecipeQuantity({
  recipe,
  submitLabel,
  isPending,
  onSubmit,
}: QuantityProperties & { recipe: LoggableRecipe }) {
  const [mode, setMode] = useState<"servings" | "grams">(() => {
    if (recipe.lastServings) return "servings";
    if (recipe.lastGrams) return "grams";
    return recipe.servings > 1 || recipe.hasServingWeight || !recipe.hasCookedWeight ? "servings" : "grams";
  });
  const [quantity, setQuantity] = useState(() => {
    if (mode === "servings") return toInputValue(recipe.lastServings ?? 1);
    return toInputValue(recipe.lastGrams ?? Math.round(recipe.servingWeightG));
  });
  const amount = parseDecimal(quantity);
  const preview =
    mode === "servings"
      ? multiplyNutrients(recipe.perServing, amount ?? 0)
      : scaleNutrients(recipe.per100, amount ?? 0);
  const canLog = !isPending && amount !== null && amount > 0;

  function submit() {
    if (!canLog) return;
    onSubmit(
      {
        type: "recipe",
        recipeId: recipe.id,
        grams: mode === "grams" ? amount : null,
        servings: mode === "servings" ? amount : null,
      },
      preview,
    );
  }

  const shortcuts: QuantityShortcut[] =
    mode === "servings"
      ? [
          { label: "½", value: 0.5 },
          { label: "1", value: 1 },
          { label: "1½", value: 1.5 },
          { label: "2", value: 2 },
        ]
      : [gramsShortcut("1 porzione", Math.round(recipe.servingWeightG), "g")];

  return (
    <>
      <DrawerHeader>
        <DrawerTitle className="text-lg leading-snug">{recipe.name}</DrawerTitle>
        <DrawerDescription>
          {recipe.hasServingWeight
            ? `Porzione da ${formatGrams(recipe.servingWeightG)} g`
            : `Ricetta da ${recipe.servings} ${recipe.servings === 1 ? "porzione" : "porzioni"}`}
          {`, ${formatKcal(recipe.perServing.kcal)} kcal a porzione`}
        </DrawerDescription>
      </DrawerHeader>
      <form
        className="flex flex-col gap-4 overflow-y-auto p-4"
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        <ToggleGroup
          variant="outline"
          spacing={0}
          value={[mode]}
          onValueChange={(values) => {
            const [selected] = values;
            if (!selected || selected === mode) return;
            setMode(selected as "servings" | "grams");
            setQuantity(
              selected === "servings" ? "1" : toInputValue(Math.round(recipe.servingWeightG)),
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
        <button type="submit" hidden />
      </form>
      <DrawerFooter className="pb-[max(1rem,env(safe-area-inset-bottom))]">
        <Button size="lg" disabled={!canLog} onClick={submit}>
          {submitLabel}
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
