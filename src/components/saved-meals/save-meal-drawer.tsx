"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { saveMealFromDiary } from "@/app/actions/saved-meals";
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
import { mealLabels, type MealType } from "@/lib/nutrition/meals";

export function SaveMealDrawer({
  day,
  meal,
  onOpenChange,
}: {
  day: string;
  meal: MealType;
  onOpenChange: (open: boolean) => void;
}) {
  const [name, setName] = useState(`${mealLabels[meal]} tipo`);
  const [isPending, startTransition] = useTransition();

  function save() {
    startTransition(async () => {
      const result = await saveMealFromDiary({ day, meal, name });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(`«${name.trim()}» salvato con ${result.data.itemCount} voci`);
      onOpenChange(false);
    });
  }

  return (
    <Drawer open onOpenChange={onOpenChange}>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle className="text-lg">Salva come pasto</DrawerTitle>
          <DrawerDescription>La prossima volta lo aggiungi con un tocco dalla scheda Pasti.</DrawerDescription>
        </DrawerHeader>
        <form
          className="p-4"
          onSubmit={(event) => {
            event.preventDefault();
            save();
          }}
        >
          <Field>
            <FieldLabel htmlFor="saved-meal-name">Nome del pasto</FieldLabel>
            <Input id="saved-meal-name" autoFocus value={name} onChange={(event) => setName(event.target.value)} />
          </Field>
        </form>
        <DrawerFooter className="pb-[max(1rem,env(safe-area-inset-bottom))]">
          <Button size="lg" onClick={save} disabled={isPending || !name.trim()}>
            Salva pasto
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
