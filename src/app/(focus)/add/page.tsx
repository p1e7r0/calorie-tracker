import type { Metadata } from "next";
import { Suspense } from "react";
import { AddScreen } from "@/components/add/add-screen";
import { Skeleton } from "@/components/ui/skeleton";
import { getCurrentUser } from "@/lib/auth/session";
import { currentHour, isIsoDate, todayIsoDate } from "@/lib/nutrition/days";
import { isMealType, suggestMeal } from "@/lib/nutrition/meals";
import { favoriteFoods, recentFoods } from "@/server/foods";
import { listLoggableRecipes } from "@/server/recipes";

export const metadata: Metadata = { title: "Aggiungi" };

export default function AddPage({ searchParams }: PageProps<"/add">) {
  return (
    <Suspense fallback={<AddSkeleton />}>
      <Add searchParams={searchParams} />
    </Suspense>
  );
}

async function Add({ searchParams }: Pick<PageProps<"/add">, "searchParams">) {
  const user = await getCurrentUser();
  const { date, meal } = await searchParams;
  const today = todayIsoDate();
  const day = isIsoDate(date) ? date : today;
  const initialMeal = isMealType(meal) ? meal : suggestMeal(currentHour());
  const [recent, favorites, recipes] = await Promise.all([
    recentFoods(user.id),
    favoriteFoods(user.id),
    listLoggableRecipes(user.id),
  ]);

  return (
    <AddScreen
      day={day}
      initialMeal={initialMeal}
      recentFoods={recent}
      favoriteFoods={favorites}
      recipes={recipes}
      backHref={day === today ? "/" : `/?date=${day}`}
    />
  );
}

function AddSkeleton() {
  return (
    <div className="flex flex-col gap-3 pt-2">
      <Skeleton className="h-11 w-full" />
      <Skeleton className="h-9 w-full" />
      <Skeleton className="h-11 w-full" />
      {Array.from({ length: 6 }, (_, index) => (
        <Skeleton key={index} className="h-12 w-full" />
      ))}
    </div>
  );
}
