"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
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
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { parseDecimal } from "@/lib/nutrition/format";
import { mealLabels, type MealType } from "@/lib/nutrition/meals";

export function QuickKcalDrawer({
  day,
  meal,
  onOpenChange,
  onLogged,
}: {
  day: string;
  meal: MealType;
  onOpenChange: (open: boolean) => void;
  onLogged: () => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [values, setValues] = useState({ label: "", kcal: "", protein: "", carbs: "", fat: "" });
  const kcal = parseDecimal(values.kcal);

  function update(field: keyof typeof values, value: string) {
    setValues((current) => ({ ...current, [field]: value }));
  }

  function submit() {
    if (kcal === null) return;
    startTransition(async () => {
      const result = await addDiaryEntry({
        day,
        meal,
        item: {
          type: "quick",
          label: values.label.trim() || null,
          kcal,
          protein: parseDecimal(values.protein),
          carbs: parseDecimal(values.carbs),
          fat: parseDecimal(values.fat),
        },
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(`Aggiunte ${Math.round(kcal)} kcal a ${mealLabels[meal].toLowerCase()}`);
      onLogged();
    });
  }

  return (
    <Drawer open onOpenChange={onOpenChange}>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle className="text-lg">Kcal veloci</DrawerTitle>
          <DrawerDescription>Quando non sai di preciso cosa hai mangiato.</DrawerDescription>
        </DrawerHeader>
        <form
          className="flex flex-col gap-4 overflow-y-auto p-4"
          onSubmit={(event) => {
            event.preventDefault();
            submit();
          }}
        >
          <Field>
            <FieldLabel htmlFor="quick-kcal">Kcal</FieldLabel>
            <Input
              id="quick-kcal"
              inputMode="decimal"
              autoFocus
              required
              className="h-12 text-2xl font-semibold"
              value={values.kcal}
              onChange={(event) => update("kcal", event.target.value)}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="quick-label">Descrizione</FieldLabel>
            <Input
              id="quick-label"
              placeholder="Aperitivo"
              value={values.label}
              onChange={(event) => update("label", event.target.value)}
            />
          </Field>
          <div className="grid grid-cols-3 gap-2">
            {(
              [
                ["protein", "Proteine g"],
                ["carbs", "Carboidrati g"],
                ["fat", "Grassi g"],
              ] as const
            ).map(([field, label]) => (
              <Field key={field}>
                <FieldLabel htmlFor={`quick-${field}`} className="text-xs">
                  {label}
                </FieldLabel>
                <Input
                  id={`quick-${field}`}
                  inputMode="decimal"
                  value={values[field]}
                  onChange={(event) => update(field, event.target.value)}
                />
              </Field>
            ))}
          </div>
          <button type="submit" hidden />
        </form>
        <DrawerFooter className="pb-[max(1rem,env(safe-area-inset-bottom))]">
          <Button size="lg" onClick={submit} disabled={isPending || kcal === null}>
            Aggiungi a {mealLabels[meal].toLowerCase()}
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
