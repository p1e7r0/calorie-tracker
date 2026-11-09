"use client";

import { ArrowLeftIcon, ChefHatIcon, SearchIcon, XIcon } from "lucide-react";
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
import type { LoggableFood, LoggableItem, LoggableRecipe } from "@/server/loggable";

export type PickedIngredient = { item: LoggableItem; grams: number };

function initialQuantity(item: LoggableItem) {
  if (item.type === "recipe") return String(Math.round(item.servingWeightG) || 100);
  return String(item.portions[0]?.grams ?? 100);
}

function itemShortcuts(item: LoggableItem) {
  if (item.type === "food") {
    return item.portions.map((portion) => gramsShortcut(portion.label, portion.grams, item.unit, true));
  }
  return [
    gramsShortcut("1 porzione", Math.round(item.servingWeightG), "g", true),
    gramsShortcut("Tutta", Math.round(item.finalWeightG), "g"),
  ].filter((shortcut) => shortcut.value > 0);
}

export function IngredientPicker({
  suggestions,
  excludedRecipeId,
  onPick,
  onOpenChange,
}: {
  suggestions: LoggableFood[];
  excludedRecipeId?: string;
  onPick: (ingredient: PickedIngredient) => void;
  onOpenChange: (open: boolean) => void;
}) {
  const [query, setQuery] = useState("");
  const [selectedItem, setSelectedItem] = useState<LoggableItem | null>(null);
  const [quantity, setQuantity] = useState("100");
  const search = useFoodSearch(query);
  const foods = search.isActive ? (search.results?.foods ?? []) : suggestions;
  const recipes: LoggableRecipe[] = search.isActive
    ? (search.results?.recipes ?? []).filter((recipe) => recipe.id !== excludedRecipeId)
    : [];
  const items: LoggableItem[] = [...recipes, ...foods];
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
      className="absolute inset-0 z-30 flex flex-col bg-background"
    >
      <div className="mx-auto flex min-h-0 w-full max-w-md flex-1 flex-col px-4 pt-safe">
        {selectedItem ? (
          <>
            <header className="-ml-2 flex h-14 shrink-0 items-center gap-1">
              <Button variant="ghost" size="icon" aria-label="Torna alla ricerca" onClick={() => setSelectedItem(null)}>
                <ArrowLeftIcon />
              </Button>
              <h2 id={titleId} className="min-w-0 truncate font-heading text-lg font-semibold tracking-tight">
                {selectedItem.name}
              </h2>
            </header>
            <ScreenBody className="flex flex-col gap-4 pt-1">
              <QuantityField
                label={selectedItem.type === "recipe" ? "Quantità da cotto" : "Quantità a crudo"}
                unit={selectedItem.type === "recipe" ? "g" : selectedItem.unit}
                value={quantity}
                autoFocus
                onValueChange={(value) => setQuantity(value)}
                shortcuts={itemShortcuts(selectedItem)}
              />
              {selectedItem.type === "recipe" && !selectedItem.hasCookedWeight ? (
                <p className="text-sm text-muted-foreground">
                  Questa ricetta non ha il peso da cotto: i grammi valgono come peso a crudo.
                </p>
              ) : null}
              <div className="flex items-center justify-between rounded-xl bg-muted/60 px-3 py-2.5">
                <MacroLine nutrients={scaleNutrients(selectedItem.per100, grams ?? 0)} />
                <span className="font-heading text-xl font-semibold">
                  {formatKcal(scaleNutrients(selectedItem.per100, grams ?? 0).kcal)}{" "}
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
                  if (grams && grams > 0) onPick({ item: selectedItem, grams });
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
              ) : items.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  {search.isActive ? "Nessun alimento o ricetta trovati." : "Cerca un alimento o una tua ricetta."}
                </p>
              ) : (
                <ul className="divide-y">
                  {items.map((item) => (
                    <li key={`${item.type}-${item.id}`}>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedItem(item);
                          setQuantity(initialQuantity(item));
                        }}
                        className="flex w-full flex-col px-1 py-2.5 text-left outline-none hover:bg-muted/50 focus-visible:bg-muted/60"
                      >
                        <span className="flex items-center gap-1.5">
                          {item.type === "recipe" ? (
                            <ChefHatIcon aria-label="Ricetta" className="size-4 shrink-0 text-muted-foreground" />
                          ) : null}
                          <span className="truncate">{item.name}</span>
                        </span>
                        <span className="truncate text-sm text-muted-foreground">
                          {item.type === "recipe"
                            ? `Ricetta, ${formatKcal(item.per100.kcal)} kcal per 100 g`
                            : [item.brand, `${formatKcal(item.per100.kcal)} kcal per 100 ${item.unit}`]
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
                  placeholder="Cerca un alimento o una ricetta"
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
