"use client";

import { BookmarkPlusIcon, CalendarDaysIcon, CopyIcon, EllipsisIcon, PlusIcon, RefrigeratorIcon } from "lucide-react";
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
import { copiedEntriesLabel } from "@/lib/nutrition/copy-meal";
import { addDays } from "@/lib/nutrition/days";
import { describeEntryQuantity } from "@/lib/nutrition/entry-quantity";
import { formatKcal } from "@/lib/nutrition/format";
import { mealLabels } from "@/lib/nutrition/meals";
import type { DiaryEntryView, DiaryMeal } from "@/server/diary";
import { SaveMealDrawer } from "@/components/saved-meals/save-meal-drawer";
import { StoreMealDrawer } from "@/components/stored-meals/store-meal-drawer";
import { CopyMealDrawer } from "./copy-meal-drawer";
import { EntryEditor } from "./entry-editor";
import { SwipeableRow } from "./swipeable-row";
import { toastWithUndo } from "./toast-with-undo";
import { useEntryActions } from "./use-entry-actions";

export function MealSection({
  meal,
  day,
  today,
  loggedDays,
}: {
  meal: DiaryMeal;
  day: string;
  today: string;
  loggedDays: string[];
}) {
  const [editingEntry, setEditingEntry] = useState<DiaryEntryView | null>(null);
  const [saveMealOpen, setSaveMealOpen] = useState(false);
  const [copyMealOpen, setCopyMealOpen] = useState(false);
  const [storeMealOpen, setStoreMealOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const entryActions = useEntryActions();
  const label = mealLabels[meal.meal];

  useLayoutEffect(() => {
    return () => {
      setEditingEntry(null);
      setSaveMealOpen(false);
      setCopyMealOpen(false);
      setStoreMealOpen(false);
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
      } else if (result.data.entryIds.length === 0) {
        toast(`Ieri non c'era niente in ${label.toLowerCase()}.`);
      } else {
        toastWithUndo(`${copiedEntriesLabel(result.data.entryIds.length)} da ieri`, result.data.entryIds);
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
            <DropdownMenuItem onClick={() => setCopyMealOpen(true)}>
              <CalendarDaysIcon />
              Copia da un altro giorno…
            </DropdownMenuItem>
            {meal.entries.some((entry) => entry.kind !== "quick") ? (
              <DropdownMenuItem onClick={() => setSaveMealOpen(true)}>
                <BookmarkPlusIcon />
                Salva come pasto
              </DropdownMenuItem>
            ) : null}
            {meal.entries.length > 0 ? (
              <DropdownMenuItem onClick={() => setStoreMealOpen(true)}>
                <RefrigeratorIcon />
                Metti da parte…
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
            const quantity = describeEntryQuantity(entry);
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
      {storeMealOpen ? (
        <StoreMealDrawer day={day} today={today} meal={meal.meal} onOpenChange={setStoreMealOpen} />
      ) : null}
      {copyMealOpen ? (
        <CopyMealDrawer
          day={day}
          meal={meal.meal}
          today={today}
          loggedDays={loggedDays}
          onOpenChange={setCopyMealOpen}
        />
      ) : null}
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
