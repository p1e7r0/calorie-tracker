"use client";

import { GlobeIcon } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { importOpenFoodFactsFood } from "@/app/actions/open-food-facts";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { formatKcal } from "@/lib/nutrition/format";
import type { OpenFoodFactsCandidate } from "@/lib/open-food-facts";
import type { LoggableItem } from "@/server/loggable";

type SearchState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "failed" }
  | { status: "done"; products: OpenFoodFactsCandidate[] };

export function OpenFoodFactsResults({ query, onOpenFood }: { query: string; onOpenFood: (item: LoggableItem) => void }) {
  const [state, setState] = useState<SearchState>({ status: "idle" });
  const [importingCode, setImportingCode] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  async function search() {
    setState({ status: "loading" });
    try {
      const response = await fetch(`/api/open-food-facts/search?q=${encodeURIComponent(query)}`);
      if (!response.ok) throw new Error(String(response.status));
      const body = (await response.json()) as { products: OpenFoodFactsCandidate[] };
      setState({ status: "done", products: body.products });
    } catch {
      setState({ status: "failed" });
    }
  }

  function importProduct(product: OpenFoodFactsCandidate) {
    setImportingCode(product.code);
    startTransition(async () => {
      const result = await importOpenFoodFactsFood(product.code);
      setImportingCode(null);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      onOpenFood(result.data.item);
    });
  }

  if (state.status === "idle") {
    return (
      <Button variant="ghost" className="mt-1 w-full justify-start gap-3 px-2 py-3 text-sm font-medium" onClick={search}>
        <span className="flex size-8 items-center justify-center rounded-full bg-secondary">
          <GlobeIcon className="size-4" />
        </span>
        Cerca «{query}» su Open Food Facts
      </Button>
    );
  }

  return (
    <section className="mt-4" aria-label="Risultati da Open Food Facts">
      <h2 className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
        <GlobeIcon className="size-4" />
        Da Open Food Facts
      </h2>
      {state.status === "loading" ? (
        <div className="flex justify-center py-6">
          <Spinner />
        </div>
      ) : state.status === "failed" ? (
        <p className="py-4 text-sm text-muted-foreground">
          Open Food Facts non risponde.{" "}
          <button type="button" className="font-medium text-foreground underline" onClick={search}>
            Riprova
          </button>
        </p>
      ) : state.products.length === 0 ? (
        <p className="py-4 text-sm text-muted-foreground">Nessun prodotto con valori nutrizionali.</p>
      ) : (
        <ul className="divide-y">
          {state.products.map((product) => (
            <li key={product.code}>
              <button
                type="button"
                disabled={importingCode !== null}
                onClick={() => importProduct(product)}
                className="flex w-full items-center gap-3 px-1 py-2.5 text-left transition-colors outline-none hover:bg-muted/50 focus-visible:bg-muted/60 disabled:opacity-60"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate">{product.name}</span>
                  <span className="block truncate text-sm text-muted-foreground">
                    {[product.brand, `${formatKcal(product.kcal)} kcal per 100 g`].filter(Boolean).join(", ")}
                  </span>
                </span>
                {importingCode === product.code ? <Spinner /> : null}
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
