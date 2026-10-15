import type { Metadata } from "next";
import { PageHeader } from "@/components/app-shell/page-header";

export const metadata: Metadata = { title: "Aggiungi" };

export default function AddPage() {
  return <PageHeader title="Aggiungi" />;
}
