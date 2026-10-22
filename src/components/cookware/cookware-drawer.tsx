"use client";

import { TrashIcon } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { createCookware, deleteCookware, updateCookware } from "@/app/actions/cookware";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { FieldError } from "@/components/ui/field";
import { type CookwareView, parseWeightGrams } from "@/lib/nutrition/cookware";
import { formatDecimal } from "@/lib/nutrition/format";
import { CookwareFields } from "./cookware-fields";

export function CookwareDrawer({
  cookware,
  onOpenChange,
}: {
  cookware?: CookwareView;
  onOpenChange: (open: boolean) => void;
}) {
  const [values, setValues] = useState({
    name: cookware?.name ?? "",
    weight: cookware ? formatDecimal(cookware.weightG).replace(/\./g, "") : "",
  });
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function save() {
    setErrorMessage(null);
    const input = { name: values.name, weightG: parseWeightGrams(values.weight) ?? Number.NaN };
    startTransition(async () => {
      const result = cookware
        ? await updateCookware({ cookwareId: cookware.id, ...input })
        : await createCookware(input);
      if (!result.ok) {
        setErrorMessage(result.error);
        return;
      }
      toast.success(cookware ? "Pentola salvata" : "Pentola aggiunta");
      onOpenChange(false);
    });
  }

  function remove() {
    if (!cookware) return;
    startTransition(async () => {
      const result = await deleteCookware(cookware.id);
      if (!result.ok) {
        setErrorMessage(result.error);
        return;
      }
      toast.success("Pentola eliminata");
      onOpenChange(false);
    });
  }

  return (
    <Drawer open onOpenChange={onOpenChange}>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle className="text-lg">{cookware ? "Modifica pentola" : "Nuova pentola"}</DrawerTitle>
          <DrawerDescription>Pesala vuota, senza coperchio se non lo userai sulla bilancia.</DrawerDescription>
        </DrawerHeader>
        <form
          className="flex flex-col gap-3 overflow-y-auto p-4"
          onSubmit={(event) => {
            event.preventDefault();
            save();
          }}
        >
          <CookwareFields idPrefix="cookware" values={values} autoFocus={!cookware} onChange={setValues} />
          {errorMessage ? <FieldError>{errorMessage}</FieldError> : null}
          <button type="submit" hidden />
        </form>
        <DrawerFooter className="pb-[max(1rem,env(safe-area-inset-bottom))]">
          <Button size="lg" onClick={save} disabled={isPending}>
            Salva pentola
          </Button>
          {cookware ? (
            <Button size="lg" variant="destructive" onClick={remove} disabled={isPending}>
              <TrashIcon />
              Elimina
            </Button>
          ) : null}
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
