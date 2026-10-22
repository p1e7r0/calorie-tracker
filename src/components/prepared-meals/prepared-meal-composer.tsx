"use client";

import { ChefHatIcon, PlusIcon, XIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { createPreparedMeal } from "@/app/actions/prepared-meals";
import { ScreenBody, ScreenFooter } from "@/components/app-shell/screen";
import { MacroLine } from "@/components/diary/macro-line";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { describeEntryQuantity } from "@/lib/nutrition/entry-quantity";
import { formatKcal } from "@/lib/nutrition/format";
import { multiplyNutrients, type Nutrients, scaleNutrients, sumNutrients } from "@/lib/nutrition/nutrients";
import { describePortionsLeft, type StorageLocation } from "@/lib/nutrition/prepared-meals";
import type { LoggableItem } from "@/server/loggable";
import { ItemPicker, type PickedItem } from "./item-picker";
import { PortionsStepper, StorageLocationPicker } from "./storage-controls";

export type PreparedMealDraft = {
  name: string;
  location: StorageLocation;
  portions: number;
  items: PickedItem[];
};

type DraftItem = PickedItem & { key: string };

function nextKey() {
  return Math.random().toString(36).slice(2);
}

function pickedNutrients({ item, quantity }: PickedItem): Nutrients {
  if (item.type === "food" && quantity.type === "food") return scaleNutrients(item.per100, quantity.grams);
  if (item.type === "recipe" && quantity.type === "recipe") {
    return quantity.grams
      ? scaleNutrients(item.per100, quantity.grams)
      : multiplyNutrients(item.perServing, quantity.servings ?? 1);
  }
  return { kcal: 0, protein: 0, carbs: 0, fat: 0 };
}

function pickedLabel(item: LoggableItem) {
  return item.type === "food" && item.brand ? `${item.name}, ${item.brand}` : item.name;
}

function pickedQuantity({ item, quantity }: PickedItem) {
  return describeEntryQuantity({
    kind: quantity.type,
    grams: quantity.grams ?? null,
    servings: quantity.type === "recipe" ? (quantity.servings ?? null) : null,
    portionLabel: quantity.type === "food" ? (quantity.portionLabel ?? null) : null,
    unit: item.type === "food" ? item.unit : "g",
  });
}

export function PreparedMealComposer({
  initialValues,
  suggestions,
}: {
  initialValues: PreparedMealDraft;
  suggestions: LoggableItem[];
}) {
  const { bfcacheId } = useRouter();
  return <PreparedMealComposerContent key={bfcacheId} initialValues={initialValues} suggestions={suggestions} />;
}

function PreparedMealComposerContent({
  initialValues,
  suggestions,
}: {
  initialValues: PreparedMealDraft;
  suggestions: LoggableItem[];
}) {
  const router = useRouter();
  const [name, setName] = useState(initialValues.name);
  const [location, setLocation] = useState(initialValues.location);
  const [portions, setPortions] = useState(initialValues.portions);
  const [items, setItems] = useState<DraftItem[]>(() =>
    initialValues.items.map((picked) => ({ ...picked, key: nextKey() })),
  );
  const [pickerOpen, setPickerOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const perPortion = sumNutrients(items.map(pickedNutrients));

  function save() {
    setErrorMessage(null);
    startTransition(async () => {
      const result = await createPreparedMeal({
        name,
        location,
        portions,
        items: items.map((picked) => picked.quantity),
      });
      if (!result.ok) {
        setErrorMessage(result.error);
        return;
      }
      toast.success(
        `«${name.trim()}» ${location === "fridge" ? "in frigo" : "in congelatore"}: ${describePortionsLeft(portions)}`,
      );
      router.replace("/food?tab=prepared");
    });
  }

  return (
    <>
      <ScreenBody className="flex flex-col gap-5">
        <Field>
          <FieldLabel htmlFor="prepared-meal-name">Nome</FieldLabel>
          <Input
            id="prepared-meal-name"
            value={name}
            placeholder="Pranzo da portare al lavoro"
            autoFocus={!name}
            onChange={(event) => setName(event.target.value)}
          />
        </Field>

        <Field>
          <FieldLabel id="prepared-meal-location-label">Dove lo metti</FieldLabel>
          <StorageLocationPicker value={location} onValueChange={setLocation} labelledBy="prepared-meal-location-label" />
        </Field>

        <section aria-labelledby="prepared-meal-items-heading">
          <div className="flex items-baseline justify-between">
            <h2 id="prepared-meal-items-heading" className="font-heading text-lg font-semibold tracking-tight">
              In una porzione
            </h2>
            <span className="text-sm font-medium tabular-nums">{formatKcal(perPortion.kcal)} kcal</span>
          </div>
          {items.length === 0 ? (
            <p className="py-3 text-sm text-muted-foreground">
              Aggiungi gli alimenti e le ricette che metti in ogni contenitore.
            </p>
          ) : (
            <ul className="mt-1 divide-y">
              {items.map((picked) => (
                <li key={picked.key} className="flex items-center gap-2 py-2">
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5">
                      {picked.item.type === "recipe" ? (
                        <ChefHatIcon className="size-4 shrink-0 text-muted-foreground" aria-label="Ricetta" />
                      ) : null}
                      <span className="truncate">{pickedLabel(picked.item)}</span>
                    </span>
                    <span className="block text-sm text-muted-foreground">
                      {pickedQuantity(picked)}, {formatKcal(pickedNutrients(picked).kcal)} kcal
                    </span>
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="touch-target"
                    aria-label={`Rimuovi ${pickedLabel(picked.item)}`}
                    onClick={() => setItems((current) => current.filter((candidate) => candidate.key !== picked.key))}
                  >
                    <XIcon />
                  </Button>
                </li>
              ))}
            </ul>
          )}
          {items.length > 0 ? <MacroLine nutrients={perPortion} className="mt-2" /> : null}
          <Button variant="outline" className="mt-3" onClick={() => setPickerOpen(true)}>
            <PlusIcon />
            Aggiungi alimento o ricetta
          </Button>
        </section>

        <Field>
          <FieldLabel id="prepared-meal-portions-label">Porzioni</FieldLabel>
          <PortionsStepper value={portions} onValueChange={setPortions} labelledBy="prepared-meal-portions-label" />
          <FieldDescription>
            Quanti contenitori uguali conservi. Ogni volta che ne mangi uno, lo togli dall&apos;elenco.
          </FieldDescription>
        </Field>
      </ScreenBody>

      <ScreenFooter>
        {errorMessage ? <FieldError className="mb-2">{errorMessage}</FieldError> : null}
        <div className="flex items-center gap-3">
          <p className="min-w-0 flex-1 text-sm leading-tight">
            <span className="block font-heading text-lg font-semibold">{formatKcal(perPortion.kcal)} kcal</span>
            <span className="text-muted-foreground">a porzione</span>
          </p>
          <Button size="lg" onClick={save} disabled={isPending || !name.trim() || items.length === 0}>
            {location === "fridge" ? "Metti in frigo" : "Metti in congelatore"}
          </Button>
        </div>
      </ScreenFooter>

      {pickerOpen ? (
        <ItemPicker
          suggestions={suggestions}
          onOpenChange={setPickerOpen}
          onPick={(picked) => {
            setItems((current) => [...current, { ...picked, key: nextKey() }]);
            setPickerOpen(false);
          }}
        />
      ) : null}
    </>
  );
}
