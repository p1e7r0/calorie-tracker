import type { Metadata } from "next";
import { Suspense } from "react";
import { AddScreen } from "@/components/add/add-screen";
import { Skeleton } from "@/components/ui/skeleton";
import { getCurrentUser } from "@/lib/auth/session";
import { currentHour, isIsoDate, todayIsoDate } from "@/lib/nutrition/days";
import { isMealType, suggestMeal } from "@/lib/nutrition/meals";
import { favoriteFoods, getLoggableFood, recentFoods } from "@/server/foods";
import { getLoggableRecipe, listLoggableRecipes } from "@/server/recipes";

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
  const { date, meal, food, recipe } = await searchParams;
  const today = todayIsoDate();
  const day = isIsoDate(date) ? date : today;
  const initialMeal = isMealType(meal) ? meal : suggestMeal(currentHour());
  const isIdentifier = (value: unknown): value is string => typeof value === "string" && /^[0-9a-f-]{36}$/.test(value);
  const [recent, favorites, recipes, initialItem] = await Promise.all([
    recentFoods(user.id),
    favoriteFoods(user.id),
    listLoggableRecipes(user.id),
    isIdentifier(food)
      ? getLoggableFood(user.id, food)
      : isIdentifier(recipe)
        ? getLoggableRecipe(user.id, recipe)
        : null,
  ]);

  return (
    <AddScreen
      day={day}
      initialMeal={initialMeal}
      recentFoods={recent}
      favoriteFoods={favorites}
      recipes={recipes}
      initialItem={initialItem}
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
