"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { logStoredMeal, undoStoredMeal } from "@/app/actions/stored-meals";
import { MacroLine } from "@/components/diary/macro-line";
import { MealPicker } from "@/components/diary/meal-picker";
import { addedToMealMessage } from "@/components/diary/toast-with-undo";
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
import {
  describePortions,
  describeStoredMealAge,
  isStoredMealOld,
  storageLocationLabels,
} from "@/lib/nutrition/stored-meals";
import { cn } from "@/lib/utils";
import type { StoredMealView } from "@/server/stored-meals";

export function LogStoredMealDrawer({
  storedMeal,
  day,
  meal,
  today,
  onOpenChange,
  onLogged,
  onUndone,
  onMealChange,
}: {
  storedMeal: StoredMealView;
  day: string;
  meal: MealType;
  today: string;
  onOpenChange: (open: boolean) => void;
  onLogged: (count: number) => void;
  onUndone?: (count: number) => void;
  onMealChange?: (meal: MealType) => void;
}) {
  const [isPending, startTransition] = useTransition();
  const isOld = isStoredMealOld(storedMeal.location, storedMeal.preparedOn, today);

  function log() {
    startTransition(async () => {
      const result = await logStoredMeal({ storedMealId: storedMeal.id, day, meal });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      const { entryIds, remainingPortions } = result.data;
      toast.success(addedToMealMessage(mealLabels[meal], storedMeal.name), {
        description:
          remainingPortions === 0 ? "Era l'ultima porzione." : `Ne restano ${describePortions(remainingPortions)}.`,
        action: {
          label: "Annulla",
          onClick: async () => {
            const undone = await undoStoredMeal({ storedMealId: storedMeal.id, entryIds });
            if (!undone.ok) {
              toast.error(undone.error);
              return;
            }
            onUndone?.(entryIds.length);
          },
        },
      });
      onLogged(entryIds.length);
    });
  }

  return (
    <Drawer open onOpenChange={onOpenChange}>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle className="text-lg">{storedMeal.name}</DrawerTitle>
          <DrawerDescription className={cn(isOld && "text-over-text")}>
            {storageLocationLabels[storedMeal.location]}, {describeStoredMealAge(storedMeal.preparedOn, today)},{" "}
            {describePortions(storedMeal.portions)}
            {isOld ? ". Controlla prima di mangiarlo." : ""}
          </DrawerDescription>
        </DrawerHeader>
        <div className="overflow-y-auto px-4">
          <ul className="divide-y">
            {storedMeal.items.map((item) => {
              const quantity = describeEntryQuantity(item);
              return (
                <li key={item.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                  <span className="min-w-0">
                    <span className="block truncate">{item.label}</span>
                    {quantity ? <span className="text-muted-foreground">{quantity}</span> : null}
                  </span>
                  <span className="shrink-0 tabular-nums">{formatKcal(item.nutrients.kcal)}</span>
                </li>
              );
            })}
          </ul>
          <div className="flex items-center justify-between gap-3 py-3">
            <MacroLine nutrients={storedMeal.perPortion} />
            <span className="text-sm font-medium tabular-nums">{formatKcal(storedMeal.perPortion.kcal)} kcal</span>
          </div>
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
