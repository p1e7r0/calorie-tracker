import type { Metadata } from "next";
import { Suspense } from "react";
import { BackHeader } from "@/components/app-shell/back-header";
import { ScreenBody } from "@/components/app-shell/screen";
import { FoodForm } from "@/components/food/food-form";
import { emptyFoodFormValues } from "@/components/food/food-form-values";
import { safeInternalPath } from "@/lib/safe-path";

export const metadata: Metadata = { title: "Nuovo alimento" };

export default function NewFoodPage({ searchParams }: PageProps<"/food/new">) {
  return (
    <Suspense>
      <NewFood searchParams={searchParams} />
    </Suspense>
  );
}

async function NewFood({ searchParams }: Pick<PageProps<"/food/new">, "searchParams">) {
  const { name, next, barcode } = await searchParams;
  const redirectTo = typeof next === "string" ? safeInternalPath(next, "/food") : undefined;
  return (
    <>
      <BackHeader title="Nuovo alimento" backHref={redirectTo ?? "/food"} />
      <ScreenBody>
        <FoodForm
          submitLabel={redirectTo?.startsWith("/add") ? "Crea e aggiungi" : "Crea alimento"}
          redirectTo={redirectTo}
          initialValues={{
            ...emptyFoodFormValues,
            name: typeof name === "string" ? name : "",
            barcode: typeof barcode === "string" ? barcode : "",
          }}
        />
      </ScreenBody>
    </>
  );
}
