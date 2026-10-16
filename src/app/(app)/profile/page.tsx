import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHeader } from "@/components/app-shell/page-header";
import { ScreenBody } from "@/components/app-shell/screen";
import { toFormNumber } from "@/components/food/food-form-values";
import { AccountSummary } from "@/components/profile/account-summary";
import { AdaptiveGoalCard } from "@/components/profile/adaptive-goal-card";
import { ProfileForm } from "@/components/profile/profile-form";
import { ThemeSwitcher } from "@/components/theme-switcher";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getCurrentUser } from "@/lib/auth/session";
import { todayIsoDate } from "@/lib/nutrition/days";
import { getAdaptiveGoal } from "@/server/adaptive-goal";
import { getProfileWithLatestWeight } from "@/server/profile";

export const metadata: Metadata = { title: "Profilo" };

export default function ProfilePage({ searchParams }: PageProps<"/profile">) {
  return (
    <>
      <PageHeader title="Profilo" />
      <Tabs defaultValue="goal" className="min-h-0 flex-1 gap-0">
        <TabsList className="mb-3 w-full shrink-0">
          <TabsTrigger value="goal">Dati e obiettivo</TabsTrigger>
          <TabsTrigger value="settings">Impostazioni</TabsTrigger>
        </TabsList>
        <ScreenBody>
          <TabsContent value="goal">
            <Suspense fallback={<Skeleton className="h-96 w-full" />}>
              <Goals searchParams={searchParams} />
            </Suspense>
            <Suspense fallback={<Skeleton className="mt-6 h-40 w-full" />}>
              <AdaptiveGoal />
            </Suspense>
          </TabsContent>
          <TabsContent value="settings" className="flex flex-col gap-6">
            <section aria-labelledby="account-heading" className="flex flex-col gap-2">
              <h2 id="account-heading" className="text-sm font-medium text-muted-foreground">
                Account
              </h2>
              <Suspense fallback={<Skeleton className="h-11 w-full" />}>
                <AccountSummary />
              </Suspense>
            </section>
            <section aria-labelledby="theme-heading" className="flex flex-col gap-2">
              <h2 id="theme-heading" className="text-sm font-medium text-muted-foreground">
                Tema
              </h2>
              <ThemeSwitcher />
            </section>
          </TabsContent>
        </ScreenBody>
      </Tabs>
    </>
  );
}

async function Goals({ searchParams }: Pick<PageProps<"/profile">, "searchParams">) {
  const user = await getCurrentUser();
  const { setup } = await searchParams;
  const { profile, latestWeight } = await getProfileWithLatestWeight(user.id);
  return (
    <>
      {setup && !profile ? (
        <p className="mb-4 rounded-lg bg-energy/15 px-3 py-2 text-sm">
          Inserisci i tuoi dati: calcolo io quante kcal ti servono ogni giorno.
        </p>
      ) : null}
      <ProfileForm
        today={todayIsoDate()}
        initialValues={{
          sex: profile?.sex ?? null,
          birthDate: profile?.birthDate ?? "",
          heightCm: toFormNumber(profile?.heightCm),
          weightKg: toFormNumber(latestWeight?.weightKg),
          activityLevel: profile?.activityLevel ?? "light",
          goal: profile?.goal ?? "maintain",
          weeklyRateKg: profile?.weeklyRateKg ?? 0.5,
          customized: profile?.targetsCustomized ?? false,
          kcal: profile?.targetsCustomized ? toFormNumber(profile.targetKcal) : "",
          proteinG: profile?.targetsCustomized ? toFormNumber(profile.targetProteinG) : "",
          carbsG: profile?.targetsCustomized ? toFormNumber(profile.targetCarbsG) : "",
          fatG: profile?.targetsCustomized ? toFormNumber(profile.targetFatG) : "",
        }}
      />
    </>
  );
}

async function AdaptiveGoal() {
  const user = await getCurrentUser();
  const adaptiveGoal = await getAdaptiveGoal(user.id, todayIsoDate());
  return (
    <div className="mt-6">
      <AdaptiveGoalCard adaptiveGoal={adaptiveGoal} />
    </div>
  );
}
