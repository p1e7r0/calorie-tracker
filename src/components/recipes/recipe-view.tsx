"use client";

import { MinusIcon, PencilIcon, PlusIcon } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { ScreenBody, ScreenFooter } from "@/components/app-shell/screen";
import { MacroLine } from "@/components/diary/macro-line";
import { Button, buttonVariants } from "@/components/ui/button";
import { formatDecimal, formatGrams, formatKcal } from "@/lib/nutrition/format";
import { multiplyNutrients, scaleNutrients } from "@/lib/nutrition/nutrients";
import { computeRecipeNutrition } from "@/lib/nutrition/recipe";
import type { RecipeForEditing } from "@/server/recipes";

export function RecipeView({ recipe }: { recipe: RecipeForEditing }) {
  const nutrition = computeRecipeNutrition({
    ingredients: recipe.ingredients,
    cookedWeightG: recipe.cookedWeightG,
    servings: recipe.servings,
    servingGrams: recipe.servingGrams,
  });
  const [portions, setPortions] = useState(nutrition.servings);
  const factor = portions / nutrition.servings;

  return (
    <>
      <ScreenBody className="flex flex-col gap-5">
        <div>
          <h1 className="font-heading text-2xl leading-tight font-semibold tracking-tight">{recipe.name}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {recipe.servingGrams
              ? `Porzioni da ${formatGrams(nutrition.servingWeightG)} g (circa ${formatDecimal(nutrition.servings)})`
              : `${recipe.servings} ${recipe.servings === 1 ? "porzione" : "porzioni"} da ${formatGrams(nutrition.servingWeightG)} g`}
            {recipe.cookedWeightG ? `, ${formatGrams(nutrition.finalWeightG)} g da cotto` : ""}
          </p>
        </div>

        <section aria-label="Valori a porzione" className="rounded-2xl bg-card p-4 ring-1 ring-border">
          <p className="text-sm text-muted-foreground">A porzione</p>
          <p className="font-heading text-4xl font-semibold tracking-tight">
            {formatKcal(nutrition.perServing.kcal)}
            <span className="ml-1 text-base font-medium text-muted-foreground">kcal</span>
          </p>
          <MacroLine nutrients={nutrition.perServing} className="mt-2 text-sm" />
          <p className="mt-2 text-xs text-muted-foreground">
            {formatKcal(nutrition.per100g.kcal)} kcal per 100 g, {formatKcal(nutrition.total.kcal)} kcal in tutto
          </p>
        </section>

        <section aria-labelledby="recipe-ingredients">
          <div className="flex items-center justify-between gap-3">
            <h2 id="recipe-ingredients" className="font-heading text-lg font-semibold tracking-tight">
              Ingredienti
            </h2>
            <div className="flex items-center gap-1" role="group" aria-label="Porzioni da preparare">
              <Button
                variant="outline"
                size="icon-sm"
                aria-label="Una porzione in meno"
                disabled={portions <= 1}
                onClick={() => setPortions((current) => Math.max(1, Math.ceil(current) - 1))}
              >
                <MinusIcon />
              </Button>
              <span className="min-w-24 text-center text-sm" aria-live="polite">
                per {formatDecimal(portions)} {portions === 1 ? "porzione" : "porzioni"}
              </span>
              <Button
                variant="outline"
                size="icon-sm"
                aria-label="Una porzione in più"
                disabled={portions >= 100}
                onClick={() => setPortions((current) => Math.min(100, Math.floor(current) + 1))}
              >
                <PlusIcon />
              </Button>
            </div>
          </div>
          <ul className="mt-1 divide-y">
            {recipe.ingredients.map((ingredient, index) => (
              <li key={`${ingredient.foodId}-${index}`} className="flex items-baseline justify-between gap-3 py-2.5">
                <span className="min-w-0 truncate">{ingredient.name}</span>
                <span className="shrink-0 text-right">
                  <span className="font-medium">
                    {formatGrams(ingredient.grams * factor)} {ingredient.unit}
                  </span>
                  <span className="ml-2 text-sm text-muted-foreground">
                    {formatKcal(scaleNutrients(ingredient.per100, ingredient.grams * factor).kcal)} kcal
                  </span>
                </span>
              </li>
            ))}
          </ul>
          {portions !== nutrition.servings ? (
            <p className="mt-2 text-sm text-muted-foreground">
              In tutto {formatKcal(multiplyNutrients(nutrition.total, factor).kcal)} kcal. I valori a porzione non
              cambiano.
            </p>
          ) : null}
        </section>

        {recipe.notes ? (
          <section aria-labelledby="recipe-notes">
            <h2 id="recipe-notes" className="font-heading text-lg font-semibold tracking-tight">
              Note
            </h2>
            <p className="mt-1 text-sm whitespace-pre-line">{recipe.notes}</p>
          </section>
        ) : null}
      </ScreenBody>
      <ScreenFooter className="grid grid-cols-[auto_1fr] gap-2">
        <Link href={`/recipes/${recipe.id}/edit`} className={buttonVariants({ variant: "outline", size: "lg" })}>
          <PencilIcon />
          Modifica
        </Link>
        <Link href={`/add?recipe=${recipe.id}`} className={buttonVariants({ size: "lg" })}>
          <PlusIcon />
          Aggiungi al diario
        </Link>
      </ScreenFooter>
    </>
  );
}
