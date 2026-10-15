import type { Metadata } from "next";
import { Suspense } from "react";
import { BackHeader } from "@/components/app-shell/back-header";
import { RecipeEditor } from "@/components/recipes/recipe-editor";
import { Skeleton } from "@/components/ui/skeleton";
import { getCurrentUser } from "@/lib/auth/session";
import { ingredientSuggestions } from "@/server/suggestions";

export const metadata: Metadata = { title: "Nuova ricetta" };

export default function NewRecipePage() {
  return (
    <>
      <BackHeader title="Nuova ricetta" backHref="/food?tab=recipes" />
      <Suspense fallback={<Skeleton className="h-64 w-full" />}>
        <NewRecipe />
      </Suspense>
    </>
  );
}

async function NewRecipe() {
  const user = await getCurrentUser();
  const suggestions = await ingredientSuggestions(user.id);
  return (
    <RecipeEditor
      suggestions={suggestions}
      initialValues={{ name: "", servings: 4, cookedWeight: "", ingredients: [] }}
    />
  );
}
