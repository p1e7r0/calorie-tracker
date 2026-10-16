"use client";

import { MinusIcon, PlusIcon, XIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { createRecipe, type RecipeInput, updateRecipe } from "@/app/actions/recipes";
import { ScreenBody, ScreenFooter } from "@/components/app-shell/screen";
import { MacroLine } from "@/components/diary/macro-line";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { formatDecimal, formatGrams, formatKcal, parseDecimal } from "@/lib/nutrition/format";
import type { Nutrients } from "@/lib/nutrition/nutrients";
import { computeRecipeNutrition } from "@/lib/nutrition/recipe";
import type { LoggableFood } from "@/server/loggable";
import { IngredientPicker } from "./ingredient-picker";

export type EditableIngredient = {
  key: string;
  foodId: string;
  name: string;
  unit: "g" | "ml";
  grams: string;
  per100: Nutrients;
};

export type RecipeEditorValues = {
  name: string;
  servings: number;
  cookedWeight: string;
  ingredients: EditableIngredient[];
};

function nextKey() {
  return Math.random().toString(36).slice(2);
}

export function RecipeEditor({
  recipeId,
  initialValues,
  suggestions,
}: {
  recipeId?: string;
  initialValues: RecipeEditorValues;
  suggestions: LoggableFood[];
}) {
  const router = useRouter();
  const [values, setValues] = useState(initialValues);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const parsedIngredients = values.ingredients.map((ingredient) => ({
    ...ingredient,
    gramsValue: parseDecimal(ingredient.grams) ?? 0,
  }));
  const nutrition = computeRecipeNutrition({
    ingredients: parsedIngredients.map((ingredient) => ({ grams: ingredient.gramsValue, per100: ingredient.per100 })),
    cookedWeightG: parseDecimal(values.cookedWeight),
    servings: values.servings,
  });

  function update<Key extends keyof RecipeEditorValues>(field: Key, value: RecipeEditorValues[Key]) {
    setValues((current) => ({ ...current, [field]: value }));
  }

  function save() {
    setErrorMessage(null);
    const input: RecipeInput = {
      name: values.name,
      servings: values.servings,
      cookedWeightG: parseDecimal(values.cookedWeight),
      ingredients: parsedIngredients
        .filter((ingredient) => ingredient.gramsValue > 0)
        .map((ingredient) => ({ foodId: ingredient.foodId, grams: ingredient.gramsValue })),
    };
    startTransition(async () => {
      const result = recipeId ? await updateRecipe(recipeId, input) : await createRecipe(input);
      if (!result.ok) {
        setErrorMessage(result.error);
        return;
      }
      toast.success("Ricetta salvata");
      router.replace(`/recipes/${result.data.id}`);
    });
  }

  return (
    <>
      <ScreenBody className="flex flex-col gap-5">
        <Field>
          <FieldLabel htmlFor="recipe-name">Nome</FieldLabel>
          <Input
            id="recipe-name"
            value={values.name}
            placeholder="Lasagne della domenica"
            autoFocus={!values.name}
            onChange={(event) => update("name", event.target.value)}
          />
        </Field>

        <section aria-labelledby="ingredients-heading">
          <div className="flex items-baseline justify-between">
            <h2 id="ingredients-heading" className="font-heading text-lg font-semibold tracking-tight">
              Ingredienti
            </h2>
            <span className="text-sm text-muted-foreground">pesati a crudo</span>
          </div>
          {values.ingredients.length === 0 ? (
            <p className="py-3 text-sm text-muted-foreground">Aggiungi gli ingredienti con il loro peso.</p>
          ) : (
            <ul className="mt-1 divide-y">
              {parsedIngredients.map((ingredient, index) => (
                <li key={ingredient.key} className="flex items-center gap-2 py-2">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate">{ingredient.name}</span>
                    <span className="block text-sm text-muted-foreground">
                      {formatKcal((ingredient.per100.kcal * ingredient.gramsValue) / 100)} kcal
                    </span>
                  </span>
                  <div className="relative w-24 shrink-0">
                    <Input
                      aria-label={`Grammi di ${ingredient.name}`}
                      inputMode="decimal"
                      value={ingredient.grams}
                      className="pr-7 text-right"
                      onChange={(event) =>
                        update(
                          "ingredients",
                          values.ingredients.map((current, currentIndex) =>
                            currentIndex === index ? { ...current, grams: event.target.value } : current,
                          ),
                        )
                      }
                    />
                    <span className="pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2 text-sm text-muted-foreground">
                      {ingredient.unit}
                    </span>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Rimuovi ${ingredient.name}`}
                    onClick={() =>
                      update(
                        "ingredients",
                        values.ingredients.filter((_, currentIndex) => currentIndex !== index),
                      )
                    }
                  >
                    <XIcon />
                  </Button>
                </li>
              ))}
            </ul>
          )}
          <Button variant="outline" className="mt-2" onClick={() => setPickerOpen(true)}>
            <PlusIcon />
            Aggiungi ingrediente
          </Button>
        </section>

        <section className="grid grid-cols-2 gap-3">
          <Field>
            <FieldLabel htmlFor="recipe-cooked-weight">Peso da cotto</FieldLabel>
            <div className="relative">
              <Input
                id="recipe-cooked-weight"
                inputMode="decimal"
                placeholder={formatGrams(nutrition.rawWeightG)}
                value={values.cookedWeight}
                className="pr-7"
                onChange={(event) => update("cookedWeight", event.target.value)}
              />
              <span className="pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2 text-sm text-muted-foreground">
                g
              </span>
            </div>
            <FieldDescription className="text-xs">Il peso del piatto finito, tolta la pentola.</FieldDescription>
          </Field>
          <Field>
            <FieldLabel id="recipe-servings-label">Porzioni</FieldLabel>
            <div className="flex h-10 items-center justify-between rounded-lg border" role="group" aria-labelledby="recipe-servings-label">
              <Button
                variant="ghost"
                size="icon"
                aria-label="Una porzione in meno"
                disabled={values.servings <= 1}
                onClick={() => update("servings", Math.max(1, values.servings - 1))}
              >
                <MinusIcon />
              </Button>
              <span className="font-medium" aria-live="polite">
                {values.servings}
              </span>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Una porzione in più"
                disabled={values.servings >= 100}
                onClick={() => update("servings", Math.min(100, values.servings + 1))}
              >
                <PlusIcon />
              </Button>
            </div>
          </Field>
        </section>

        <section aria-label="Valori della ricetta" className="rounded-2xl bg-card p-4 ring-1 ring-border">
          <div className="grid grid-cols-3 gap-3">
            <Stat label="Totale" value={`${formatKcal(nutrition.total.kcal)}`} unit="kcal" />
            <Stat label="A porzione" value={`${formatKcal(nutrition.perServing.kcal)}`} unit="kcal" />
            <Stat label="Per 100 g" value={`${formatKcal(nutrition.per100g.kcal)}`} unit="kcal" />
          </div>
          <MacroLine nutrients={nutrition.perServing} className="mt-3" />
          <p className="mt-2 text-xs text-muted-foreground">
            Peso finale {formatGrams(nutrition.finalWeightG)} g
            {parseDecimal(values.cookedWeight) ? ` (crudo ${formatGrams(nutrition.rawWeightG)} g)` : ", uguale al crudo"}.
            Una porzione pesa {formatDecimal(nutrition.finalWeightG / nutrition.servings)} g.
          </p>
        </section>

        {errorMessage ? <FieldError>{errorMessage}</FieldError> : null}
      </ScreenBody>

      <ScreenFooter className="flex items-center gap-3">
        <p className="min-w-0 flex-1 text-sm leading-tight">
          <span className="block font-heading text-lg font-semibold">{formatKcal(nutrition.perServing.kcal)} kcal</span>
          <span className="text-muted-foreground">a porzione</span>
        </p>
        <Button size="lg" onClick={save} disabled={isPending}>
          {recipeId ? "Salva ricetta" : "Crea ricetta"}
        </Button>
      </ScreenFooter>

      {pickerOpen ? (
        <IngredientPicker
          suggestions={suggestions}
          onOpenChange={setPickerOpen}
          onPick={({ food, grams }) => {
            update("ingredients", [
              ...values.ingredients,
              {
                key: nextKey(),
                foodId: food.id,
                name: food.brand ? `${food.name}, ${food.brand}` : food.name,
                unit: food.unit,
                grams: formatDecimal(grams).replace(/\./g, ""),
                per100: food.per100,
              },
            ]);
            setPickerOpen(false);
          }}
        />
      ) : null}
    </>
  );
}

function Stat({ label, value, unit }: { label: string; value: string; unit: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-heading text-xl font-semibold tracking-tight">
        {value} <span className="text-xs font-medium text-muted-foreground">{unit}</span>
      </p>
    </div>
  );
}
