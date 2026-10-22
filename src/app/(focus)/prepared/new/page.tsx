import type { Metadata } from "next";
import { Suspense } from "react";
import { BackHeader } from "@/components/app-shell/back-header";
import { ScreenBody, ScreenFooter } from "@/components/app-shell/screen";
import { PreparedMealComposer, type PreparedMealDraft } from "@/components/prepared-meals/prepared-meal-composer";
import { Skeleton } from "@/components/ui/skeleton";
import { getCurrentUser } from "@/lib/auth/session";
import { maximumPreparedPortions } from "@/lib/nutrition/prepared-meals";
import { getLoggableRecipe, listLoggableRecipes } from "@/server/recipes";
import { ingredientSuggestions } from "@/server/suggestions";

export const metadata: Metadata = { title: "Nuovo pasto pronto" };

export default function NewPreparedMealPage({ searchParams }: PageProps<"/prepared/new">) {
  return (
    <Suspense
      fallback={
        <>
          <BackHeader title="Nuovo pasto pronto" backHref="/food?tab=prepared" />
          <ScreenBody>
            <Skeleton className="h-64 w-full" />
          </ScreenBody>
          <ScreenFooter>
            <Skeleton className="h-11 w-full" />
          </ScreenFooter>
        </>
      }
    >
      <NewPreparedMeal searchParams={searchParams} />
    </Suspense>
  );
}

async function NewPreparedMeal({ searchParams }: Pick<PageProps<"/prepared/new">, "searchParams">) {
  const user = await getCurrentUser();
  const { recipe: recipeId } = await searchParams;
  const [recipes, foods, sourceRecipe] = await Promise.all([
    listLoggableRecipes(user.id),
    ingredientSuggestions(user.id),
    typeof recipeId === "string" && /^[0-9a-f-]{36}$/.test(recipeId) ? getLoggableRecipe(user.id, recipeId) : null,
  ]);
  const initialValues: PreparedMealDraft = sourceRecipe
    ? {
        name: sourceRecipe.name,
        location: "fridge",
        portions: Math.min(sourceRecipe.servings, maximumPreparedPortions),
        items: [{ item: sourceRecipe, quantity: { type: "recipe", recipeId: sourceRecipe.id, servings: 1 } }],
      }
    : { name: "", location: "fridge", portions: 1, items: [] };

  return (
    <>
      <BackHeader
        title="Nuovo pasto pronto"
        backHref={sourceRecipe ? `/recipes/${sourceRecipe.id}` : "/food?tab=prepared"}
      />
      <PreparedMealComposer initialValues={initialValues} suggestions={[...recipes, ...foods]} />
    </>
  );
}
