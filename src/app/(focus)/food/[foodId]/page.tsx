import { PencilIcon, PlusIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { BackHeader } from "@/components/app-shell/back-header";
import { ArchiveFoodButton } from "@/components/food/archive-food-button";
import { FavoriteButton } from "@/components/food/favorite-button";
import { buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { getCurrentUser } from "@/lib/auth/session";
import { formatDecimal, formatGrams, formatKcal } from "@/lib/nutrition/format";
import { micronutrientGroups, micronutrientInfo } from "@/lib/nutrition/micronutrients";
import { getFoodDetail } from "@/server/foods";

export const metadata: Metadata = { title: "Alimento" };

const sourceLabels = {
  swiss: "Banca dati svizzera dei valori nutritivi",
  open_food_facts: "Open Food Facts",
  user: "Creato da te",
} as const;

export default function FoodDetailPage({ params }: PageProps<"/food/[foodId]">) {
  return (
    <Suspense fallback={<Skeleton className="mt-16 h-64 w-full" />}>
      <FoodDetail params={params} />
    </Suspense>
  );
}

async function FoodDetail({ params }: Pick<PageProps<"/food/[foodId]">, "params">) {
  const user = await getCurrentUser();
  const { foodId } = await params;
  const food = /^[0-9a-f-]{36}$/.test(foodId) ? await getFoodDetail(user.id, foodId) : null;
  if (!food) notFound();

  const rows: { label: string; value: number | null; unit: string; indent?: boolean }[] = [
    { label: "Proteine", value: food.protein, unit: "g" },
    { label: "Carboidrati", value: food.carbs, unit: "g" },
    { label: "di cui zuccheri", value: food.sugars, unit: "g", indent: true },
    { label: "Grassi", value: food.fat, unit: "g" },
    { label: "di cui saturi", value: food.saturatedFat, unit: "g", indent: true },
    { label: "Fibre", value: food.fiber, unit: "g" },
    { label: "Sale", value: food.salt, unit: "g" },
  ];
  const micronutrients = Object.entries(food.micronutrients ?? {}).filter(([key]) => key in micronutrientInfo);

  return (
    <>
      <BackHeader
        title=""
        backHref="/food"
        actions={
          <>
            <FavoriteButton type="food" id={food.id} isFavorite={food.isFavorite} />
            {food.isOwn ? <ArchiveFoodButton foodId={food.id} name={food.name} /> : null}
          </>
        }
      />
      <h1 className="font-heading text-2xl leading-tight font-semibold tracking-tight">{food.name}</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        {[food.brand, food.category?.replaceAll("/", ", "), sourceLabels[food.source]].filter(Boolean).join(". ")}
      </p>

      <div className="mt-5 flex items-baseline gap-2">
        <span className="font-heading text-4xl font-semibold tracking-tight">{formatKcal(food.kcal)}</span>
        <span className="text-muted-foreground">kcal per 100 {food.unit}</span>
      </div>

      <dl className="mt-4 divide-y rounded-xl ring-1 ring-border">
        {rows.map((row) => (
          <div key={row.label} className="flex justify-between px-3 py-2 text-sm">
            <dt className={row.indent ? "pl-3 text-muted-foreground" : undefined}>{row.label}</dt>
            <dd className="font-medium">{row.value === null ? "–" : `${formatGrams(row.value)} ${row.unit}`}</dd>
          </div>
        ))}
      </dl>

      {food.portions.length > 0 ? (
        <section className="mt-5">
          <h2 className="mb-2 text-sm font-medium text-muted-foreground">Porzioni</h2>
          <ul className="flex flex-wrap gap-2">
            {food.portions.map((portion) => (
              <li key={portion.label} className="rounded-full border px-3 py-1 text-sm">
                {portion.label} <span className="text-muted-foreground">{formatGrams(portion.grams)} {food.unit}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {micronutrients.length > 0 ? (
        <section className="mt-5">
          {micronutrientGroups.map(({ group, label }) => {
            const entries = micronutrients.filter(([key]) => micronutrientInfo[key].group === group);
            if (entries.length === 0) return null;
            return (
              <details key={group} className="group border-b py-2">
                <summary className="cursor-pointer list-none py-1 text-sm font-medium">
                  {label} <span className="text-muted-foreground">({entries.length})</span>
                </summary>
                <dl className="mt-1">
                  {entries.map(([key, value]) => (
                    <div key={key} className="flex justify-between py-1 text-sm">
                      <dt className="text-muted-foreground">{micronutrientInfo[key].label}</dt>
                      <dd>
                        {formatDecimal(value)} {micronutrientInfo[key].unit}
                      </dd>
                    </div>
                  ))}
                </dl>
              </details>
            );
          })}
        </section>
      ) : null}

      <div className="sticky bottom-0 mt-6 -mx-4 grid grid-cols-2 gap-2 bg-background/95 px-4 pt-2 pb-[max(1rem,env(safe-area-inset-bottom))] backdrop-blur-md">
        <Link href={`/food/${food.id}/edit`} className={buttonVariants({ variant: "outline", size: "lg" })}>
          <PencilIcon />
          Modifica
        </Link>
        <Link href={`/add?food=${food.id}`} className={buttonVariants({ size: "lg" })}>
          <PlusIcon />
          Aggiungi
        </Link>
      </div>
    </>
  );
}
