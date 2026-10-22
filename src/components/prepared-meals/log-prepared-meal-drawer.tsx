"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { logPreparedMeal, undoPreparedMealLog } from "@/app/actions/prepared-meals";
import { MacroLine } from "@/components/diary/macro-line";
import { MealPicker } from "@/components/diary/meal-picker";
import { addedToMealMessage, toastWithUndo } from "@/components/diary/toast-with-undo";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { describeEntryQuantity } from "@/lib/nutrition/entry-quantity";
import { formatKcal } from "@/lib/nutrition/format";
import { mealLabels, type MealType } from "@/lib/nutrition/meals";
import { describePortionsLeft, describeStorage } from "@/lib/nutrition/prepared-meals";
import type { PreparedMealView } from "@/server/prepared-meals";

export function LogPreparedMealDrawer({
  preparedMeal,
  day,
  meal,
  today,
  onOpenChange,
  onLogged,
  onUndone,
  onMealChange,
}: {
  preparedMeal: PreparedMealView;
  day: string;
  meal: MealType;
  today: string;
  onOpenChange: (open: boolean) => void;
  onLogged: (count: number) => void;
  onUndone?: (count: number) => void;
  onMealChange?: (meal: MealType) => void;
}) {
  const [isPending, startTransition] = useTransition();
  const storage = describeStorage(preparedMeal.location, preparedMeal.storedOn, today);

  function log() {
    startTransition(async () => {
      const result = await logPreparedMeal({ preparedMealId: preparedMeal.id, day, meal });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      const { entryIds } = result.data;
      toastWithUndo(
        addedToMealMessage(mealLabels[meal], preparedMeal.name),
        entryIds,
        () => onUndone?.(entryIds.length),
        (ids) => undoPreparedMealLog({ preparedMealId: preparedMeal.id, entryIds: ids }),
      );
      onLogged(entryIds.length);
    });
  }

  return (
    <Drawer open onOpenChange={onOpenChange}>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle className="text-lg">{preparedMeal.name}</DrawerTitle>
          <DrawerDescription>
            {storage.label}, {describePortionsLeft(preparedMeal.portions)}. Una porzione:{" "}
            {formatKcal(preparedMeal.totals.kcal)} kcal
          </DrawerDescription>
        </DrawerHeader>
        <div className="overflow-y-auto px-4">
          <ul className="divide-y">
            {preparedMeal.items.map((item) => (
              <li key={item.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                <span className="min-w-0">
                  <span className="block truncate">{item.label}</span>
                  <span className="text-muted-foreground">{describeEntryQuantity(item)}</span>
                </span>
                <span className="shrink-0 tabular-nums">{formatKcal(item.nutrients.kcal)}</span>
              </li>
            ))}
          </ul>
          <MacroLine nutrients={preparedMeal.totals} className="py-3" />
          {onMealChange ? <MealPicker value={meal} onValueChange={onMealChange} className="mb-1 w-full" /> : null}
        </div>
        <DrawerFooter className="pb-[max(1rem,env(safe-area-inset-bottom))]">
          <Button size="lg" onClick={log} disabled={isPending}>
            Aggiungi una porzione a {mealLabels[meal].toLowerCase()}
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
