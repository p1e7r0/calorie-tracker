"use client";

import { ArrowLeftIcon, ChefHatIcon, SearchIcon, XIcon } from "lucide-react";
import { useEffect, useId, useState } from "react";
import { ItemQuantity, type QuantityItem } from "@/components/add/log-item-drawer";
import { ScreenBody, ScreenFooter } from "@/components/app-shell/screen";
import { useFoodSearch } from "@/components/food/use-food-search";
import { Button } from "@/components/ui/button";
import { Drawer, DrawerContent } from "@/components/ui/drawer";
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from "@/components/ui/input-group";
import { Spinner } from "@/components/ui/spinner";
import { formatKcal } from "@/lib/nutrition/format";
import type { Nutrients } from "@/lib/nutrition/nutrients";
import type { LoggableItem } from "@/server/loggable";

export type PickedStoredMealItem = { source: LoggableItem; item: QuantityItem; nutrients: Nutrients };

export function StoredMealItemPicker({
  suggestions,
  onPick,
  onOpenChange,
}: {
  suggestions: LoggableItem[];
  onPick: (picked: PickedStoredMealItem) => void;
  onOpenChange: (open: boolean) => void;
}) {
  const [query, setQuery] = useState("");
  const [selectedItem, setSelectedItem] = useState<LoggableItem | null>(null);
  const search = useFoodSearch(query);
  const items = search.isActive
    ? search.results
      ? [...search.results.recipes, ...search.results.foods]
      : []
    : suggestions;
  const titleId = useId();

  useEffect(() => {
    if (selectedItem) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onOpenChange(false);
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onOpenChange, selectedItem]);

  return (
    <div role="dialog" aria-modal="true" aria-labelledby={titleId} className="app-viewport z-30 bg-background">
      <div className="mx-auto flex min-h-0 w-full max-w-md flex-1 flex-col px-4 pt-safe">
        <header className="-ml-2 flex h-14 shrink-0 items-center gap-1">
          <Button variant="ghost" size="icon" aria-label="Chiudi" onClick={() => onOpenChange(false)}>
            <ArrowLeftIcon />
          </Button>
          <h2 id={titleId} className="font-heading text-lg font-semibold tracking-tight">
            Aggiungi al pasto
          </h2>
        </header>
        <ScreenBody>
          {search.isActive && !search.results ? (
            <div className="flex justify-center py-6">
              {search.failed ? (
                <p className="text-sm text-muted-foreground">La ricerca non ha risposto. Riprova tra poco.</p>
              ) : (
                <Spinner />
              )}
            </div>
          ) : items.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              {search.isActive ? "Nessun risultato." : "Cerca un alimento o una ricetta."}
            </p>
          ) : (
            <ul className="divide-y">
              {items.map((item) => (
                <li key={`${item.type}-${item.id}`}>
                  <button
                    type="button"
                    onClick={() => setSelectedItem(item)}
                    className="flex w-full flex-col px-1 py-2.5 text-left outline-none hover:bg-muted/50 focus-visible:bg-muted/60"
                  >
                    <span className="flex items-center gap-1.5">
                      {item.type === "recipe" ? (
                        <ChefHatIcon className="size-4 shrink-0 text-muted-foreground" aria-label="Ricetta" />
                      ) : null}
                      <span className="truncate">{item.name}</span>
                    </span>
                    <span className="truncate text-sm text-muted-foreground">
                      {item.type === "recipe"
                        ? `${formatKcal(item.perServing.kcal)} kcal a porzione`
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
              aria-label="Cerca un alimento o una ricetta"
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
      </div>
      {selectedItem ? (
        <Drawer
          open
          onOpenChange={(open) => {
            if (!open) setSelectedItem(null);
          }}
        >
          <DrawerContent>
            <ItemQuantity
              key={`${selectedItem.type}-${selectedItem.id}`}
              item={selectedItem}
              submitLabel="Aggiungi al pasto"
              isPending={false}
              onSubmit={(item, nutrients) => onPick({ source: selectedItem, item, nutrients })}
            />
          </DrawerContent>
        </Drawer>
      ) : null}
    </div>
  );
}
