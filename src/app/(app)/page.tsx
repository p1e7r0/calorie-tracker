import { Suspense } from "react";
import { ScreenBody } from "@/components/app-shell/screen";
import { DailySummary } from "@/components/diary/daily-summary";
import { DayNavigator } from "@/components/diary/day-navigator";
import { MealSection } from "@/components/diary/meal-section";
import { Skeleton } from "@/components/ui/skeleton";
import { getCurrentUser } from "@/lib/auth/session";
import { isIsoDate, todayIsoDate } from "@/lib/nutrition/days";
import { getDailyTargets, getDiaryDay } from "@/server/diary";

export default function TodayPage({ searchParams }: PageProps<"/">) {
  return (
    <Suspense fallback={<TodaySkeleton />}>
      <Today searchParams={searchParams} />
    </Suspense>
  );
}

async function Today({ searchParams }: Pick<PageProps<"/">, "searchParams">) {
  const user = await getCurrentUser();
  const { date } = await searchParams;
  const today = todayIsoDate();
  const day = isIsoDate(date) ? date : today;
  const [diary, targets] = await Promise.all([getDiaryDay(user.id, day), getDailyTargets(user.id)]);

  return (
    <>
      <header className="-ml-2 flex h-14 shrink-0 items-center">
        <DayNavigator day={day} today={today} />
      </header>
      <ScreenBody>
        <DailySummary totals={diary.totals} targets={targets} />
        <div className="mt-2">
          {diary.meals.map((meal) => (
            <MealSection key={meal.meal} meal={meal} day={day} />
          ))}
        </div>
      </ScreenBody>
    </>
  );
}

function TodaySkeleton() {
  return (
    <>
      <div className="flex h-14 shrink-0 items-center">
        <Skeleton className="h-8 w-32" />
      </div>
      <ScreenBody>
        <Skeleton className="h-44 w-full rounded-2xl" />
        <div className="mt-5 flex flex-col gap-6">
          {Array.from({ length: 4 }, (_, index) => (
            <Skeleton key={index} className="h-10 w-full" />
          ))}
        </div>
      </ScreenBody>
    </>
  );
}
