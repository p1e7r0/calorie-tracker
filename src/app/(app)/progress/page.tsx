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
      <Suspense fallback={<ProgressSkeleton />}>
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
      <ProgressTabsList />
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

function ProgressTabsList() {
  return (
    <TabsList className="mb-3 w-full shrink-0">
      <TabsTrigger value="body">Corpo</TabsTrigger>
      <TabsTrigger value="nutrition">Alimentazione</TabsTrigger>
    </TabsList>
  );
}

function ProgressSkeleton() {
  return (
    <Tabs value="body" className="min-h-0 flex-1 gap-0">
      <div inert aria-hidden="true" className="contents">
        <ProgressTabsList />
      </div>
      <ScreenBody className="flex flex-col gap-4">
        <div className="flex items-end justify-between gap-3">
          <div className="flex flex-col gap-1.5">
            <Skeleton className="h-4 w-12" />
            <Skeleton className="h-9 w-28" />
            <Skeleton className="h-4 w-48" />
          </div>
          <Skeleton className="h-9 w-24" />
        </div>
        <Skeleton className="aspect-[16/10] w-full rounded-xl" />
        <Skeleton className="h-7 w-full" />
        <section>
          <Skeleton className="my-0.5 h-6 w-20" />
          <div className="mt-1 divide-y">
            {Array.from({ length: 4 }, (_, index) => (
              <div key={index} className="flex items-center justify-between gap-3 py-2.5">
                <div className="flex flex-col gap-1.5 py-1">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-3.5 w-32" />
                </div>
                <Skeleton className="h-4 w-14" />
              </div>
            ))}
          </div>
        </section>
      </ScreenBody>
    </Tabs>
  );
}
