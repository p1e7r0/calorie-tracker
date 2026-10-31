import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { BackHeader } from "@/components/app-shell/back-header";
import { StoredMealEditor } from "@/components/stored-meals/stored-meal-editor";
import { StoredMealSkeleton } from "@/components/stored-meals/stored-meal-skeleton";
import { getCurrentUser } from "@/lib/auth/session";
import { todayIsoDate } from "@/lib/nutrition/days";
import { listLoggableRecipes } from "@/server/recipes";
import { getStoredMeal } from "@/server/stored-meals";
import { ingredientSuggestions } from "@/server/suggestions";

export const metadata: Metadata = { title: "Pasto messo da parte" };

export default function StoredMealPage({ params }: PageProps<"/stored-meals/[storedMealId]">) {
  return (
    <>
      <BackHeader title="Pasto messo da parte" backHref="/food?tab=meals" />
      <Suspense fallback={<StoredMealSkeleton />}>
        <StoredMeal params={params} />
      </Suspense>
    </>
  );
}

async function StoredMeal({ params }: Pick<PageProps<"/stored-meals/[storedMealId]">, "params">) {
  const user = await getCurrentUser();
  const { storedMealId } = await params;
  const storedMeal = /^[0-9a-f-]{36}$/.test(storedMealId) ? await getStoredMeal(user.id, storedMealId) : null;
  if (!storedMeal) notFound();
  const [recipes, foods] = await Promise.all([listLoggableRecipes(user.id), ingredientSuggestions(user.id)]);
  return <StoredMealEditor storedMeal={storedMeal} today={todayIsoDate()} suggestions={[...recipes, ...foods]} />;
}
