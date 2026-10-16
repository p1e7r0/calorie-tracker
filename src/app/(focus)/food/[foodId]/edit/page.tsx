import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { BackHeader } from "@/components/app-shell/back-header";
import { ScreenBody } from "@/components/app-shell/screen";
import { FoodForm } from "@/components/food/food-form";
import { toFormNumber } from "@/components/food/food-form-values";
import { getCurrentUser } from "@/lib/auth/session";
import { getFoodDetail } from "@/server/foods";

export const metadata: Metadata = { title: "Modifica alimento" };

export default function EditFoodPage({ params }: PageProps<"/food/[foodId]/edit">) {
  return (
    <Suspense>
      <EditFood params={params} />
    </Suspense>
  );
}

async function EditFood({ params }: Pick<PageProps<"/food/[foodId]/edit">, "params">) {
  const user = await getCurrentUser();
  const { foodId } = await params;
  const detail = /^[0-9a-f-]{36}$/.test(foodId) ? await getFoodDetail(user.id, foodId) : null;
  if (!detail) notFound();

  return (
    <>
      <BackHeader title="Modifica alimento" backHref={`/food/${detail.id}`} />
      <ScreenBody>
        <FoodForm
          foodId={detail.id}
          isGlobalCopy={!detail.isOwn}
          submitLabel={detail.isOwn ? "Salva" : "Salva la mia copia"}
          initialValues={{
            name: detail.name,
            brand: detail.brand ?? "",
            barcode: detail.barcode ?? "",
            unit: detail.unit,
            kcal: toFormNumber(detail.kcal),
            protein: toFormNumber(detail.protein),
            carbs: toFormNumber(detail.carbs),
            sugars: toFormNumber(detail.sugars),
            fat: toFormNumber(detail.fat),
            saturatedFat: toFormNumber(detail.saturatedFat),
            fiber: toFormNumber(detail.fiber),
            salt: toFormNumber(detail.salt),
            portions: detail.portions.map((portion) => ({ label: portion.label, grams: toFormNumber(portion.grams) })),
          }}
        />
      </ScreenBody>
    </>
  );
}
