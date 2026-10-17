"use client";

import { BookmarkPlusIcon, CopyIcon, EllipsisIcon, PlusIcon } from "lucide-react";
import Link from "next/link";
import { useLayoutEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { copyMeal } from "@/app/actions/diary";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { addDays } from "@/lib/nutrition/days";
import { formatDecimal, formatGrams, formatKcal } from "@/lib/nutrition/format";
import { mealLabels } from "@/lib/nutrition/meals";
import type { DiaryEntryView, DiaryMeal } from "@/server/diary";
import { SaveMealDrawer } from "@/components/saved-meals/save-meal-drawer";
import { EntryEditor } from "./entry-editor";
import { SwipeableRow } from "./swipeable-row";
import { useEntryActions } from "./use-entry-actions";

function describeQuantity(entry: DiaryEntryView) {
  if (entry.kind === "quick") return null;
  if (entry.portionLabel) return entry.portionLabel;
  if (entry.grams) return `${formatGrams(entry.grams)} g`;
  if (entry.servings) {
    return entry.servings === 1 ? "1 porzione" : `${formatDecimal(entry.servings)} porzioni`;
  }
  return null;
}

export function MealSection({ meal, day }: { meal: DiaryMeal; day: string }) {
  const [editingEntry, setEditingEntry] = useState<DiaryEntryView | null>(null);
  const [saveMealOpen, setSaveMealOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const entryActions = useEntryActions();
  const label = mealLabels[meal.meal];

  useLayoutEffect(() => {
    return () => {
      setEditingEntry(null);
      setSaveMealOpen(false);
    };
  }, []);
  const addHref = `/add?date=${day}&meal=${meal.meal}`;

  function copyFromYesterday() {
    startTransition(async () => {
      const result = await copyMeal({
        fromDay: addDays(day, -1),
        fromMeal: meal.meal,
        toDay: day,
        toMeal: meal.meal,
      });
      if (!result.ok) {
        toast.error(result.error);
      } else if (result.data.copied === 0) {
        toast(`Ieri non c'era niente in ${label.toLowerCase()}.`);
      } else {
        toast.success(`${result.data.copied} voci copiate da ieri`);
      }
    });
  }

  return (
    <section aria-labelledby={`meal-${meal.meal}`} className="border-b py-3 last:border-b-0">
      <header className="flex items-center gap-1">
        <h2 id={`meal-${meal.meal}`} className="flex-1 font-heading text-lg font-semibold tracking-tight">
          {label}
        </h2>
        {meal.entries.length > 0 ? (
          <span className="mr-1 text-sm font-medium tabular-nums">{formatKcal(meal.totals.kcal)} kcal</span>
        ) : null}
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                variant="ghost"
                size="icon"
                className="touch-target"
                aria-label={`Altre azioni per ${label.toLowerCase()}`}
              />
            }
            disabled={isPending}
          >
            <EllipsisIcon />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-48">
            <DropdownMenuItem onClick={copyFromYesterday}>
              <CopyIcon />
              Copia da ieri
            </DropdownMenuItem>
            {meal.entries.some((entry) => entry.kind !== "quick") ? (
              <DropdownMenuItem onClick={() => setSaveMealOpen(true)}>
                <BookmarkPlusIcon />
                Salva come pasto
              </DropdownMenuItem>
            ) : null}
          </DropdownMenuContent>
        </DropdownMenu>
        <Link
          href={addHref}
          aria-label={`Aggiungi a ${label.toLowerCase()}`}
          className={buttonVariants({ variant: "secondary", size: "icon", className: "ml-1 touch-target" })}
        >
          <PlusIcon />
        </Link>
      </header>

      {meal.entries.length > 0 ? (
        <ul className="-mx-2 mt-0.5">
          {meal.entries.map((entry) => {
            const quantity = describeQuantity(entry);
            return (
              <li key={entry.id}>
                <SwipeableRow
                  disabled={entryActions.isPending}
                  onSwipeLeft={() => entryActions.removeEntry(entry)}
                  onSwipeRight={() => entryActions.duplicateEntry(entry)}
                >
                  <button
                    type="button"
                    onClick={() => setEditingEntry(entry)}
                    className="flex w-full items-baseline gap-2 rounded-lg px-2 py-2 text-left transition-colors outline-none hover:bg-muted/60 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:ring-inset"
                  >
                    <span className="min-w-0 truncate">{entry.label}</span>
                    {quantity ? (
                      <span className="shrink-0 text-sm text-muted-foreground">{quantity}</span>
                    ) : null}
                    <span className="ml-auto shrink-0 pl-2 tabular-nums">{formatKcal(entry.nutrients.kcal)}</span>
                  </button>
                </SwipeableRow>
              </li>
            );
          })}
        </ul>
      ) : (
        <Link href={addHref} className="mt-1 block py-1 text-sm text-muted-foreground">
          Niente ancora. Tocca + per aggiungere.
        </Link>
      )}

      {saveMealOpen ? <SaveMealDrawer day={day} meal={meal.meal} onOpenChange={setSaveMealOpen} /> : null}
      {editingEntry ? (
        <EntryEditor
          key={editingEntry.id}
          entry={editingEntry}
          open
          onOpenChange={(open) => {
            if (!open) setEditingEntry(null);
          }}
        />
      ) : null}
    </section>
  );
}
