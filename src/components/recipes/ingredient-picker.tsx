"use client";

import { ArrowLeftIcon, SearchIcon, XIcon } from "lucide-react";
import { useEffect, useId, useState } from "react";
import { ScreenBody, ScreenFooter } from "@/components/app-shell/screen";
import { MacroLine } from "@/components/diary/macro-line";
import { gramsShortcut, QuantityField } from "@/components/diary/quantity-field";
import { useFoodSearch } from "@/components/food/use-food-search";
import { Button } from "@/components/ui/button";
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from "@/components/ui/input-group";
import { Spinner } from "@/components/ui/spinner";
import { formatKcal, parseDecimal } from "@/lib/nutrition/format";
import { scaleNutrients } from "@/lib/nutrition/nutrients";
import type { LoggableFood } from "@/server/loggable";

export type PickedIngredient = { food: LoggableFood; grams: number };

export function IngredientPicker({
  suggestions,
  onPick,
  onOpenChange,
}: {
  suggestions: LoggableFood[];
  onPick: (ingredient: PickedIngredient) => void;
  onOpenChange: (open: boolean) => void;
}) {
  const [query, setQuery] = useState("");
  const [selectedFood, setSelectedFood] = useState<LoggableFood | null>(null);
  const [quantity, setQuantity] = useState("100");
  const search = useFoodSearch(query);
  const foods = search.isActive ? (search.results?.foods ?? []) : suggestions;
  const grams = parseDecimal(quantity);
  const titleId = useId();

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onOpenChange(false);
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onOpenChange]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      className="fixed inset-0 z-30 flex flex-col bg-background"
    >
      <div className="mx-auto flex min-h-0 w-full max-w-md flex-1 flex-col px-4 pt-safe">
        {selectedFood ? (
          <>
            <header className="-ml-2 flex h-14 shrink-0 items-center gap-1">
              <Button variant="ghost" size="icon" aria-label="Torna alla ricerca" onClick={() => setSelectedFood(null)}>
                <ArrowLeftIcon />
              </Button>
              <h2 id={titleId} className="min-w-0 truncate font-heading text-lg font-semibold tracking-tight">
                {selectedFood.name}
              </h2>
            </header>
            <ScreenBody className="flex flex-col gap-4 pt-1">
              <QuantityField
                label="Quantità a crudo"
                unit={selectedFood.unit}
                value={quantity}
                autoFocus
                onValueChange={(value) => setQuantity(value)}
                shortcuts={selectedFood.portions.map((portion) =>
                  gramsShortcut(portion.label, portion.grams, selectedFood.unit, true),
                )}
              />
              <div className="flex items-center justify-between rounded-xl bg-muted/60 px-3 py-2.5">
                <MacroLine nutrients={scaleNutrients(selectedFood.per100, grams ?? 0)} />
                <span className="font-heading text-xl font-semibold">
                  {formatKcal(scaleNutrients(selectedFood.per100, grams ?? 0).kcal)}{" "}
                  <span className="text-sm font-medium text-muted-foreground">kcal</span>
                </span>
              </div>
            </ScreenBody>
            <ScreenFooter>
              <Button
                size="lg"
                className="w-full"
                disabled={!grams || grams <= 0}
                onClick={() => {
                  if (grams && grams > 0) onPick({ food: selectedFood, grams });
                }}
              >
                Aggiungi ingrediente
              </Button>
            </ScreenFooter>
          </>
        ) : (
          <>
            <header className="-ml-2 flex h-14 shrink-0 items-center gap-1">
              <Button variant="ghost" size="icon" aria-label="Chiudi" onClick={() => onOpenChange(false)}>
                <ArrowLeftIcon />
              </Button>
              <h2 id={titleId} className="font-heading text-lg font-semibold tracking-tight">
                Aggiungi ingrediente
              </h2>
            </header>
            <ScreenBody>
              {search.isActive && !search.results ? (
                <div className="flex justify-center py-6">
                  <Spinner />
                </div>
              ) : foods.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  {search.isActive ? "Nessun alimento trovato." : "Cerca un alimento da aggiungere."}
                </p>
              ) : (
                <ul className="divide-y">
                  {foods.map((food) => (
                    <li key={food.id}>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedFood(food);
                          setQuantity(String(food.portions[0]?.grams ?? 100));
                        }}
                        className="flex w-full flex-col px-1 py-2.5 text-left outline-none hover:bg-muted/50 focus-visible:bg-muted/60"
                      >
                        <span className="truncate">{food.name}</span>
                        <span className="truncate text-sm text-muted-foreground">
                          {[food.brand, `${formatKcal(food.per100.kcal)} kcal per 100 ${food.unit}`]
                            .filter(Boolean)
                            .join(", ")}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </ScreenBody>
            <ScreenFooter>
              <InputGroup className="h-11 bg-card">
                <InputGroupAddon>
                  <SearchIcon />
                </InputGroupAddon>
                <InputGroupInput
                  type="search"
                  autoFocus
                  enterKeyHint="search"
                  placeholder="Cerca un ingrediente"
                  aria-label="Cerca un ingrediente"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                />
                {query ? (
                  <InputGroupAddon align="inline-end">
                    <InputGroupButton size="icon-xs" aria-label="Cancella ricerca" onClick={() => setQuery("")}>
                      <XIcon />
                    </InputGroupButton>
                  </InputGroupAddon>
                ) : null}
              </InputGroup>
            </ScreenFooter>
          </>
        )}
      </div>
    </div>
  );
}
