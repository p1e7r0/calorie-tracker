import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHeader } from "@/components/app-shell/page-header";
import { PullToRefresh } from "@/components/app-shell/pull-to-refresh";
import { ScreenBody } from "@/components/app-shell/screen";
import { BodyProgress } from "@/components/progress/body-progress";
import { NutritionProgress } from "@/components/progress/nutrition-progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getCurrentUser } from "@/lib/auth/session";
import { maintenanceHistory } from "@/lib/nutrition/check-in";
import { addDays, todayIsoDate } from "@/lib/nutrition/days";
import { getDailyTargets } from "@/server/diary";
import { listIncompleteDays } from "@/server/incomplete-days";
import { listMeasurements } from "@/server/measurements";
import { getProfileWithLatestWeight } from "@/server/profile";
import { getDailyTotals } from "@/server/statistics";

export const metadata: Metadata = { title: "Progressi" };

const loadedDays = 7 * 17;

export default function ProgressPage() {
  return (
    <>
      <PageHeader title="Progressi" />
      <Suspense
        fallback={
          <ScreenBody>
            <Skeleton className="h-96 w-full" />
          </ScreenBody>
        }
      >
        <Progress />
      </Suspense>
    </>
  );
}

async function Progress() {
  const user = await getCurrentUser();
  const today = todayIsoDate();
  const [measurements, dailyTotals, targets, { profile }, incompleteDays] = await Promise.all([
    listMeasurements(user.id),
    getDailyTotals(user.id, today, loadedDays),
    getDailyTargets(user.id),
    getProfileWithLatestWeight(user.id),
    listIncompleteDays(user.id, addDays(today, -(loadedDays - 1)), today),
  ]);
  const weights = measurements.map((measurement) => ({ day: measurement.measuredOn, value: measurement.weightKg }));
  const history = maintenanceHistory({
    dailyIntakes: dailyTotals.map((totals) => ({ day: totals.day, value: totals.kcal })),
    weights,
    today,
    weeks: 12,
    incompleteDays,
  });
  const targetWeight = profile?.targetWeightKg
    ? { targetKg: profile.targetWeightKg, goal: profile.goal, plannedWeeklyRateKg: profile.weeklyRateKg }
    : null;

  return (
    <Tabs defaultValue="body" className="min-h-0 flex-1 gap-0">
      <TabsList className="mb-3 w-full shrink-0">
        <TabsTrigger value="body">Corpo</TabsTrigger>
        <TabsTrigger value="nutrition">Alimentazione</TabsTrigger>
      </TabsList>
      <PullToRefresh>
        <ScreenBody>
          <TabsContent value="body">
            <BodyProgress measurements={measurements} today={today} targetWeight={targetWeight} />
          </TabsContent>
          <TabsContent value="nutrition">
            <NutritionProgress
              dailyTotals={dailyTotals}
              incompleteDays={incompleteDays}
              targets={targets}
              today={today}
              weights={weights}
              maintenanceHistory={history}
            />
          </TabsContent>
        </ScreenBody>
      </PullToRefresh>
    </Tabs>
  );
}
