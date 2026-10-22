"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { deleteFreezerBatch, updateFreezerBatch } from "@/app/actions/freezer";
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
import { todayIsoDate } from "@/lib/nutrition/days";
import { formatKcal } from "@/lib/nutrition/format";
import { describePortion } from "@/lib/nutrition/freezer";
import type { FreezerBatchView } from "@/server/freezer";
import { PortionStepper } from "./portion-stepper";

export function FreezerBatchDrawer({
  batch,
  onOpenChange,
}: {
  batch: FreezerBatchView;
  onOpenChange: (open: boolean) => void;
}) {
  const [label, setLabel] = useState(batch.label);
  const [frozenOn, setFrozenOn] = useState(batch.frozenOn);
  const [portionsLeft, setPortionsLeft] = useState(batch.portionsLeft);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [isPending, startTransition] = useTransition();
  const canSave = !isPending && label.trim() !== "" && frozenOn !== "";

  function save() {
    if (!canSave) return;
    startTransition(async () => {
      const result = await updateFreezerBatch({ batchId: batch.id, label, frozenOn, portionsLeft });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(portionsLeft === 0 ? `Finito: «${label.trim()}»` : "Congelatore aggiornato");
      onOpenChange(false);
    });
  }

  function remove() {
    if (!confirmingDelete) {
      setConfirmingDelete(true);
      return;
    }
    startTransition(async () => {
      const result = await deleteFreezerBatch(batch.id);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast(`Tolto dal congelatore: «${batch.label}»`);
      onOpenChange(false);
    });
  }

  return (
    <Drawer open onOpenChange={onOpenChange}>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle className="text-lg leading-snug">{batch.label}</DrawerTitle>
          <DrawerDescription>
            Ogni porzione: {describePortion(batch)}, {formatKcal(batch.perPortion.kcal)} kcal. La aggiungi al diario da
            Aggiungi, scheda Suggeriti.
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
            <FieldLabel htmlFor="freezer-batch-label">Nome</FieldLabel>
            <Input id="freezer-batch-label" value={label} onChange={(event) => setLabel(event.target.value)} />
          </Field>
          <PortionStepper label="Porzioni rimaste" value={portionsLeft} minimum={0} onValueChange={setPortionsLeft} />
          <Field>
            <FieldLabel htmlFor="freezer-batch-frozen-on">Congelato il</FieldLabel>
            <Input
              id="freezer-batch-frozen-on"
              type="date"
              max={todayIsoDate()}
              value={frozenOn}
              onChange={(event) => setFrozenOn(event.target.value)}
            />
          </Field>
          <button type="submit" hidden />
        </form>
        <DrawerFooter className="grid grid-cols-[auto_1fr] gap-2 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <Button size="lg" variant={confirmingDelete ? "destructive" : "outline"} disabled={isPending} onClick={remove}>
            {confirmingDelete ? "Elimina davvero" : "Elimina"}
          </Button>
          <Button size="lg" disabled={!canSave} onClick={save}>
            Salva
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
