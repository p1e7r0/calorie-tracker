"use client";

import { Trash2Icon, XIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { deleteSavedMeal, updateSavedMeal } from "@/app/actions/saved-meals";
import { MacroLine } from "@/components/diary/macro-line";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { formatDecimal, formatGrams, formatKcal } from "@/lib/nutrition/format";
import { sumNutrients } from "@/lib/nutrition/nutrients";
import type { SavedMealView } from "@/server/saved-meals";

export function SavedMealEditor({ savedMeal }: { savedMeal: SavedMealView }) {
  const router = useRouter();
  const [name, setName] = useState(savedMeal.name);
  const [removedItemIds, setRemovedItemIds] = useState<string[]>([]);
  const [isPending, startTransition] = useTransition();
  const remainingItems = savedMeal.items.filter((item) => !removedItemIds.includes(item.id));
  const totals = sumNutrients(remainingItems.map((item) => item.nutrients));

  function save() {
    startTransition(async () => {
      const result = await updateSavedMeal({ savedMealId: savedMeal.id, name, removedItemIds });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Pasto salvato");
      router.replace("/food?tab=meals");
    });
  }

  function remove() {
    startTransition(async () => {
      const result = await deleteSavedMeal(savedMeal.id);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Pasto eliminato");
      router.replace("/food?tab=meals");
    });
  }

  return (
    <div className="flex flex-col gap-5 pb-8">
      <Field>
        <FieldLabel htmlFor="saved-meal-name">Nome</FieldLabel>
        <Input id="saved-meal-name" value={name} onChange={(event) => setName(event.target.value)} />
      </Field>
      <section>
        <div className="flex items-baseline justify-between">
          <h2 className="font-heading text-lg font-semibold tracking-tight">Voci</h2>
          <span className="text-sm font-medium">{formatKcal(totals.kcal)} kcal</span>
        </div>
        <ul className="mt-1 divide-y">
          {remainingItems.map((item) => (
            <li key={item.id} className="flex items-center gap-2 py-2">
              <span className="min-w-0 flex-1">
                <span className="block truncate">{item.name}</span>
                <span className="block text-sm text-muted-foreground">
                  {item.grams
                    ? `${formatGrams(item.grams)} g`
                    : `${formatDecimal(item.servings ?? 1)} ${item.servings === 1 ? "porzione" : "porzioni"}`}
                  , {formatKcal(item.nutrients.kcal)} kcal
                </span>
              </span>
              <Button
                variant="ghost"
                size="icon"
                aria-label={`Rimuovi ${item.name}`}
                onClick={() => setRemovedItemIds((current) => [...current, item.id])}
              >
                <XIcon />
              </Button>
            </li>
          ))}
        </ul>
        <MacroLine nutrients={totals} className="mt-2" />
      </section>
      <div className="flex gap-2">
        <Button variant="destructive" size="lg" onClick={remove} disabled={isPending} aria-label="Elimina pasto">
          <Trash2Icon />
        </Button>
        <Button size="lg" className="flex-1" onClick={save} disabled={isPending || !name.trim() || remainingItems.length === 0}>
          Salva
        </Button>
      </div>
    </div>
  );
}
