import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHeader } from "@/components/app-shell/page-header";
import { BodyProgress } from "@/components/progress/body-progress";
import { NutritionProgress } from "@/components/progress/nutrition-progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getCurrentUser } from "@/lib/auth/session";
import { todayIsoDate } from "@/lib/nutrition/days";
import { getDailyTargets } from "@/server/diary";
import { listMeasurements } from "@/server/measurements";
import { getDailyTotals } from "@/server/statistics";

export const metadata: Metadata = { title: "Progressi" };

export default function ProgressPage() {
  return (
    <>
      <PageHeader title="Progressi" />
      <Suspense fallback={<Skeleton className="h-96 w-full" />}>
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
    getDailyTotals(user.id, today, 7 * 13),
    getDailyTargets(user.id),
  ]);

  return (
    <Tabs defaultValue="body">
      <TabsList className="mb-3 w-full">
        <TabsTrigger value="body">Corpo</TabsTrigger>
        <TabsTrigger value="nutrition">Alimentazione</TabsTrigger>
      </TabsList>
      <TabsContent value="body">
        <BodyProgress measurements={measurements} today={today} />
      </TabsContent>
      <TabsContent value="nutrition">
        <NutritionProgress
          dailyTotals={dailyTotals}
          targets={targets}
          today={today}
          weights={measurements.map((measurement) => ({ day: measurement.measuredOn, value: measurement.weightKg }))}
        />
      </TabsContent>
    </Tabs>
  );
}
