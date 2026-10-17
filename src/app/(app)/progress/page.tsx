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
import { todayIsoDate } from "@/lib/nutrition/days";
import { getDailyTargets } from "@/server/diary";
import { listMeasurements } from "@/server/measurements";
import { getDailyTotals } from "@/server/statistics";

export const metadata: Metadata = { title: "Progressi" };

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
  const [measurements, dailyTotals, targets] = await Promise.all([
    listMeasurements(user.id),
    getDailyTotals(user.id, today, 7 * 17),
    getDailyTargets(user.id),
  ]);
  const weights = measurements.map((measurement) => ({ day: measurement.measuredOn, value: measurement.weightKg }));
  const history = maintenanceHistory({
    dailyIntakes: dailyTotals.map((totals) => ({ day: totals.day, value: totals.kcal })),
    weights,
    today,
    weeks: 12,
  });

  return (
    <Tabs defaultValue="body" className="min-h-0 flex-1 gap-0">
      <TabsList className="mb-3 w-full shrink-0">
        <TabsTrigger value="body">Corpo</TabsTrigger>
        <TabsTrigger value="nutrition">Alimentazione</TabsTrigger>
      </TabsList>
      <PullToRefresh>
        <ScreenBody>
          <TabsContent value="body">
            <BodyProgress measurements={measurements} today={today} />
          </TabsContent>
          <TabsContent value="nutrition">
            <NutritionProgress
              dailyTotals={dailyTotals}
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
