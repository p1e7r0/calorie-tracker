import type { Metadata } from "next";
import { Suspense } from "react";
import { BackHeader } from "@/components/app-shell/back-header";
import { StoredMealEditor } from "@/components/stored-meals/stored-meal-editor";
import { StoredMealSkeleton } from "@/components/stored-meals/stored-meal-skeleton";
import { getCurrentUser } from "@/lib/auth/session";
import { todayIsoDate } from "@/lib/nutrition/days";
import { listLoggableRecipes } from "@/server/recipes";
import { ingredientSuggestions } from "@/server/suggestions";

export const metadata: Metadata = { title: "Metti da parte" };

export default function NewStoredMealPage() {
  return (
    <>
      <BackHeader title="Metti da parte" backHref="/food?tab=meals" />
      <Suspense fallback={<StoredMealSkeleton />}>
        <NewStoredMeal />
      </Suspense>
    </>
  );
}

async function NewStoredMeal() {
  const user = await getCurrentUser();
  const [recipes, foods] = await Promise.all([listLoggableRecipes(user.id), ingredientSuggestions(user.id)]);
  return <StoredMealEditor storedMeal={null} today={todayIsoDate()} suggestions={[...recipes, ...foods]} />;
}
