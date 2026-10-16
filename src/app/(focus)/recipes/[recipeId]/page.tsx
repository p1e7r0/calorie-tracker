import { PlusIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { BackHeader } from "@/components/app-shell/back-header";
import { ScreenBody } from "@/components/app-shell/screen";
import { FavoriteButton } from "@/components/food/favorite-button";
import { toFormNumber } from "@/components/food/food-form-values";
import { ArchiveRecipeButton } from "@/components/recipes/archive-recipe-button";
import { RecipeEditor } from "@/components/recipes/recipe-editor";
import { buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { getCurrentUser } from "@/lib/auth/session";
import { getRecipeForEditing } from "@/server/recipes";
import { ingredientSuggestions } from "@/server/suggestions";

export const metadata: Metadata = { title: "Ricetta" };

export default function RecipePage({ params }: PageProps<"/recipes/[recipeId]">) {
  return (
    <Suspense
      fallback={
        <ScreenBody className="pt-14">
          <Skeleton className="h-64 w-full" />
        </ScreenBody>
      }
    >
      <Recipe params={params} />
    </Suspense>
  );
}

async function Recipe({ params }: Pick<PageProps<"/recipes/[recipeId]">, "params">) {
  const user = await getCurrentUser();
  const { recipeId } = await params;
  const [recipe, suggestions] = await Promise.all([
    /^[0-9a-f-]{36}$/.test(recipeId) ? getRecipeForEditing(user.id, recipeId) : null,
    ingredientSuggestions(user.id),
  ]);
  if (!recipe) notFound();

  return (
    <>
      <BackHeader
        title="Ricetta"
        backHref="/food?tab=recipes"
        actions={
          <>
            <FavoriteButton type="recipe" id={recipe.id} isFavorite={recipe.isFavorite} />
            <ArchiveRecipeButton recipeId={recipe.id} name={recipe.name} />
            <Link
              href={`/add?recipe=${recipe.id}`}
              aria-label="Aggiungi al diario"
              className={buttonVariants({ variant: "secondary", size: "icon" })}
            >
              <PlusIcon />
            </Link>
          </>
        }
      />
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
