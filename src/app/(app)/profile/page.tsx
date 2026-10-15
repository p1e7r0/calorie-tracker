import type { Metadata } from "next";
import { PageHeader } from "@/components/app-shell/page-header";
import { ThemeSwitcher } from "@/components/theme-switcher";

export const metadata: Metadata = { title: "Profilo" };

export default function ProfilePage() {
  return (
    <>
      <PageHeader title="Profilo" />
      <section className="flex flex-col gap-2 py-2">
        <h2 className="text-sm font-medium text-muted-foreground">Tema</h2>
        <ThemeSwitcher />
      </section>
    </>
  );
}
