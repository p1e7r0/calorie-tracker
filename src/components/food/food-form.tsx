"use client";

import { ChevronDownIcon, PlusIcon, XIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { createFood, type FoodInput, updateFood } from "@/app/actions/foods";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { formatKcal, parseDecimal } from "@/lib/nutrition/format";
import { kcalFromMacros } from "@/lib/nutrition/nutrients";
import { cn } from "@/lib/utils";
import type { NutritionLabel } from "@/lib/ai-schemas";
import { type FoodFormValues, type NutrientField, toFormNumber } from "./food-form-values";
import { LabelPhotoButton } from "./label-photo-button";

const mainNutrients: { field: NutrientField; label: string }[] = [
  { field: "protein", label: "Proteine" },
  { field: "carbs", label: "Carboidrati" },
  { field: "fat", label: "Grassi" },
];

const otherNutrients: { field: NutrientField; label: string }[] = [
  { field: "sugars", label: "di cui zuccheri" },
  { field: "saturatedFat", label: "di cui saturi" },
  { field: "fiber", label: "Fibre" },
  { field: "salt", label: "Sale" },
];

type FoodFormProperties = {
  foodId?: string;
  initialValues: FoodFormValues;
  submitLabel: string;
  redirectTo?: string;
  isGlobalCopy?: boolean;
  aiEnabled?: boolean;
};

export function FoodForm(properties: FoodFormProperties) {
  const { bfcacheId } = useRouter();
  return <FoodFormContent key={bfcacheId} {...properties} />;
}

function FoodFormContent({
  foodId,
  initialValues,
  submitLabel,
  redirectTo,
  isGlobalCopy = false,
  aiEnabled = false,
}: FoodFormProperties) {
  const router = useRouter();
  const [values, setValues] = useState(initialValues);
  const [showOtherNutrients, setShowOtherNutrients] = useState(
    otherNutrients.some((nutrient) => initialValues[nutrient.field] !== ""),
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function applyLabel(label: NutritionLabel) {
    setValues((current) => ({
      ...current,
      name: current.name || label.name || "",
      brand: current.brand || label.brand || "",
      unit: label.unit,
      kcal: toFormNumber(label.per100.kcal),
      protein: toFormNumber(label.per100.protein),
      carbs: toFormNumber(label.per100.carbs),
      sugars: toFormNumber(label.per100.sugars),
      fat: toFormNumber(label.per100.fat),
      saturatedFat: toFormNumber(label.per100.saturatedFat),
      fiber: toFormNumber(label.per100.fiber),
      salt: toFormNumber(label.per100.salt),
      portions:
        label.portion && !current.portions.some((portion) => portion.label === label.portion?.label)
          ? [...current.portions, { label: label.portion.label, grams: toFormNumber(label.portion.grams) }]
          : current.portions,
    }));
    setShowOtherNutrients(
      [label.per100.sugars, label.per100.saturatedFat, label.per100.fiber, label.per100.salt].some(
        (value) => value !== null,
      ),
    );
  }

  const protein = parseDecimal(values.protein) ?? 0;
  const carbs = parseDecimal(values.carbs) ?? 0;
  const fat = parseDecimal(values.fat) ?? 0;
  const estimatedKcal = kcalFromMacros({ protein, carbs, fat });
  const typedKcal = parseDecimal(values.kcal);

  function update<Key extends keyof FoodFormValues>(field: Key, value: FoodFormValues[Key]) {
    setValues((current) => ({ ...current, [field]: value }));
  }

  function submit() {
    setErrorMessage(null);
    const kcal = typedKcal ?? (estimatedKcal > 0 ? Math.round(estimatedKcal) : null);
    if (!values.name.trim()) {
      setErrorMessage("Dai un nome all'alimento.");
      return;
    }
    if (kcal === null) {
      setErrorMessage("Inserisci le kcal o i macronutrienti per 100 g.");
      return;
    }
    const input: FoodInput = {
      name: values.name,
      brand: values.brand || null,
      barcode: values.barcode || null,
      unit: values.unit,
      kcal,
      protein,
      carbs,
      fat,
      sugars: parseDecimal(values.sugars),
      saturatedFat: parseDecimal(values.saturatedFat),
      fiber: parseDecimal(values.fiber),
      salt: parseDecimal(values.salt),
      portions: values.portions
        .map((portion) => ({ label: portion.label.trim(), grams: parseDecimal(portion.grams) ?? 0 }))
        .filter((portion) => portion.label && portion.grams > 0),
    };
    startTransition(async () => {
      const result = foodId ? await updateFood(foodId, input) : await createFood(input);
      if (!result.ok) {
        setErrorMessage(result.error);
        return;
      }
      toast.success(foodId ? "Alimento salvato" : "Alimento creato");
      if (redirectTo) {
        const separator = redirectTo.includes("?") ? "&" : "?";
        router.replace(`${redirectTo}${separator}food=${result.data.id}`);
      } else {
        router.replace(`/food/${result.data.id}`);
      }
    });
  }

  return (
    <form
      className="pb-8"
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      <FieldGroup className="gap-4">
        {aiEnabled && !isGlobalCopy ? <LabelPhotoButton onRead={applyLabel} /> : null}
        {isGlobalCopy ? (
          <p className="rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">
            Questo alimento fa parte del catalogo comune. Le modifiche creano una tua copia personale, che userai al
            posto dell&apos;originale.
          </p>
        ) : null}
        <Field>
          <FieldLabel htmlFor="food-name">Nome</FieldLabel>
          <Input
            id="food-name"
            value={values.name}
            autoFocus={!values.name}
            onChange={(event) => update("name", event.target.value)}
            placeholder="Yogurt greco 0%"
          />
        </Field>
        <div className="grid grid-cols-[1fr_auto] items-end gap-3">
          <Field>
            <FieldLabel htmlFor="food-brand">Marca</FieldLabel>
            <Input
              id="food-brand"
              value={values.brand}
              onChange={(event) => update("brand", event.target.value)}
              placeholder="Facoltativa"
            />
          </Field>
          <ToggleGroup
            variant="outline"
            spacing={0}
            value={[values.unit]}
            onValueChange={(selected) => {
              const [unit] = selected;
              if (unit === "g" || unit === "ml") update("unit", unit);
            }}
            aria-label="Unità"
          >
            <ToggleGroupItem value="g" className="h-10 px-4">
              g
            </ToggleGroupItem>
            <ToggleGroupItem value="ml" className="h-10 px-4">
              ml
            </ToggleGroupItem>
          </ToggleGroup>
        </div>

        <fieldset className="flex flex-col gap-3">
          <legend className="mb-3 text-sm font-medium">Valori per 100 {values.unit}</legend>
          <Field>
            <FieldLabel htmlFor="food-kcal">Kcal</FieldLabel>
            <Input
              id="food-kcal"
              inputMode="decimal"
              className="h-12 text-xl font-semibold"
              value={values.kcal}
              placeholder={estimatedKcal > 0 ? formatKcal(estimatedKcal) : ""}
              onChange={(event) => update("kcal", event.target.value)}
            />
            {typedKcal === null && estimatedKcal > 0 ? (
              <FieldDescription>Se la lasci vuota uso {formatKcal(estimatedKcal)} kcal, calcolate dai macro.</FieldDescription>
            ) : null}
          </Field>
          <div className="grid grid-cols-3 gap-2">
            {mainNutrients.map((nutrient) => (
              <NutrientInput
                key={nutrient.field}
                id={`food-${nutrient.field}`}
                label={nutrient.label}
                value={values[nutrient.field]}
                onChange={(value) => update(nutrient.field, value)}
              />
            ))}
          </div>
          <button
            type="button"
            onClick={() => setShowOtherNutrients((current) => !current)}
            className="flex w-fit items-center gap-1 text-sm font-medium text-muted-foreground"
            aria-expanded={showOtherNutrients}
          >
            Zuccheri, saturi, fibre e sale
            <ChevronDownIcon className={cn("size-4 transition-transform", showOtherNutrients && "rotate-180")} />
          </button>
          {showOtherNutrients ? (
            <div className="grid grid-cols-2 gap-2">
              {otherNutrients.map((nutrient) => (
                <NutrientInput
                  key={nutrient.field}
                  id={`food-${nutrient.field}`}
                  label={nutrient.label}
                  value={values[nutrient.field]}
                  onChange={(value) => update(nutrient.field, value)}
                />
              ))}
            </div>
          ) : null}
        </fieldset>

        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 text-sm font-medium">Porzioni</legend>
          <p className="text-sm text-muted-foreground">Per esempio «1 vasetto = 125 g». Le ritrovi quando aggiungi l&apos;alimento.</p>
          {values.portions.map((portion, index) => (
            <div key={index} className="grid grid-cols-[1fr_6rem_auto] gap-2">
              <Input
                aria-label="Nome della porzione"
                placeholder="1 vasetto"
                value={portion.label}
                onChange={(event) =>
                  update(
                    "portions",
                    values.portions.map((current, currentIndex) =>
                      currentIndex === index ? { ...current, label: event.target.value } : current,
                    ),
                  )
                }
              />
              <Input
                aria-label={`Grammi della porzione ${index + 1}`}
                inputMode="decimal"
                placeholder={values.unit}
                value={portion.grams}
                onChange={(event) =>
                  update(
                    "portions",
                    values.portions.map((current, currentIndex) =>
                      currentIndex === index ? { ...current, grams: event.target.value } : current,
                    ),
                  )
                }
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-10"
                aria-label="Rimuovi porzione"
                onClick={() => update("portions", values.portions.filter((_, currentIndex) => currentIndex !== index))}
              >
                <XIcon />
              </Button>
            </div>
          ))}
          <Button
            type="button"
            variant="outline"
            className="w-fit"
            onClick={() => update("portions", [...values.portions, { label: "", grams: "" }])}
          >
            <PlusIcon />
            Aggiungi porzione
          </Button>
        </fieldset>

        {errorMessage ? <FieldError>{errorMessage}</FieldError> : null}
        <Button type="submit" size="lg" disabled={isPending}>
          {submitLabel}
        </Button>
      </FieldGroup>
    </form>
  );
}

function NutrientInput({
  id,
  label,
  value,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <Field className="gap-1.5">
      <FieldLabel htmlFor={id} className="text-xs text-muted-foreground">
        {label}
      </FieldLabel>
      <div className="relative">
        <Input id={id} inputMode="decimal" value={value} onChange={(event) => onChange(event.target.value)} className="pr-6" />
        <span className="pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2 text-sm text-muted-foreground">
          g
        </span>
      </div>
    </Field>
  );
}
