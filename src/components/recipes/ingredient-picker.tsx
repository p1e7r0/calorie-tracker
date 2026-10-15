"use client";

import { ArrowLeftIcon, SearchIcon } from "lucide-react";
import { useState } from "react";
import { MacroLine } from "@/components/diary/macro-line";
import { gramsShortcut, QuantityField } from "@/components/diary/quantity-field";
import { useFoodSearch } from "@/components/food/use-food-search";
import { Button } from "@/components/ui/button";
import { Drawer, DrawerContent, DrawerFooter, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
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

  return (
    <Drawer open onOpenChange={onOpenChange}>
      <DrawerContent className="data-[swipe-axis=y]:[--drawer-content-max-height:calc(100dvh-3rem)]">
        {selectedFood ? (
          <>
            <DrawerHeader className="flex-row items-center gap-1 text-left">
              <Button variant="ghost" size="icon" aria-label="Torna alla ricerca" onClick={() => setSelectedFood(null)}>
                <ArrowLeftIcon />
              </Button>
              <DrawerTitle className="min-w-0 truncate text-lg">{selectedFood.name}</DrawerTitle>
            </DrawerHeader>
            <div className="flex flex-col gap-4 p-4">
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
            </div>
            <DrawerFooter className="pb-[max(1rem,env(safe-area-inset-bottom))]">
              <Button
                size="lg"
                disabled={!grams || grams <= 0}
                onClick={() => {
                  if (grams && grams > 0) onPick({ food: selectedFood, grams });
                }}
              >
                Aggiungi ingrediente
              </Button>
            </DrawerFooter>
          </>
        ) : (
          <>
            <DrawerHeader className="text-left">
              <DrawerTitle className="text-lg">Aggiungi ingrediente</DrawerTitle>
            </DrawerHeader>
            <div className="flex min-h-0 flex-1 flex-col gap-2 p-4 pt-3">
              <InputGroup className="h-11 shrink-0">
                <InputGroupAddon>
                  <SearchIcon />
                </InputGroupAddon>
                <InputGroupInput
                  type="search"
                  autoFocus
                  placeholder="Cerca un ingrediente"
                  aria-label="Cerca un ingrediente"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                />
              </InputGroup>
              <div className="min-h-64 overflow-y-auto">
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
              </div>
            </div>
          </>
        )}
      </DrawerContent>
    </Drawer>
  );
}
