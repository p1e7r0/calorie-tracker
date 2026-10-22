"use client";

import { CheckIcon, PlusIcon } from "lucide-react";
import { useState, useTransition } from "react";
import { createCookware } from "@/app/actions/cookware";
import { CookwareFields } from "@/components/cookware/cookware-fields";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { type CookwareView, netCookedWeight, parseWeightGrams } from "@/lib/nutrition/cookware";
import { formatGrams } from "@/lib/nutrition/format";

const lastCookwareKey = "bilancia:last-cookware";

function readLastCookwareId() {
  try {
    return window.localStorage.getItem(lastCookwareKey);
  } catch {
    return null;
  }
}

function writeLastCookwareId(cookwareId: string) {
  try {
    window.localStorage.setItem(lastCookwareKey, cookwareId);
  } catch {}
}

export function CookedWeightDrawer({
  cookware,
  rawWeightG,
  onOpenChange,
  onApply,
}: {
  cookware: CookwareView[];
  rawWeightG: number;
  onOpenChange: (open: boolean) => void;
  onApply: (cookedWeightG: number) => void;
}) {
  const [created, setCreated] = useState<CookwareView[]>([]);
  const options = [...cookware, ...created.filter((item) => !cookware.some((existing) => existing.id === item.id))];
  const [selectedId, setSelectedId] = useState<string | null>(() => {
    const lastId = readLastCookwareId();
    return cookware.some((item) => item.id === lastId) ? lastId : (cookware[0]?.id ?? null);
  });
  const [creating, setCreating] = useState(cookware.length === 0);
  const [newCookware, setNewCookware] = useState({ name: "", weight: "" });
  const [total, setTotal] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const selected = options.find((item) => item.id === selectedId) ?? null;
  const totalWeightG = parseWeightGrams(total);
  const cookedWeightG = netCookedWeight(totalWeightG, selected?.weightG ?? null);

  function saveCookware() {
    setErrorMessage(null);
    startTransition(async () => {
      const input = { name: newCookware.name, weightG: parseWeightGrams(newCookware.weight) ?? Number.NaN };
      const result = await createCookware(input);
      if (!result.ok) {
        setErrorMessage(result.error);
        return;
      }
      setCreated((current) => [...current, { id: result.data.id, name: input.name.trim(), weightG: input.weightG }]);
      setSelectedId(result.data.id);
      setCreating(false);
      setNewCookware({ name: "", weight: "" });
    });
  }

  function apply() {
    if (cookedWeightG === null || !selected) return;
    writeLastCookwareId(selected.id);
    onApply(cookedWeightG);
  }

  return (
    <Drawer open onOpenChange={onOpenChange}>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle className="text-lg">Pesa con la pentola</DrawerTitle>
          <DrawerDescription>Pesa la pentola con dentro il piatto finito: Bilancia toglie la tara.</DrawerDescription>
        </DrawerHeader>
        <div className="flex flex-col gap-4 overflow-y-auto p-4">
          <div role="group" aria-label="Pentola" className="flex flex-wrap gap-2">
            {options.map((item) => {
              const isSelected = !creating && item.id === selectedId;
              return (
                <Button
                  key={item.id}
                  variant={isSelected ? "default" : "outline"}
                  aria-pressed={isSelected}
                  className="max-w-full"
                  onClick={() => {
                    setSelectedId(item.id);
                    setCreating(false);
                  }}
                >
                  {isSelected ? <CheckIcon /> : null}
                  <span className="truncate">{item.name}</span>
                  <span className={isSelected ? "opacity-80" : "text-muted-foreground"}>{formatGrams(item.weightG)} g</span>
                </Button>
              );
            })}
            <Button
              variant={creating ? "secondary" : "outline"}
              aria-pressed={creating}
              onClick={() => {
                setCreating(true);
                setErrorMessage(null);
              }}
            >
              <PlusIcon />
              Nuova pentola
            </Button>
          </div>

          {creating ? (
            <form
              className="flex flex-col gap-3 rounded-2xl bg-muted/60 p-3"
              onSubmit={(event) => {
                event.preventDefault();
                saveCookware();
              }}
            >
              <CookwareFields
                idPrefix="new-cookware"
                values={newCookware}
                autoFocus
                onChange={setNewCookware}
              />
              {errorMessage ? <FieldError>{errorMessage}</FieldError> : null}
              <Button type="submit" variant="outline" className="self-start" disabled={isPending}>
                Salva pentola
              </Button>
            </form>
          ) : (
            <form
              onSubmit={(event) => {
                event.preventDefault();
                apply();
              }}
            >
              <Field>
                <FieldLabel htmlFor="cookware-total-weight">Peso con la pentola</FieldLabel>
                <div className="relative">
                  <Input
                    id="cookware-total-weight"
                    inputMode="decimal"
                    autoFocus
                    className="h-12 pr-7 text-2xl font-semibold"
                    value={total}
                    onChange={(event) => setTotal(event.target.value)}
                  />
                  <span className="pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2 text-sm text-muted-foreground">
                    g
                  </span>
                </div>
                {totalWeightG !== null && selected && cookedWeightG === null ? (
                  <FieldError>Il peso deve superare quello della pentola ({formatGrams(selected.weightG)} g).</FieldError>
                ) : (
                  <FieldDescription aria-live="polite">
                    {cookedWeightG !== null
                      ? `Peso da cotto ${formatGrams(cookedWeightG)} g${rawWeightG > 0 ? `, crudo ${formatGrams(rawWeightG)} g` : ""}.`
                      : "Il piatto finito, con la pentola."}
                  </FieldDescription>
                )}
              </Field>
              <button type="submit" hidden />
            </form>
          )}
        </div>
        <DrawerFooter className="pb-[max(1rem,env(safe-area-inset-bottom))]">
          <Button size="lg" onClick={apply} disabled={creating || cookedWeightG === null}>
            {cookedWeightG !== null && !creating ? `Usa ${formatGrams(cookedWeightG)} g` : "Usa il peso"}
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
