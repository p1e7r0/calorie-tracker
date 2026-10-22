import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { BackHeader } from "@/components/app-shell/back-header";
import { ScreenBody } from "@/components/app-shell/screen";
import { FavoriteButton } from "@/components/food/favorite-button";
import { FreezeButton } from "@/components/freezer/freeze-button";
import { ArchiveRecipeButton } from "@/components/recipes/archive-recipe-button";
import { DuplicateRecipeButton } from "@/components/recipes/duplicate-recipe-button";
import { RecipeView } from "@/components/recipes/recipe-view";
import { Skeleton } from "@/components/ui/skeleton";
import { getCurrentUser } from "@/lib/auth/session";
import { getLoggableRecipe, getRecipeForEditing } from "@/server/recipes";

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
  const isIdentifier = /^[0-9a-f-]{36}$/.test(recipeId);
  const [recipe, loggableRecipe] = isIdentifier
    ? await Promise.all([getRecipeForEditing(user.id, recipeId), getLoggableRecipe(user.id, recipeId)])
    : [null, null];
  if (!recipe) notFound();

  return (
    <>
      <BackHeader
        title=""
        backHref="/food?tab=recipes"
        actions={
          <>
            <FavoriteButton type="recipe" id={recipe.id} isFavorite={recipe.isFavorite} />
            {loggableRecipe ? <FreezeButton item={loggableRecipe} /> : null}
            <DuplicateRecipeButton recipeId={recipe.id} />
            <ArchiveRecipeButton recipeId={recipe.id} name={recipe.name} />
          </>
        }
      />
      <RecipeView recipe={recipe} />
    </>
  );
}
