"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { logSavedMeal } from "@/app/actions/saved-meals";
import { MacroLine } from "@/components/diary/macro-line";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { formatDecimal, formatGrams, formatKcal } from "@/lib/nutrition/format";
import { mealLabels, type MealType } from "@/lib/nutrition/meals";
import type { SavedMealView } from "@/server/saved-meals";

export function LogSavedMealDrawer({
  savedMeal,
  day,
  meal,
  onOpenChange,
  onLogged,
}: {
  savedMeal: SavedMealView;
  day: string;
  meal: MealType;
  onOpenChange: (open: boolean) => void;
  onLogged: (count: number) => void;
}) {
  const [isPending, startTransition] = useTransition();

  function log() {
    startTransition(async () => {
      const result = await logSavedMeal({ savedMealId: savedMeal.id, day, meal });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(`${savedMeal.name} aggiunto a ${mealLabels[meal].toLowerCase()}`);
      onLogged(result.data.logged);
    });
  }

  return (
    <Drawer open onOpenChange={onOpenChange}>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle className="text-lg">{savedMeal.name}</DrawerTitle>
          <DrawerDescription>
            {savedMeal.items.length} voci, {formatKcal(savedMeal.totals.kcal)} kcal
          </DrawerDescription>
        </DrawerHeader>
        <div className="overflow-y-auto px-4">
          <ul className="divide-y">
            {savedMeal.items.map((item) => (
              <li key={item.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                <span className="min-w-0">
                  <span className="block truncate">{item.name}</span>
                  <span className="text-muted-foreground">
                    {item.grams
                      ? `${formatGrams(item.grams)} g`
                      : `${formatDecimal(item.servings ?? 1)} ${item.servings === 1 ? "porzione" : "porzioni"}`}
                  </span>
                </span>
                <span className="shrink-0 tabular-nums">{formatKcal(item.nutrients.kcal)}</span>
              </li>
            ))}
          </ul>
          <MacroLine nutrients={savedMeal.totals} className="py-3" />
        </div>
        <DrawerFooter className="pb-[max(1rem,env(safe-area-inset-bottom))]">
          <Button size="lg" onClick={log} disabled={isPending}>
            Aggiungi tutto a {mealLabels[meal].toLowerCase()}
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
