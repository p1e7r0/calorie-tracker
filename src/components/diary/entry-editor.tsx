"use client";

import { CopyPlusIcon, Trash2Icon } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { updateDiaryEntry } from "@/app/actions/diary";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { formatDecimal, formatGrams, formatKcal, parseDecimal } from "@/lib/nutrition/format";
import { mealLabels, type MealType } from "@/lib/nutrition/meals";
import { multiplyNutrients } from "@/lib/nutrition/nutrients";
import type { DiaryEntryView } from "@/server/diary";
import { MacroLine } from "./macro-line";
import { MealPicker } from "./meal-picker";
import { gramsShortcut, QuantityField, type QuantityShortcut } from "./quantity-field";
import { useEntryActions } from "./use-entry-actions";

type QuantityMode = "grams" | "servings" | "kcal";

function initialMode(entry: DiaryEntryView): QuantityMode {
  if (entry.kind === "quick") return "kcal";
  if (entry.kind === "recipe" && !entry.grams) return "servings";
  return "grams";
}

function initialQuantity(entry: DiaryEntryView, mode: QuantityMode) {
  const value = mode === "kcal" ? entry.nutrients.kcal : mode === "servings" ? entry.servings : entry.grams;
  return value ? formatDecimal(value).replace(/\./g, "") : "";
}

const servingShortcuts: QuantityShortcut[] = [
  { label: "½", value: 0.5 },
  { label: "1", value: 1 },
  { label: "1½", value: 1.5 },
  { label: "2", value: 2 },
];

function quantityShortcuts(entry: DiaryEntryView, mode: QuantityMode): QuantityShortcut[] {
  if (mode === "servings") return servingShortcuts;
  if (mode !== "grams" || entry.kind !== "food") return [];
  const shortcuts = entry.portions.map((portion) => gramsShortcut(portion.label, portion.grams, entry.unit, true));
  if (entry.grams !== 100 && !shortcuts.some((shortcut) => shortcut.value === 100)) {
    shortcuts.push({ label: `100 ${entry.unit}`, value: 100 });
  }
  return shortcuts;
}

export function EntryEditor({
  entry,
  open,
  onOpenChange,
}: {
  entry: DiaryEntryView;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const mode = initialMode(entry);
  const [meal, setMeal] = useState<MealType>(entry.meal);
  const [quantity, setQuantity] = useState(() => initialQuantity(entry, mode));
  const [portionLabel, setPortionLabel] = useState(entry.portionLabel);
  const [isSaving, startTransition] = useTransition();
  const entryActions = useEntryActions();
  const isPending = isSaving || entryActions.isPending;
  const parsedQuantity = parseDecimal(quantity);
  const previousQuantity = mode === "kcal" ? entry.nutrients.kcal : mode === "servings" ? entry.servings : entry.grams;
  const preview =
    parsedQuantity !== null && previousQuantity
      ? multiplyNutrients(entry.nutrients, parsedQuantity / previousQuantity)
      : entry.nutrients;
  const isValid = parsedQuantity !== null && (mode === "kcal" ? parsedQuantity >= 0 : parsedQuantity > 0);

  function save() {
    if (isPending || !isValid) return;
    startTransition(async () => {
      const result = await updateDiaryEntry({
        id: entry.id,
        meal,
        grams: mode === "grams" ? parsedQuantity : null,
        servings: mode === "servings" ? parsedQuantity : null,
        kcal: mode === "kcal" ? parsedQuantity : null,
        ...(entry.kind === "food" ? { portionLabel } : {}),
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      onOpenChange(false);
    });
  }

  function remove() {
    entryActions.removeEntry(entry, () => onOpenChange(false));
  }

  function duplicate() {
    entryActions.duplicateEntry(entry, () => onOpenChange(false));
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle className="text-lg leading-snug">{entry.label}</DrawerTitle>
          <DrawerDescription>
            {formatKcal(preview.kcal)} kcal in {mealLabels[meal].toLowerCase()}
          </DrawerDescription>
        </DrawerHeader>
        <form
          className="flex flex-col gap-4 overflow-y-auto p-4"
          onSubmit={(event) => {
            event.preventDefault();
            save();
          }}
        >
          <QuantityField
            label={mode === "kcal" ? "Kcal" : mode === "servings" ? "Porzioni" : "Quantità"}
            unit={mode === "kcal" ? "kcal" : mode === "servings" ? "porz." : entry.unit}
            value={quantity}
            step={mode === "grams" ? 10 : undefined}
            shortcuts={quantityShortcuts(entry, mode)}
            onValueChange={(value, shortcut) => {
              setQuantity(value);
              const grams = parseDecimal(value);
              if (shortcut?.isPortion && grams !== null) {
                setPortionLabel(`${shortcut.label} (${formatGrams(grams)} ${entry.unit})`);
              } else {
                setPortionLabel(grams === entry.grams ? entry.portionLabel : null);
              }
            }}
          />
          <MacroLine nutrients={preview} />
          <MealPicker value={meal} onValueChange={setMeal} className="w-full" />
          <button type="submit" hidden />
        </form>
        <DrawerFooter className="flex-row pb-[max(1rem,env(safe-area-inset-bottom))]">
          <Button variant="destructive" size="lg" onClick={remove} disabled={isPending} aria-label="Elimina">
            <Trash2Icon />
          </Button>
          <Button variant="outline" size="lg" onClick={duplicate} disabled={isPending} aria-label="Duplica">
            <CopyPlusIcon />
          </Button>
          <Button size="lg" className="flex-1" onClick={save} disabled={isPending || !isValid}>
            Salva
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
