import { Suspense } from "react";
import { PullToRefresh } from "@/components/app-shell/pull-to-refresh";
import { WeeklyCheckInCard } from "@/components/check-in/weekly-check-in-card";
import { ScreenBody } from "@/components/app-shell/screen";
import { DailySummary } from "@/components/diary/daily-summary";
import { DayNavigator } from "@/components/diary/day-navigator";
import { IncompleteDayToggle } from "@/components/diary/incomplete-day-toggle";
import { MealSection } from "@/components/diary/meal-section";
import { Skeleton } from "@/components/ui/skeleton";
import { getCurrentUser } from "@/lib/auth/session";
import { addDays, daysBetween, formatDayInSentence, isIsoDate, todayIsoDate } from "@/lib/nutrition/days";
import { weeklyBudget } from "@/lib/nutrition/weekly-budget";
import { weekStart } from "@/lib/nutrition/weeks";
import { getWeeklyCheckIn } from "@/server/adaptive-goal";
import { getDailyTargets, getDiaryDay, listLoggedDays } from "@/server/diary";
import { listIncompleteDays } from "@/server/incomplete-days";
import { getDailyTotals } from "@/server/statistics";

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
  const [diary, targets, loggedDays, weekTotals, weekIncompleteDays, checkIn] = await Promise.all([
    getDiaryDay(user.id, day),
    getDailyTargets(user.id),
    listLoggedDays(user.id, addDays(today, -400), today),
    getDailyTotals(user.id, day, daysBetween(weekStart(day), day) + 1),
    listIncompleteDays(user.id, weekStart(day), day),
    day === today ? getWeeklyCheckIn(user.id, today) : null,
  ]);
  const isIncomplete = weekIncompleteDays.includes(day);
  const weekly = targets
    ? weeklyBudget({ day, targetKcal: targets.kcal, dailyKcal: weekTotals, incompleteDays: weekIncompleteDays })
    : null;

  return (
    <>
      <header className="flex shrink-0 items-start pt-2 pb-2">
        <h1 className="sr-only">Diario di {formatDayInSentence(day, today)}</h1>
        <DayNavigator day={day} today={today} loggedDays={loggedDays} />
      </header>
      <PullToRefresh>
        <ScreenBody>
          <DailySummary
            totals={diary.totals}
            extras={diary.extras}
            targets={targets}
            weekly={weekly}
            incomplete={isIncomplete}
          />
          {checkIn ? <WeeklyCheckInCard checkIn={checkIn} /> : null}
          <div className="mt-2">
            {diary.meals.map((meal) => (
              <MealSection key={meal.meal} meal={meal} day={day} today={today} loggedDays={loggedDays} />
            ))}
          </div>
          {day <= today ? <IncompleteDayToggle day={day} incomplete={isIncomplete} /> : null}
        </ScreenBody>
      </PullToRefresh>
    </>
  );
}

function TodaySkeleton() {
  return (
    <>
      <div className="flex shrink-0 items-start pt-3 pb-3">
        <Skeleton className="h-12 w-40" />
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
