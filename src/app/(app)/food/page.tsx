import type { Metadata } from "next";
import { PageHeader } from "@/components/app-shell/page-header";

export const metadata: Metadata = { title: "Cibo" };

export default function FoodPage() {
  return <PageHeader title="Cibo" />;
}
