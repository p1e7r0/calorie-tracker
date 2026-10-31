"use client";

import { useId, useState, useTransition } from "react";
import { toast } from "sonner";
import { storeMealFromDiaryMeal } from "@/app/actions/stored-meals";
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
import type { MealType } from "@/lib/nutrition/meals";
import type { StorageLocation } from "@/lib/nutrition/stored-meals";
import { PortionsStepper, StorageLocationPicker } from "./stored-meal-fields";

export function StoreMealDrawer({
  day,
  today,
  meal,
  onOpenChange,
}: {
  day: string;
  today: string;
  meal: MealType;
  onOpenChange: (open: boolean) => void;
}) {
  const [name, setName] = useState("");
  const [location, setLocation] = useState<StorageLocation>("fridge");
  const [portions, setPortions] = useState(1);
  const [isPending, startTransition] = useTransition();
  const locationLabelId = useId();
  const portionsLabelId = useId();

  function save() {
    if (!name.trim()) return;
    startTransition(async () => {
      const result = await storeMealFromDiaryMeal({
        day,
        meal,
        name,
        location,
        portions,
        preparedOn: day < today ? day : today,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(`«${name.trim()}» ${location === "freezer" ? "nel congelatore" : "in frigo"}`);
      onOpenChange(false);
    });
  }

  return (
    <Drawer open onOpenChange={onOpenChange}>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle className="text-lg">Metti da parte</DrawerTitle>
          <DrawerDescription>
            Hai preparato altre porzioni uguali a questo pasto? Le ritrovi in Aggiungi › Pasti.
          </DrawerDescription>
        </DrawerHeader>
        <form
          className="flex flex-col gap-4 overflow-y-auto p-4"
          onSubmit={(event) => {
            event.preventDefault();
            save();
          }}
        >
          <Field>
            <FieldLabel htmlFor="store-meal-name">Nome del pasto</FieldLabel>
            <Input id="store-meal-name" autoFocus value={name} onChange={(event) => setName(event.target.value)} />
          </Field>
          <Field>
            <FieldLabel id={locationLabelId}>Dove</FieldLabel>
            <StorageLocationPicker value={location} onValueChange={setLocation} labelId={locationLabelId} />
          </Field>
          <Field>
            <FieldLabel id={portionsLabelId}>Porzioni messe da parte</FieldLabel>
            <PortionsStepper value={portions} onValueChange={setPortions} labelId={portionsLabelId} />
          </Field>
        </form>
        <DrawerFooter className="pb-[max(1rem,env(safe-area-inset-bottom))]">
          <Button size="lg" onClick={save} disabled={isPending || !name.trim()}>
            Metti da parte
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
