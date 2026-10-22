"use client";

import { SnowflakeIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { createFreezerBatch } from "@/app/actions/freezer";
import { MacroLine } from "@/components/diary/macro-line";
import { gramsShortcut, QuantityField, type QuantityShortcut } from "@/components/diary/quantity-field";
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
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { todayIsoDate } from "@/lib/nutrition/days";
import { formatDecimal, formatKcal, parseDecimal } from "@/lib/nutrition/format";
import { maxFreezerPortions } from "@/lib/nutrition/freezer";
import { multiplyNutrients, scaleNutrients } from "@/lib/nutrition/nutrients";
import type { LoggableItem } from "@/server/loggable";
import { PortionStepper } from "./portion-stepper";

function toInputValue(value: number) {
  return formatDecimal(value).replace(/\./g, "");
}

export function FreezeButton({ item }: { item: LoggableItem }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="ghost" size="icon" aria-label="Metti in congelatore" onClick={() => setOpen(true)}>
        <SnowflakeIcon />
      </Button>
      {open ? <FreezeDrawer item={item} onOpenChange={setOpen} /> : null}
    </>
  );
}

function FreezeDrawer({ item, onOpenChange }: { item: LoggableItem; onOpenChange: (open: boolean) => void }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [portions, setPortions] = useState(() =>
    item.type === "recipe" ? Math.min(maxFreezerPortions, Math.max(1, Math.round(item.servings))) : 1,
  );
  const [frozenOn, setFrozenOn] = useState(() => todayIsoDate());
  const [mode, setMode] = useState<"servings" | "grams">(item.type === "recipe" ? "servings" : "grams");
  const recipePortionGrams = item.type === "recipe" ? Math.round(item.finalWeightG / item.servings) : 0;
  const [quantity, setQuantity] = useState(() =>
    toInputValue(item.type === "recipe" ? 1 : (item.lastGrams ?? item.portions[0]?.grams ?? 100)),
  );
  const amount = parseDecimal(quantity);
  const unit = item.type === "food" ? item.unit : mode === "grams" ? "g" : "porz.";
  const perPortion =
    item.type === "recipe" && mode === "servings"
      ? multiplyNutrients(item.perServing, amount ?? 0)
      : scaleNutrients(item.per100, amount ?? 0);
  const canSave = !isPending && amount !== null && amount > 0 && frozenOn !== "";

  const shortcuts: QuantityShortcut[] =
    item.type === "food"
      ? item.portions.map((portion) => gramsShortcut(portion.label, portion.grams, item.unit, true))
      : mode === "servings"
        ? [
            { label: "½", value: 0.5 },
            { label: "1", value: 1 },
            { label: "2", value: 2 },
          ]
        : [gramsShortcut("1 porzione", recipePortionGrams, "g")];

  function save() {
    if (!canSave) return;
    startTransition(async () => {
      const result = await createFreezerBatch({
        item:
          item.type === "food"
            ? { type: "food", foodId: item.id, grams: amount }
            : {
                type: "recipe",
                recipeId: item.id,
                grams: mode === "grams" ? amount : null,
                servings: mode === "servings" ? amount : null,
              },
        portions,
        frozenOn,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(`Nel congelatore: «${item.name}», ${portions === 1 ? "1 porzione" : `${portions} porzioni`}`, {
        action: { label: "Vedi", onClick: () => router.push("/food?tab=freezer") },
      });
      onOpenChange(false);
    });
  }

  return (
    <Drawer open onOpenChange={onOpenChange}>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle className="text-lg leading-snug">Metti in congelatore</DrawerTitle>
          <DrawerDescription>
            {item.name}. I valori restano questi anche se poi modifichi {item.type === "recipe" ? "la ricetta" : "l'alimento"}.
          </DrawerDescription>
        </DrawerHeader>
        <form
          className="flex flex-col gap-4 overflow-y-auto p-4"
          onSubmit={(event) => {
            event.preventDefault();
            save();
          }}
        >
          <PortionStepper label="Porzioni" value={portions} minimum={1} onValueChange={setPortions} />
          {item.type === "recipe" && item.hasCookedWeight ? (
            <ToggleGroup
              variant="outline"
              spacing={0}
              value={[mode]}
              onValueChange={(values) => {
                const [selected] = values;
                if (!selected || selected === mode) return;
                setMode(selected as "servings" | "grams");
                setQuantity(selected === "servings" ? "1" : toInputValue(recipePortionGrams));
              }}
              className="w-full"
              aria-label="Unità della porzione"
            >
              <ToggleGroupItem value="servings" className="flex-1">
                Porzioni della ricetta
              </ToggleGroupItem>
              <ToggleGroupItem value="grams" className="flex-1">
                Grammi da cotto
              </ToggleGroupItem>
            </ToggleGroup>
          ) : null}
          <QuantityField
            label="Ogni porzione"
            unit={unit}
            value={quantity}
            step={unit === "porz." ? undefined : 10}
            shortcuts={shortcuts}
            onValueChange={(value) => setQuantity(value)}
          />
          <Field>
            <FieldLabel htmlFor="freezer-frozen-on">Congelato il</FieldLabel>
            <Input
              id="freezer-frozen-on"
              type="date"
              max={todayIsoDate()}
              value={frozenOn}
              onChange={(event) => setFrozenOn(event.target.value)}
            />
          </Field>
          <div className="flex items-center justify-between gap-3 rounded-xl bg-muted/60 px-3 py-2.5">
            <div className="flex flex-col gap-1">
              <span className="text-xs text-muted-foreground">A porzione</span>
              <MacroLine nutrients={perPortion} />
            </div>
            <span className="font-heading text-xl font-semibold">
              {formatKcal(perPortion.kcal)} <span className="text-sm font-medium text-muted-foreground">kcal</span>
            </span>
          </div>
          <button type="submit" hidden />
        </form>
        <DrawerFooter className="pb-[max(1rem,env(safe-area-inset-bottom))]">
          <Button size="lg" disabled={!canSave} onClick={save}>
            <SnowflakeIcon />
            Metti {portions === 1 ? "1 porzione" : `${portions} porzioni`} in congelatore
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
