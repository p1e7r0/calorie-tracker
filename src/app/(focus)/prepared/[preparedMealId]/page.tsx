import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { BackHeader } from "@/components/app-shell/back-header";
import { ScreenBody, ScreenFooter } from "@/components/app-shell/screen";
import { PreparedMealEditor } from "@/components/prepared-meals/prepared-meal-editor";
import { Skeleton } from "@/components/ui/skeleton";
import { getCurrentUser } from "@/lib/auth/session";
import { todayIsoDate } from "@/lib/nutrition/days";
import { getPreparedMeal } from "@/server/prepared-meals";

export const metadata: Metadata = { title: "Pasto pronto" };

export default function PreparedMealPage({ params }: PageProps<"/prepared/[preparedMealId]">) {
  return (
    <>
      <BackHeader title="Pasto pronto" backHref="/food?tab=prepared" />
      <Suspense
        fallback={
          <>
            <ScreenBody>
              <Skeleton className="h-64 w-full" />
            </ScreenBody>
            <ScreenFooter>
              <Skeleton className="h-10 w-full" />
            </ScreenFooter>
          </>
        }
      >
        <PreparedMeal params={params} />
      </Suspense>
    </>
  );
}

async function PreparedMeal({ params }: Pick<PageProps<"/prepared/[preparedMealId]">, "params">) {
  const user = await getCurrentUser();
  const { preparedMealId } = await params;
  const preparedMeal = /^[0-9a-f-]{36}$/.test(preparedMealId) ? await getPreparedMeal(user.id, preparedMealId) : null;
  if (!preparedMeal) notFound();
  return <PreparedMealEditor preparedMeal={preparedMeal} today={todayIsoDate()} />;
}
