import type { Metadata } from "next";
import { PageHeader } from "@/components/app-shell/page-header";

export const metadata: Metadata = { title: "Progressi" };

export default function ProgressPage() {
  return <PageHeader title="Progressi" />;
}
