"use client";

import { PlusIcon, Trash2Icon, UtensilsIcon, XIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";
import { toast } from "sonner";
import { createStoredMeal, deleteStoredMeal, updateStoredMeal } from "@/app/actions/stored-meals";
import { ScreenBody, ScreenFooter } from "@/components/app-shell/screen";
import { MacroLine } from "@/components/diary/macro-line";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button, buttonVariants } from "@/components/ui/button";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { describeEntryQuantity } from "@/lib/nutrition/entry-quantity";
import { formatKcal } from "@/lib/nutrition/format";
import { sumNutrients } from "@/lib/nutrition/nutrients";
import {
  isStoredMealOld,
  type StorageLocation,
  storageLimitDays,
} from "@/lib/nutrition/stored-meals";
import { cn } from "@/lib/utils";
import type { LoggableItem } from "@/server/loggable";
import type { StoredMealView } from "@/server/stored-meals";
import { PortionsStepper, StorageLocationPicker } from "./stored-meal-fields";
import { type PickedStoredMealItem, StoredMealItemPicker } from "./stored-meal-item-picker";

type AddedItem = PickedStoredMealItem & { key: string };

const listHref = "/food?tab=meals";

function nextKey() {
  return Math.random().toString(36).slice(2);
}

function describeAddedQuantity({ source, item }: PickedStoredMealItem) {
  if (item.type === "quick") return null;
  return describeEntryQuantity({
    kind: item.type,
    grams: item.grams ?? null,
    servings: item.type === "recipe" ? (item.servings ?? null) : null,
    portionLabel: item.type === "food" ? (item.portionLabel ?? null) : null,
    unit: source.type === "food" ? source.unit : "g",
  });
}

export function StoredMealEditor(properties: {
  storedMeal: StoredMealView | null;
  today: string;
  suggestions: LoggableItem[];
}) {
  const { bfcacheId } = useRouter();
  return <StoredMealEditorContent key={bfcacheId} {...properties} />;
}

function StoredMealEditorContent({
  storedMeal,
  today,
  suggestions,
}: {
  storedMeal: StoredMealView | null;
  today: string;
  suggestions: LoggableItem[];
}) {
  const router = useRouter();
  const [name, setName] = useState(storedMeal?.name ?? "");
  const [location, setLocation] = useState<StorageLocation>(storedMeal?.location ?? "fridge");
  const [preparedOn, setPreparedOn] = useState(storedMeal?.preparedOn ?? today);
  const [portions, setPortions] = useState(storedMeal?.portions ?? 1);
  const [removedItemIds, setRemovedItemIds] = useState<string[]>([]);
  const [addedItems, setAddedItems] = useState<AddedItem[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const locationLabelId = useId();
  const portionsLabelId = useId();

  const keptItems = (storedMeal?.items ?? []).filter((item) => !removedItemIds.includes(item.id));
  const perPortion = sumNutrients([
    ...keptItems.map((item) => item.nutrients),
    ...addedItems.map((item) => item.nutrients),
  ]);
  const itemCount = keptItems.length + addedItems.length;
  const isOld = isStoredMealOld(location, preparedOn, today);
  const hasChanges =
    !storedMeal ||
    name.trim() !== storedMeal.name ||
    location !== storedMeal.location ||
    preparedOn !== storedMeal.preparedOn ||
    portions !== storedMeal.portions ||
    removedItemIds.length > 0 ||
    addedItems.length > 0;
  const canSave = !isPending && name.trim() !== "" && itemCount > 0 && preparedOn !== "" && preparedOn <= today;

  function save() {
    if (!canSave) return;
    startTransition(async () => {
      const values = { name, location, preparedOn, portions };
      const result = storedMeal
        ? await updateStoredMeal({
            ...values,
            storedMealId: storedMeal.id,
            removedItemIds,
            addedItems: addedItems.map((added) => added.item),
          })
        : await createStoredMeal({ ...values, items: addedItems.map((added) => added.item) });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(
        storedMeal
          ? "Modifiche salvate"
          : `«${name.trim()}» ${location === "freezer" ? "nel congelatore" : "in frigo"}`,
      );
      router.replace(listHref);
    });
  }

  function remove() {
    if (!storedMeal) return;
    startTransition(async () => {
      const result = await deleteStoredMeal(storedMeal.id);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Pasto eliminato");
      router.replace(listHref);
    });
  }

  return (
    <>
      <ScreenBody>
        <form
          className="flex flex-col gap-5"
          onSubmit={(event) => {
            event.preventDefault();
            save();
          }}
        >
          <Field>
            <FieldLabel htmlFor="stored-meal-name">Nome</FieldLabel>
            <Input
              id="stored-meal-name"
              placeholder="Es. Lasagna con insalata"
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </Field>
          <Field>
            <FieldLabel id={locationLabelId}>Dove</FieldLabel>
            <StorageLocationPicker value={location} onValueChange={setLocation} labelId={locationLabelId} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field>
              <FieldLabel htmlFor="stored-meal-prepared-on">Preparato il</FieldLabel>
              <Input
                id="stored-meal-prepared-on"
                type="date"
                max={today}
                value={preparedOn}
                onChange={(event) => setPreparedOn(event.target.value)}
              />
            </Field>
            <Field>
              <FieldLabel id={portionsLabelId}>Porzioni</FieldLabel>
              <PortionsStepper value={portions} onValueChange={setPortions} labelId={portionsLabelId} />
            </Field>
          </div>
          {preparedOn && preparedOn <= today ? (
            <FieldDescription className={cn("-mt-3 text-xs", isOld && "text-over-text")}>
              {isOld
                ? `Da più di ${
                    location === "freezer" ? "3 mesi in congelatore" : `${storageLimitDays.fridge} giorni in frigo`
                  }: controlla prima di mangiarlo.`
                : "Ogni porzione che registri ne toglie una; quando finiscono il pasto sparisce."}
            </FieldDescription>
          ) : null}
          <section>
            <div className="flex items-baseline justify-between">
              <h2 className="font-heading text-lg font-semibold tracking-tight">Una porzione contiene</h2>
              <span className="text-sm font-medium">{formatKcal(perPortion.kcal)} kcal</span>
            </div>
            {itemCount > 0 ? (
              <ul className="mt-1 divide-y">
                {keptItems.map((item) => (
                  <ItemRow
                    key={item.id}
                    name={item.label}
                    quantity={describeEntryQuantity(item)}
                    kcal={item.nutrients.kcal}
                    onRemove={() => setRemovedItemIds((current) => [...current, item.id])}
                  />
                ))}
                {addedItems.map((added) => (
                  <ItemRow
                    key={added.key}
                    name={added.source.name}
                    quantity={describeAddedQuantity(added)}
                    kcal={added.nutrients.kcal}
                    onRemove={() => setAddedItems((current) => current.filter((item) => item.key !== added.key))}
                  />
                ))}
              </ul>
            ) : (
              <p className="py-3 text-sm text-muted-foreground">
                Aggiungi gli alimenti e le ricette di una porzione, con le quantità che ci sono nel contenitore.
              </p>
            )}
            <MacroLine nutrients={perPortion} className="mt-2" />
            <Button type="button" variant="outline" className="mt-3 w-full" onClick={() => setPickerOpen(true)}>
              <PlusIcon />
              Aggiungi alimento o ricetta
            </Button>
          </section>
          <button type="submit" hidden />
        </form>
      </ScreenBody>
      <ScreenFooter className="flex gap-2">
        {storedMeal ? (
          <AlertDialog>
            <AlertDialogTrigger
              render={<Button variant="destructive" size="lg" disabled={isPending} aria-label="Elimina pasto" />}
            >
              <Trash2Icon />
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Eliminare «{storedMeal.name}»?</AlertDialogTitle>
                <AlertDialogDescription>
                  Usalo se l&apos;hai buttato. Le porzioni già registrate nel diario restano.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Annulla</AlertDialogCancel>
                <AlertDialogAction variant="destructive" disabled={isPending} onClick={remove}>
                  Elimina
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        ) : null}
        {storedMeal && !hasChanges ? (
          <Link href={`/add?storedMeal=${storedMeal.id}`} className={cn(buttonVariants({ size: "lg" }), "flex-1")}>
            <UtensilsIcon />
            Mangia una porzione
          </Link>
        ) : (
          <Button size="lg" className="flex-1" onClick={save} disabled={!canSave}>
            {storedMeal ? "Salva" : "Metti da parte"}
          </Button>
        )}
      </ScreenFooter>
      {pickerOpen ? (
        <StoredMealItemPicker
          suggestions={suggestions}
          onOpenChange={setPickerOpen}
          onPick={(picked) => {
            setAddedItems((current) => [...current, { ...picked, key: nextKey() }]);
            setPickerOpen(false);
          }}
        />
      ) : null}
    </>
  );
}

function ItemRow({
  name,
  quantity,
  kcal,
  onRemove,
}: {
  name: string;
  quantity: string | null;
  kcal: number;
  onRemove: () => void;
}) {
  return (
    <li className="flex items-center gap-2 py-2">
      <span className="min-w-0 flex-1">
        <span className="block truncate">{name}</span>
        <span className="block text-sm text-muted-foreground">
          {[quantity, `${formatKcal(kcal)} kcal`].filter(Boolean).join(", ")}
        </span>
      </span>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="touch-target"
        aria-label={`Rimuovi ${name}`}
        onClick={onRemove}
      >
        <XIcon />
      </Button>
    </li>
  );
}
