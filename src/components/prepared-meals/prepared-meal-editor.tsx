"use client";

import { ChefHatIcon, PlusIcon, Trash2Icon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { deletePreparedMeal, updatePreparedMeal } from "@/app/actions/prepared-meals";
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
import { formatDayWithArticle } from "@/lib/nutrition/days";
import { describeEntryQuantity } from "@/lib/nutrition/entry-quantity";
import { formatKcal } from "@/lib/nutrition/format";
import { describeStorage } from "@/lib/nutrition/prepared-meals";
import { cn } from "@/lib/utils";
import type { PreparedMealView } from "@/server/prepared-meals";
import { PortionsStepper, StorageLocationPicker } from "./storage-controls";

export function PreparedMealEditor({ preparedMeal, today }: { preparedMeal: PreparedMealView; today: string }) {
  const { bfcacheId } = useRouter();
  return <PreparedMealEditorContent key={bfcacheId} preparedMeal={preparedMeal} today={today} />;
}

function PreparedMealEditorContent({ preparedMeal, today }: { preparedMeal: PreparedMealView; today: string }) {
  const router = useRouter();
  const [name, setName] = useState(preparedMeal.name);
  const [location, setLocation] = useState(preparedMeal.location);
  const [portions, setPortions] = useState(preparedMeal.portions);
  const [isPending, startTransition] = useTransition();
  const storage = describeStorage(preparedMeal.location, preparedMeal.storedOn, today);
  const hasChanges =
    name.trim() !== preparedMeal.name || location !== preparedMeal.location || portions !== preparedMeal.portions;

  function save() {
    startTransition(async () => {
      const result = await updatePreparedMeal({ preparedMealId: preparedMeal.id, name, location, portions });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Pasto pronto salvato");
      router.replace("/food?tab=prepared");
    });
  }

  function remove() {
    startTransition(async () => {
      const result = await deletePreparedMeal(preparedMeal.id);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Pasto pronto eliminato");
      router.replace("/food?tab=prepared");
    });
  }

  return (
    <>
      <ScreenBody>
        <div className="flex flex-col gap-5">
          <Field>
            <FieldLabel htmlFor="prepared-meal-name">Nome</FieldLabel>
            <Input id="prepared-meal-name" value={name} onChange={(event) => setName(event.target.value)} />
          </Field>
          <Field>
            <FieldLabel id="prepared-meal-location-label">Dove si trova</FieldLabel>
            <StorageLocationPicker
              value={location}
              onValueChange={setLocation}
              labelledBy="prepared-meal-location-label"
            />
            <FieldDescription>
              {location === preparedMeal.location ? (
                <>
                  <span className={cn(storage.isOld && "text-over-text")}>{storage.label}</span>
                  {storage.days >= 2
                    ? `, ${formatDayWithArticle(preparedMeal.storedOn, today).replace(/^il /, "dal ").replace(/^l'/, "dall'")}`
                    : ""}
                  .
                </>
              ) : location === "fridge" ? (
                "Salvando, lo sposti in frigo da oggi."
              ) : (
                "Salvando, lo sposti in congelatore da oggi."
              )}
            </FieldDescription>
          </Field>
          <Field>
            <FieldLabel id="prepared-meal-portions-label">Porzioni rimaste</FieldLabel>
            <PortionsStepper value={portions} onValueChange={setPortions} labelledBy="prepared-meal-portions-label" />
          </Field>
          <section aria-labelledby="prepared-meal-items-heading">
            <div className="flex items-baseline justify-between">
              <h2 id="prepared-meal-items-heading" className="font-heading text-lg font-semibold tracking-tight">
                In una porzione
              </h2>
              <span className="text-sm font-medium tabular-nums">{formatKcal(preparedMeal.totals.kcal)} kcal</span>
            </div>
            <ul className="mt-1 divide-y">
              {preparedMeal.items.map((item) => (
                <li key={item.id} className="py-2">
                  <span className="flex items-center gap-1.5">
                    {item.kind === "recipe" ? (
                      <ChefHatIcon className="size-4 shrink-0 text-muted-foreground" aria-label="Ricetta" />
                    ) : null}
                    <span className="truncate">{item.label}</span>
                  </span>
                  <span className="block text-sm text-muted-foreground">
                    {describeEntryQuantity(item)}, {formatKcal(item.nutrients.kcal)} kcal
                  </span>
                </li>
              ))}
            </ul>
            <MacroLine nutrients={preparedMeal.totals} className="mt-2" />
            <p className="mt-3 text-xs text-muted-foreground">
              I valori sono quelli del giorno in cui l&apos;hai preparato: se poi modifichi la ricetta, questo pasto non
              cambia.
            </p>
          </section>
        </div>
      </ScreenBody>
      <ScreenFooter className="flex gap-2">
        <AlertDialog>
          <AlertDialogTrigger
            render={<Button variant="destructive" size="lg" disabled={isPending} aria-label="Elimina pasto pronto" />}
          >
            <Trash2Icon />
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Eliminare «{preparedMeal.name}»?</AlertDialogTitle>
              <AlertDialogDescription>
                Lo togli dal frigo e dal congelatore. Le voci già registrate nel diario restano invariate.
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
        {hasChanges ? (
          <Button size="lg" className="flex-1" onClick={save} disabled={isPending || !name.trim()}>
            Salva
          </Button>
        ) : (
          <Link href={`/add?preparedMeal=${preparedMeal.id}`} className={cn(buttonVariants({ size: "lg" }), "flex-1")}>
            <PlusIcon />
            Aggiungi al diario
          </Link>
        )}
      </ScreenFooter>
    </>
  );
}
