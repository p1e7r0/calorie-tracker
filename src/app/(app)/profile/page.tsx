import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHeader } from "@/components/app-shell/page-header";
import { AccountSummary } from "@/components/profile/account-summary";
import { ThemeSwitcher } from "@/components/theme-switcher";
import { Skeleton } from "@/components/ui/skeleton";

export const metadata: Metadata = { title: "Profilo" };

export default function ProfilePage() {
  return (
    <>
      <PageHeader title="Profilo" />
      <section className="py-2">
        <Suspense fallback={<Skeleton className="h-11 w-full" />}>
          <AccountSummary />
        </Suspense>
      </section>
      <section className="flex flex-col gap-2 py-4">
        <h2 className="text-sm font-medium text-muted-foreground">Tema</h2>
        <ThemeSwitcher />
      </section>
    </>
  );
}
