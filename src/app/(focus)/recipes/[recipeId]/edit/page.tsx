import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { BackHeader } from "@/components/app-shell/back-header";
import { ScreenBody, ScreenFooter } from "@/components/app-shell/screen";
import { toFormNumber } from "@/components/food/food-form-values";
import { RecipeEditor } from "@/components/recipes/recipe-editor";
import { Skeleton } from "@/components/ui/skeleton";
import { getCurrentUser } from "@/lib/auth/session";
import { getRecipeForEditing } from "@/server/recipes";
import { ingredientSuggestions } from "@/server/suggestions";

export const metadata: Metadata = { title: "Modifica ricetta" };

export default function EditRecipePage({ params }: PageProps<"/recipes/[recipeId]/edit">) {
  return (
    <Suspense
      fallback={
        <>
          <ScreenBody className="pt-14">
            <Skeleton className="h-64 w-full" />
          </ScreenBody>
          <ScreenFooter>
            <Skeleton className="h-11 w-full" />
          </ScreenFooter>
        </>
      }
    >
      <EditRecipe params={params} />
    </Suspense>
  );
}

async function EditRecipe({ params }: Pick<PageProps<"/recipes/[recipeId]/edit">, "params">) {
  const user = await getCurrentUser();
  const { recipeId } = await params;
  const [recipe, suggestions] = await Promise.all([
    /^[0-9a-f-]{36}$/.test(recipeId) ? getRecipeForEditing(user.id, recipeId) : null,
    ingredientSuggestions(user.id),
  ]);
  if (!recipe) notFound();

  return (
    <>
      <BackHeader title="Modifica ricetta" backHref={`/recipes/${recipe.id}`} />
      <RecipeEditor
        recipeId={recipe.id}
        suggestions={suggestions}
        initialValues={{
          name: recipe.name,
          servings: recipe.servings,
          cookedWeight: toFormNumber(recipe.cookedWeightG),
          ingredients: recipe.ingredients.map((ingredient, index) => ({
            key: `${ingredient.foodId}-${index}`,
            foodId: ingredient.foodId,
            name: ingredient.name,
            unit: ingredient.unit,
            grams: toFormNumber(ingredient.grams),
            per100: ingredient.per100,
          })),
        }}
      />
    </>
  );
}
