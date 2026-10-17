import type { Metadata } from "next";
import { Suspense } from "react";
import { AddScreen } from "@/components/add/add-screen";
import { ScreenBody, ScreenFooter } from "@/components/app-shell/screen";
import { Skeleton } from "@/components/ui/skeleton";
import { getCurrentUser } from "@/lib/auth/session";
import { currentHour, formatDayInSentence, isIsoDate, todayIsoDate } from "@/lib/nutrition/days";
import { isMealType, suggestMeal } from "@/lib/nutrition/meals";
import { favoriteFoods, getLoggableFood } from "@/server/foods";
import { isAiEnabled } from "@/server/ai";
import { getLoggableRecipe, listLoggableRecipes } from "@/server/recipes";
import { listSavedMealViews } from "@/server/saved-meals";
import { mealSuggestions } from "@/server/suggestions";

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
  const [suggestions, favorites, recipes, savedMeals, initialItem] = await Promise.all([
    mealSuggestions(user.id, today),
    favoriteFoods(user.id),
    listLoggableRecipes(user.id),
    listSavedMealViews(user.id),
    isIdentifier(food)
      ? getLoggableFood(user.id, food)
      : isIdentifier(recipe)
        ? getLoggableRecipe(user.id, recipe)
        : null,
  ]);

  return (
    <AddScreen
      day={day}
      dayLabel={day === today ? null : formatDayInSentence(day, today)}
      initialMeal={initialMeal}
      suggestions={suggestions}
      favoriteFoods={favorites}
      recipes={recipes}
      savedMeals={savedMeals}
      initialItem={initialItem}
      backHref={day === today ? "/" : `/?date=${day}`}
      aiEnabled={isAiEnabled}
    />
  );
}

function AddSkeleton() {
  return (
    <>
      <div className="flex h-14 shrink-0 items-center">
        <Skeleton className="h-9 w-full" />
      </div>
      <ScreenBody className="flex flex-col gap-3">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-11 w-full" />
        {Array.from({ length: 6 }, (_, index) => (
          <Skeleton key={index} className="h-12 w-full" />
        ))}
      </ScreenBody>
      <ScreenFooter>
        <Skeleton className="h-11 w-full" />
      </ScreenFooter>
    </>
  );
}
