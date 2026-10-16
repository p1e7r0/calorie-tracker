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
import { formatDecimal, formatKcal, parseDecimal } from "@/lib/nutrition/format";
import { mealLabels, type MealType } from "@/lib/nutrition/meals";
import { multiplyNutrients } from "@/lib/nutrition/nutrients";
import type { DiaryEntryView } from "@/server/diary";
import { MacroLine } from "./macro-line";
import { MealPicker } from "./meal-picker";
import { QuantityField } from "./quantity-field";
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
    if (!isValid) return;
    startTransition(async () => {
      const result = await updateDiaryEntry({
        id: entry.id,
        meal,
        grams: mode === "grams" ? parsedQuantity : null,
        servings: mode === "servings" ? parsedQuantity : null,
        kcal: mode === "kcal" ? parsedQuantity : null,
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
        <div className="flex flex-col gap-4 overflow-y-auto p-4">
          <QuantityField
            label={mode === "kcal" ? "Kcal" : mode === "servings" ? "Porzioni" : "Quantità"}
            unit={mode === "kcal" ? "kcal" : mode === "servings" ? "porz." : "g"}
            value={quantity}
            onValueChange={(value) => setQuantity(value)}
          />
          <MacroLine nutrients={preview} />
          <MealPicker value={meal} onValueChange={setMeal} className="w-full" />
        </div>
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
