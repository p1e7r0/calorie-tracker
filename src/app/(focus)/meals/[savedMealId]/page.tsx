import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { BackHeader } from "@/components/app-shell/back-header";
import { ScreenBody } from "@/components/app-shell/screen";
import { SavedMealEditor } from "@/components/saved-meals/saved-meal-editor";
import { Skeleton } from "@/components/ui/skeleton";
import { getCurrentUser } from "@/lib/auth/session";
import { getSavedMeal } from "@/server/saved-meals";

export const metadata: Metadata = { title: "Pasto salvato" };

export default function SavedMealPage({ params }: PageProps<"/meals/[savedMealId]">) {
  return (
    <>
      <BackHeader title="Pasto salvato" backHref="/food?tab=meals" />
      <ScreenBody>
        <Suspense fallback={<Skeleton className="h-64 w-full" />}>
          <SavedMeal params={params} />
        </Suspense>
      </ScreenBody>
    </>
  );
}

async function SavedMeal({ params }: Pick<PageProps<"/meals/[savedMealId]">, "params">) {
  const user = await getCurrentUser();
  const { savedMealId } = await params;
  const savedMeal = /^[0-9a-f-]{36}$/.test(savedMealId) ? await getSavedMeal(user.id, savedMealId) : null;
  if (!savedMeal) notFound();
  return <SavedMealEditor savedMeal={savedMeal} />;
}
