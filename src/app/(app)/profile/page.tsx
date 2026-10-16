import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHeader } from "@/components/app-shell/page-header";
import { ScreenBody } from "@/components/app-shell/screen";
import { toFormNumber } from "@/components/food/food-form-values";
import { AccountSummary } from "@/components/profile/account-summary";
import { ProfileForm } from "@/components/profile/profile-form";
import { ThemeSwitcher } from "@/components/theme-switcher";
import { Skeleton } from "@/components/ui/skeleton";
import { getCurrentUser } from "@/lib/auth/session";
import { todayIsoDate } from "@/lib/nutrition/days";
import { getProfileWithLatestWeight } from "@/server/profile";

export const metadata: Metadata = { title: "Profilo" };

export default function ProfilePage({ searchParams }: PageProps<"/profile">) {
  return (
    <>
      <PageHeader title="Profilo" />
      <ScreenBody>
        <section className="py-2">
          <Suspense fallback={<Skeleton className="h-11 w-full" />}>
            <AccountSummary />
          </Suspense>
        </section>
        <section className="py-4">
          <h2 className="mb-3 font-heading text-lg font-semibold tracking-tight">I tuoi dati e l&apos;obiettivo</h2>
          <Suspense fallback={<Skeleton className="h-96 w-full" />}>
            <Goals searchParams={searchParams} />
          </Suspense>
        </section>
        <section className="flex flex-col gap-2 py-4">
          <h2 className="text-sm font-medium text-muted-foreground">Tema</h2>
          <ThemeSwitcher />
        </section>
      </ScreenBody>
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
