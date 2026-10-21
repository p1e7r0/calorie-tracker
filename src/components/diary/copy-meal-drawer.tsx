"use client";

import { it } from "date-fns/locale";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { copyMeal } from "@/app/actions/diary";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Skeleton } from "@/components/ui/skeleton";
import { copiedEntriesLabel, defaultCopySourceDay, entryCountLabel, isCopyOntoItself } from "@/lib/nutrition/copy-meal";
import { formatLongDay } from "@/lib/nutrition/days";
import { describeEntryQuantity } from "@/lib/nutrition/entry-quantity";
import { formatKcal } from "@/lib/nutrition/format";
import { mealLabels, type MealType } from "@/lib/nutrition/meals";
import type { DiaryMeal } from "@/server/diary";
import { loggedDayClassName, toIsoDate, toLocalDate } from "./calendar-days";
import { MacroLine } from "./macro-line";
import { MealPicker } from "./meal-picker";
import { toastWithUndo } from "./toast-with-undo";

type SourceDayState = { day: string; meals: DiaryMeal[] | null; failed: boolean };

function useSourceDay(day: string) {
  const [state, setState] = useState<SourceDayState | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      try {
        const response = await fetch(`/api/diary/${day}`, { signal: controller.signal });
        if (!response.ok) throw new Error(String(response.status));
        const body = (await response.json()) as { meals: DiaryMeal[] };
        setState({ day, meals: body.meals, failed: false });
      } catch (error) {
        if (!controller.signal.aborted) {
          console.error(error);
          setState({ day, meals: null, failed: true });
        }
      }
    }
    load();
    return () => controller.abort();
  }, [day]);

  const isCurrent = state?.day === day;
  return {
    isLoading: !isCurrent,
    meals: isCurrent ? state.meals : null,
    failed: isCurrent && state.failed,
  };
}

export function CopyMealDrawer({
  day,
  meal,
  today,
  loggedDays,
  onOpenChange,
}: {
  day: string;
  meal: MealType;
  today: string;
  loggedDays: string[];
  onOpenChange: (open: boolean) => void;
}) {
  const [sourceDay, setSourceDay] = useState(() => defaultCopySourceDay(day, today));
  const [sourceMeal, setSourceMeal] = useState<MealType>(meal);
  const [isPending, startTransition] = useTransition();
  const source = useSourceDay(sourceDay);
  const sourceEntries = source.meals?.find((candidate) => candidate.meal === sourceMeal) ?? null;
  const isSameMeal = isCopyOntoItself({ fromDay: sourceDay, fromMeal: sourceMeal, toDay: day, toMeal: meal });
  const count = sourceEntries?.entries.length ?? 0;
  const targetLabel = mealLabels[meal].toLowerCase();

  function copy() {
    startTransition(async () => {
      const result = await copyMeal({ fromDay: sourceDay, fromMeal: sourceMeal, toDay: day, toMeal: meal });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      onOpenChange(false);
      const { entryIds } = result.data;
      if (entryIds.length === 0) {
        toast("Non c'era niente da copiare.");
        return;
      }
      toastWithUndo(`${copiedEntriesLabel(entryIds.length)} in ${targetLabel}`, entryIds);
    });
  }

  return (
    <Drawer open onOpenChange={onOpenChange}>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle className="text-lg">Copia da un altro giorno</DrawerTitle>
          <DrawerDescription>
            Le voci scelte vanno a {targetLabel} di {formatLongDay(day).toLowerCase()}.
          </DrawerDescription>
        </DrawerHeader>
        <div className="min-h-0 overflow-y-auto px-4 pb-4">
          <Calendar
            mode="single"
            required
            locale={it}
            className="mx-auto"
            selected={toLocalDate(sourceDay)}
            defaultMonth={toLocalDate(sourceDay)}
            disabled={{ after: toLocalDate(today) }}
            endMonth={toLocalDate(today)}
            modifiers={{ logged: loggedDays.map(toLocalDate) }}
            modifiersClassNames={{ logged: loggedDayClassName }}
            onSelect={(date) => {
              if (date) setSourceDay(toIsoDate(date));
            }}
          />
          <p className="flex items-center justify-center gap-1.5 pb-3 text-xs text-muted-foreground">
            <span className="size-1.5 rounded-full bg-energy" aria-hidden="true" />
            Giorni con qualcosa registrato
          </p>
          <MealPicker value={sourceMeal} onValueChange={setSourceMeal} className="w-full" />
          <section aria-label="Voci da copiare" className="mt-3">
            <h3 className="text-sm font-medium">
              {mealLabels[sourceMeal]}, {formatLongDay(sourceDay).toLowerCase()}
            </h3>
            {source.isLoading ? (
              <div className="mt-2 flex flex-col gap-2">
                <Skeleton className="h-5 w-full" />
                <Skeleton className="h-5 w-2/3" />
              </div>
            ) : source.failed ? (
              <p className="mt-2 text-sm text-muted-foreground">Non riesco a leggere il diario. Riprova tra poco.</p>
            ) : isSameMeal ? (
              <p className="mt-2 text-sm text-muted-foreground">
                È il pasto in cui stai copiando: scegli un altro giorno o un altro pasto.
              </p>
            ) : sourceEntries && count > 0 ? (
              <>
                <ul className="mt-1 divide-y">
                  {sourceEntries.entries.map((entry) => {
                    const quantity = describeEntryQuantity(entry);
                    return (
                      <li key={entry.id} className="flex items-baseline gap-2 py-2 text-sm">
                        <span className="min-w-0 truncate">{entry.label}</span>
                        {quantity ? <span className="shrink-0 text-muted-foreground">{quantity}</span> : null}
                        <span className="ml-auto shrink-0 pl-2 tabular-nums">{formatKcal(entry.nutrients.kcal)} kcal</span>
                      </li>
                    );
                  })}
                </ul>
                <div className="flex items-center justify-between gap-3 border-t pt-2">
                  <MacroLine nutrients={sourceEntries.totals} />
                  <span className="text-sm font-medium tabular-nums">{formatKcal(sourceEntries.totals.kcal)} kcal</span>
                </div>
              </>
            ) : (
              <p className="mt-2 text-sm text-muted-foreground">
                Niente registrato qui. Scegli un altro giorno o un altro pasto.
              </p>
            )}
          </section>
        </div>
        <DrawerFooter className="pb-[max(1rem,env(safe-area-inset-bottom))]">
          <Button size="lg" onClick={copy} disabled={isPending || source.isLoading || isSameMeal || count === 0}>
            {count > 0 && !isSameMeal ? `Copia ${entryCountLabel(count)}` : "Copia"}
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
