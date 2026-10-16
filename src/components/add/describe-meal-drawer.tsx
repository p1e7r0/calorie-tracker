"use client";

import { SparklesIcon } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { type MealSuggestion, suggestMealItems } from "@/app/actions/ai";
import { addDiaryEntry } from "@/app/actions/diary";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { formatKcal, parseDecimal } from "@/lib/nutrition/format";
import { mealLabels, type MealType } from "@/lib/nutrition/meals";
import { scaleNutrients } from "@/lib/nutrition/nutrients";

const estimateChoice = "estimate";

type ReviewedItem = Omit<MealSuggestion, "grams"> & { included: boolean; choice: string; grams: string };

function reviewedItemKcal(item: ReviewedItem) {
  if (item.choice === estimateChoice) return item.estimatedKcal;
  const food = item.candidates.find((candidate) => candidate.id === item.choice);
  const grams = parseDecimal(item.grams) ?? 0;
  return food ? scaleNutrients(food.per100, grams).kcal : 0;
}

export function DescribeMealDrawer({
  day,
  meal,
  onOpenChange,
  onLogged,
}: {
  day: string;
  meal: MealType;
  onOpenChange: (open: boolean) => void;
  onLogged: (count: number) => void;
}) {
  const [text, setText] = useState("");
  const [items, setItems] = useState<ReviewedItem[] | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const includedItems = items?.filter((item) => item.included) ?? [];
  const totalKcal = includedItems.reduce((sum, item) => sum + reviewedItemKcal(item), 0);

  function analyze() {
    setErrorMessage(null);
    startTransition(async () => {
      const result = await suggestMealItems(text);
      if (!result.ok) {
        setErrorMessage(result.error);
        return;
      }
      if (result.data.length === 0) {
        setErrorMessage("Non ho trovato alimenti nella descrizione. Prova a elencarli con le quantità.");
        return;
      }
      setItems(
        result.data.map((suggestion) => ({
          ...suggestion,
          included: true,
          choice: suggestion.candidates[0]?.id ?? estimateChoice,
          grams: String(suggestion.grams),
        })),
      );
    });
  }

  function updateItem(index: number, changes: Partial<ReviewedItem>) {
    setItems((current) => current?.map((item, position) => (position === index ? { ...item, ...changes } : item)) ?? null);
  }

  function addAll() {
    startTransition(async () => {
      let added = 0;
      for (const item of includedItems) {
        const grams = parseDecimal(item.grams);
        const result =
          item.choice === estimateChoice || !grams
            ? await addDiaryEntry({
                day,
                meal,
                item: { type: "quick", label: item.description, kcal: item.estimatedKcal },
              })
            : await addDiaryEntry({
                day,
                meal,
                item: { type: "food", foodId: item.choice, grams, portionLabel: null },
              });
        if (!result.ok) {
          toast.error(`${item.description}: ${result.error}`);
          continue;
        }
        added += 1;
      }
      if (added > 0) {
        toast.success(
          `${added === 1 ? "1 voce aggiunta" : `${added} voci aggiunte`} a ${mealLabels[meal].toLowerCase()}`,
        );
        onLogged(added);
      }
    });
  }

  return (
    <Drawer open onOpenChange={onOpenChange}>
      <DrawerContent className="data-[swipe-axis=y]:[--drawer-content-max-height:calc(100dvh-3rem)]">
        <DrawerHeader>
          <DrawerTitle className="text-lg">Descrivi il pasto</DrawerTitle>
          <DrawerDescription>
            {items
              ? "Controlla gli alimenti trovati, correggi le quantità e aggiungili."
              : "Scrivi cosa hai mangiato, anche a occhio: trovo gli alimenti e stimo le quantità."}
          </DrawerDescription>
        </DrawerHeader>
        <div className="flex min-h-0 flex-col gap-3 overflow-y-auto p-4">
          {items ? (
            <ul className="flex flex-col gap-3">
              {items.map((item, index) => (
                <li key={`${item.description}-${index}`} className="rounded-xl p-3 ring-1 ring-border">
                  <label className="flex items-center gap-2 text-sm font-medium">
                    <input
                      type="checkbox"
                      className="size-4 accent-foreground"
                      checked={item.included}
                      onChange={(event) => updateItem(index, { included: event.target.checked })}
                    />
                    {item.description}
                    <span className="ml-auto text-muted-foreground tabular-nums">
                      {formatKcal(reviewedItemKcal(item))} kcal
                    </span>
                  </label>
                  {item.included ? (
                    <div className="mt-2 grid grid-cols-[1fr_6rem] gap-2">
                      <select
                        aria-label={`Alimento per ${item.description}`}
                        value={item.choice}
                        onChange={(event) => updateItem(index, { choice: event.target.value })}
                        className="h-10 min-w-0 rounded-lg border border-input bg-transparent px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
                      >
                        {item.candidates.map((candidate) => (
                          <option key={candidate.id} value={candidate.id}>
                            {candidate.brand ? `${candidate.name}, ${candidate.brand}` : candidate.name}
                          </option>
                        ))}
                        <option value={estimateChoice}>Stima: {formatKcal(item.estimatedKcal)} kcal</option>
                      </select>
                      {item.choice === estimateChoice ? (
                        <span className="flex items-center text-xs text-muted-foreground">senza alimento</span>
                      ) : (
                        <Input
                          aria-label={`Grammi di ${item.description}`}
                          inputMode="decimal"
                          value={item.grams}
                          onChange={(event) => updateItem(index, { grams: event.target.value })}
                        />
                      )}
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : (
            <Field>
              <FieldLabel htmlFor="meal-description">Cosa hai mangiato?</FieldLabel>
              <Textarea
                id="meal-description"
                autoFocus
                rows={4}
                maxLength={500}
                placeholder="Pasta al pomodoro, circa 80 g, con un cucchiaio di parmigiano e una mela"
                value={text}
                onChange={(event) => setText(event.target.value)}
              />
            </Field>
          )}
          {errorMessage ? <FieldError>{errorMessage}</FieldError> : null}
        </div>
        <DrawerFooter className="pb-[max(1rem,env(safe-area-inset-bottom))]">
          {items ? (
            <div className="flex gap-2">
              <Button variant="outline" size="lg" disabled={isPending} onClick={() => setItems(null)}>
                Riscrivi
              </Button>
              <Button size="lg" className="flex-1" disabled={isPending || includedItems.length === 0} onClick={addAll}>
                {isPending ? <Spinner /> : null}
                Aggiungi {formatKcal(totalKcal)} kcal a {mealLabels[meal].toLowerCase()}
              </Button>
            </div>
          ) : (
            <Button size="lg" disabled={isPending || text.trim().length < 3} onClick={analyze}>
              {isPending ? <Spinner /> : <SparklesIcon />}
              {isPending ? "Analizzo…" : "Trova gli alimenti"}
            </Button>
          )}
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
