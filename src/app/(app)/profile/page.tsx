import { DownloadIcon } from "lucide-react";
import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHeader } from "@/components/app-shell/page-header";
import { ScreenBody, ScreenFooter } from "@/components/app-shell/screen";
import { toFormNumber } from "@/components/food/food-form-values";
import { AccountSummary } from "@/components/profile/account-summary";
import { AdaptiveGoalCard } from "@/components/profile/adaptive-goal-card";
import { ClaudeConnectorSettings } from "@/components/profile/claude-connector-settings";
import { DeleteAccountButton } from "@/components/profile/delete-account-button";
import { ReminderSettings } from "@/components/profile/reminder-settings";
import { SiriShortcutSettings } from "@/components/profile/siri-shortcut-settings";
import { ProfileForm } from "@/components/profile/profile-form";
import { ThemeSwitcher } from "@/components/theme-switcher";
import { buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { applicationUrl, mcpResourceUrl } from "@/lib/auth/mcp-resource";
import { getCurrentUser } from "@/lib/auth/session";
import { todayIsoDate } from "@/lib/nutrition/days";
import { getAdaptiveGoal } from "@/server/adaptive-goal";
import { isAiEnabled } from "@/server/ai";
import { getApiTokenInfo } from "@/server/api-tokens";
import { getClaudeClientCreatedAt } from "@/server/oauth-clients";
import { getProfileWithLatestWeight } from "@/server/profile";
import { isPushEnabled } from "@/server/push";

export const metadata: Metadata = { title: "Profilo" };

const exportLinks = [
  { kind: "diary", label: "Diario" },
  { kind: "measurements", label: "Misure" },
  { kind: "foods", label: "Alimenti" },
] as const;

export default function ProfilePage({ searchParams }: PageProps<"/profile">) {
  return (
    <>
      <PageHeader title="Profilo" />
      <Tabs defaultValue="goal" className="min-h-0 flex-1 gap-0">
        <TabsList className="mb-3 w-full shrink-0">
          <TabsTrigger value="goal">Dati e obiettivo</TabsTrigger>
          <TabsTrigger value="settings">Impostazioni</TabsTrigger>
        </TabsList>
        <TabsContent value="goal" className="flex min-h-0 flex-col">
          <Suspense
            fallback={
              <>
                <ScreenBody>
                  <Skeleton className="h-96 w-full" />
                  <Skeleton className="mt-6 h-40 w-full" />
                </ScreenBody>
                <ScreenFooter coversSafeArea={false}>
                  <Skeleton className="h-11 w-full" />
                </ScreenFooter>
              </>
            }
          >
            <Goals searchParams={searchParams} />
          </Suspense>
        </TabsContent>
        <TabsContent value="settings" className="flex min-h-0 flex-col">
          <ScreenBody className="flex flex-col gap-6">
            <section aria-labelledby="account-heading" className="flex flex-col gap-2">
              <h2 id="account-heading" className="text-sm font-medium text-muted-foreground">
                Account
              </h2>
              <Suspense fallback={<Skeleton className="h-11 w-full" />}>
                <AccountSummary />
              </Suspense>
            </section>
            {isPushEnabled ? (
              <section aria-labelledby="reminders-heading" className="flex flex-col gap-2">
                <h2 id="reminders-heading" className="text-sm font-medium text-muted-foreground">
                  Promemoria
                </h2>
                <Suspense fallback={<Skeleton className="h-24 w-full" />}>
                  <Reminders />
                </Suspense>
              </section>
            ) : null}
            <section aria-labelledby="claude-heading" className="flex flex-col gap-2">
              <h2 id="claude-heading" className="text-sm font-medium text-muted-foreground">
                Claude
              </h2>
              <Suspense fallback={<Skeleton className="h-48 w-full" />}>
                <ClaudeConnector />
              </Suspense>
            </section>
            {isAiEnabled ? (
              <section aria-labelledby="siri-heading" className="flex flex-col gap-2">
                <h2 id="siri-heading" className="text-sm font-medium text-muted-foreground">
                  Siri
                </h2>
                <Suspense fallback={<Skeleton className="h-48 w-full" />}>
                  <SiriShortcut />
                </Suspense>
              </section>
            ) : null}
            <section aria-labelledby="theme-heading" className="flex flex-col gap-2">
              <h2 id="theme-heading" className="text-sm font-medium text-muted-foreground">
                Tema
              </h2>
              <ThemeSwitcher />
            </section>
            <section aria-labelledby="data-heading" className="flex flex-col gap-2">
              <h2 id="data-heading" className="text-sm font-medium text-muted-foreground">
                I tuoi dati
              </h2>
              <p className="text-sm text-muted-foreground">File CSV che si aprono con Excel o Numbers.</p>
              <div className="grid grid-cols-3 gap-2">
                {exportLinks.map((link) => (
                  <a
                    key={link.kind}
                    href={`/api/export/${link.kind}`}
                    download
                    className={buttonVariants({ variant: "outline", className: "px-2" })}
                  >
                    <DownloadIcon />
                    {link.label}
                  </a>
                ))}
              </div>
            </section>
            <section aria-labelledby="delete-heading" className="flex flex-col gap-2">
              <h2 id="delete-heading" className="text-sm font-medium text-muted-foreground">
                Elimina l&apos;account
              </h2>
              <DeleteAccountButton />
            </section>
          </ScreenBody>
        </TabsContent>
      </Tabs>
    </>
  );
}

async function Goals({ searchParams }: Pick<PageProps<"/profile">, "searchParams">) {
  const user = await getCurrentUser();
  const { setup } = await searchParams;
  const { profile, latestWeight } = await getProfileWithLatestWeight(user.id);
  return (
    <ProfileForm
      today={todayIsoDate()}
      showSetupNotice={Boolean(setup) && !profile}
      initialValues={{
        sex: profile?.sex ?? null,
        birthDate: profile?.birthDate ?? "",
        heightCm: toFormNumber(profile?.heightCm),
        weightKg: toFormNumber(latestWeight?.weightKg),
        activityLevel: profile?.activityLevel ?? "light",
        goal: profile?.goal ?? "maintain",
        weeklyRateKg: profile?.weeklyRateKg ?? 0.5,
          targetWeightKg: toFormNumber(profile?.targetWeightKg),
        customized: profile?.targetsCustomized ?? false,
        kcal: profile?.targetsCustomized ? toFormNumber(profile.targetKcal) : "",
        proteinG: profile?.targetsCustomized ? toFormNumber(profile.targetProteinG) : "",
        carbsG: profile?.targetsCustomized ? toFormNumber(profile.targetCarbsG) : "",
        fatG: profile?.targetsCustomized ? toFormNumber(profile.targetFatG) : "",
      }}
    >
      <Suspense fallback={<Skeleton className="mt-6 h-40 w-full" />}>
        <AdaptiveGoal />
      </Suspense>
    </ProfileForm>
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

async function Reminders() {
  const user = await getCurrentUser();
  const { profile } = await getProfileWithLatestWeight(user.id);
  return (
    <ReminderSettings
      initialEvening={profile?.reminderEvening ?? false}
      initialWeighInWeekday={profile?.reminderWeighInWeekday ?? null}
    />
  );
}

async function ClaudeConnector() {
  const user = await getCurrentUser();
  const createdAt = await getClaudeClientCreatedAt(user.id);
  return <ClaudeConnectorSettings serverUrl={mcpResourceUrl} credentialsCreatedAt={createdAt?.toISOString() ?? null} />;
}

async function SiriShortcut() {
  const user = await getCurrentUser();
  const token = await getApiTokenInfo(user.id);
  return (
    <SiriShortcutSettings
      endpointUrl={`${applicationUrl}/api/shortcuts/meal`}
      tokenCreatedAt={token?.createdAt.toISOString() ?? null}
      tokenLastUsedAt={token?.lastUsedAt?.toISOString() ?? null}
    />
  );
}
