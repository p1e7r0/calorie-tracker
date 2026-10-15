import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHeader } from "@/components/app-shell/page-header";
import { FoodBrowser } from "@/components/food/food-browser";
import { Skeleton } from "@/components/ui/skeleton";
import { getCurrentUser } from "@/lib/auth/session";
import { favoriteFoods, listOwnFoods } from "@/server/foods";
import { listLoggableRecipes } from "@/server/recipes";
import { listSavedMeals } from "@/server/saved-meals";

export const metadata: Metadata = { title: "Cibo" };

export default function FoodPage({ searchParams }: PageProps<"/food">) {
  return (
    <>
      <PageHeader title="Cibo" />
      <Suspense fallback={<Skeleton className="h-64 w-full" />}>
        <Catalog searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function Catalog({ searchParams }: Pick<PageProps<"/food">, "searchParams">) {
  const user = await getCurrentUser();
  const { tab } = await searchParams;
  const [ownFoods, favorites, recipes, savedMeals] = await Promise.all([
    listOwnFoods(user.id),
    favoriteFoods(user.id),
    listLoggableRecipes(user.id),
    listSavedMeals(user.id),
  ]);
  return (
    <FoodBrowser
      ownFoods={ownFoods}
      favoriteFoods={favorites}
      recipes={recipes}
      savedMeals={savedMeals}
      initialTab={tab === "recipes" || tab === "meals" ? tab : "foods"}
    />
  );
}
