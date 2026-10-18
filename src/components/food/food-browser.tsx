"use client";

import { ChefHatIcon, ChevronRightIcon, PlusIcon, SearchIcon, StarIcon, XIcon } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { ScreenBody, ScreenFooter } from "@/components/app-shell/screen";
import { buttonVariants } from "@/components/ui/button";
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from "@/components/ui/input-group";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatKcal } from "@/lib/nutrition/format";
import { cn } from "@/lib/utils";
import type { LoggableFood, LoggableRecipe } from "@/server/loggable";
import { useFoodSearch } from "./use-food-search";

export type SavedMealSummary = { id: string; name: string; itemCount: number; kcal: number };

export function FoodBrowser({
  ownFoods,
  favoriteFoods,
  mostUsedFoods,
  recipes,
  savedMeals,
  initialTab,
}: {
  ownFoods: LoggableFood[];
  favoriteFoods: LoggableFood[];
  mostUsedFoods: LoggableFood[];
  recipes: LoggableRecipe[];
  savedMeals: SavedMealSummary[];
  initialTab: string;
}) {
  const [query, setQuery] = useState("");
  const search = useFoodSearch(query);
  const foodFilters = [
    { value: "used", label: "Più usati", items: mostUsedFoods, empty: "Qui compaiono gli alimenti che registri più spesso." },
    { value: "favorites", label: "Preferiti", items: favoriteFoods, empty: "Tocca la stella su un alimento per vederlo qui." },
    { value: "own", label: "Creati da te", items: ownFoods, empty: "Gli alimenti che crei compaiono qui." },
  ] as const;
  const [foodFilter, setFoodFilter] = useState<(typeof foodFilters)[number]["value"]>(() =>
    mostUsedFoods.length > 0 ? "used" : favoriteFoods.length > 0 ? "favorites" : "own",
  );
  const activeFilter = foodFilters.find((filter) => filter.value === foodFilter)!;

  return (
    <>
      {search.isActive ? (
        <ScreenBody className="flex flex-col gap-3">
          {search.results ? (
            <>
              <BrowserList
                items={[...search.results.recipes, ...search.results.foods]}
                emptyMessage={`Nessun risultato per «${query.trim()}».`}
              />
              <Link
                href={`/food/new?name=${encodeURIComponent(query.trim())}`}
                className={buttonVariants({ variant: "outline", className: "w-fit" })}
              >
                <PlusIcon />
                Crea «{query.trim()}»
              </Link>
            </>
          ) : search.failed ? (
            <p className="py-6 text-center text-sm text-muted-foreground">La ricerca non ha risposto. Riprova tra poco.</p>
          ) : (
            <div className="flex justify-center py-8">
              <Spinner />
            </div>
          )}
        </ScreenBody>
      ) : (
        <Tabs defaultValue={initialTab} className="min-h-0 flex-1 gap-0">
          <FoodTabsList />
          <ScreenBody>
            <TabsContent value="foods" className="flex flex-col gap-4">
              <Link href="/food/new" className={buttonVariants({ variant: "outline", size: "lg" })}>
                <PlusIcon />
                Nuovo alimento
              </Link>
              <section aria-label="Elenco degli alimenti">
                <div className="-mx-4 flex gap-1.5 overflow-x-auto px-4 [scrollbar-width:none]" role="tablist" aria-label="Mostra">
                  {foodFilters.map((filter) => (
                    <button
                      key={filter.value}
                      type="button"
                      role="tab"
                      aria-selected={filter.value === foodFilter}
                      onClick={() => setFoodFilter(filter.value)}
                      className={cn(
                        "flex shrink-0 items-baseline gap-1.5 rounded-full border px-3 py-1.5 text-sm transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                        filter.value === foodFilter ? "border-foreground bg-foreground text-background" : "bg-card",
                      )}
                    >
                      {filter.label}
                      <span className={cn("text-xs", filter.value === foodFilter ? "text-background/70" : "text-muted-foreground")}>
                        {filter.items.length}
                      </span>
                    </button>
                  ))}
                </div>
                <BrowserList items={activeFilter.items} emptyMessage={activeFilter.empty} />
              </section>
            </TabsContent>
            <TabsContent value="recipes" className="flex flex-col gap-4">
              <Link href="/recipes/new" className={buttonVariants({ variant: "outline", size: "lg" })}>
                <PlusIcon />
                Nuova ricetta
              </Link>
              <BrowserList items={recipes} emptyMessage="Crea una ricetta: pesi gli ingredienti, l'app calcola il resto." />
            </TabsContent>
            <TabsContent value="meals" className="flex flex-col gap-4">
              <p className="text-sm text-muted-foreground">
                Salva un pasto dal diario con il menu ⋯ e aggiungilo in un tocco la prossima volta.
              </p>
              {savedMeals.length > 0 ? (
                <ul className="divide-y">
                  {savedMeals.map((savedMeal) => (
                    <li key={savedMeal.id}>
                      <Link href={`/meals/${savedMeal.id}`} className="flex items-center gap-3 py-2.5">
                        <span className="min-w-0 flex-1">
                          <span className="block truncate">{savedMeal.name}</span>
                          <span className="block text-sm text-muted-foreground">
                            {savedMeal.itemCount} {savedMeal.itemCount === 1 ? "voce" : "voci"}, {formatKcal(savedMeal.kcal)} kcal
                          </span>
                        </span>
                        <ChevronRightIcon className="size-4 text-muted-foreground" />
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : null}
            </TabsContent>
          </ScreenBody>
        </Tabs>
      )}
      <ScreenFooter coversSafeArea={false}>
        <CatalogSearchField query={query} onQueryChange={setQuery} />
      </ScreenFooter>
    </>
  );
}

export function FoodBrowserSkeleton() {
  return (
    <>
      <Tabs value="foods" className="min-h-0 flex-1 gap-0">
        <div inert aria-hidden="true" className="contents">
          <FoodTabsList />
        </div>
        <ScreenBody className="flex flex-col gap-4">
          <Skeleton className="h-11 w-full rounded-lg" />
          <section>
            <div className="flex gap-1.5">
              {["w-24", "w-24", "w-28"].map((width, index) => (
                <Skeleton key={index} className={cn("h-8.5 rounded-full", width)} />
              ))}
            </div>
            <div className="divide-y">
              {Array.from({ length: 6 }, (_, index) => (
                <div key={index} className="flex flex-col gap-1.5 py-3.5">
                  <Skeleton className="h-4 w-3/5" />
                  <Skeleton className="h-3.5 w-2/5" />
                </div>
              ))}
            </div>
          </section>
        </ScreenBody>
      </Tabs>
      <ScreenFooter coversSafeArea={false}>
        <div inert aria-hidden="true">
          <CatalogSearchField query="" />
        </div>
      </ScreenFooter>
    </>
  );
}

function FoodTabsList() {
  return (
    <TabsList className="mb-3 w-full shrink-0">
      <TabsTrigger value="foods">Alimenti</TabsTrigger>
      <TabsTrigger value="recipes">Ricette</TabsTrigger>
      <TabsTrigger value="meals">Pasti salvati</TabsTrigger>
    </TabsList>
  );
}

function CatalogSearchField({ query, onQueryChange }: { query: string; onQueryChange?: (query: string) => void }) {
  return (
    <InputGroup className="h-11 bg-card">
      <InputGroupAddon>
        <SearchIcon />
      </InputGroupAddon>
      <InputGroupInput
        type="search"
        enterKeyHint="search"
        placeholder="Cerca nel catalogo"
        aria-label="Cerca nel catalogo"
        value={query}
        readOnly={!onQueryChange}
        onChange={(event) => onQueryChange?.(event.target.value)}
      />
      {query && onQueryChange ? (
        <InputGroupAddon align="inline-end">
          <InputGroupButton size="icon-xs" aria-label="Cancella ricerca" onClick={() => onQueryChange("")}>
            <XIcon />
          </InputGroupButton>
        </InputGroupAddon>
      ) : null}
    </InputGroup>
  );
}

function BrowserList({ items, emptyMessage }: { items: (LoggableFood | LoggableRecipe)[]; emptyMessage: string }) {
  if (items.length === 0) return <p className="py-3 text-sm text-muted-foreground">{emptyMessage}</p>;
  return (
    <ul className="divide-y">
      {items.map((item) => (
        <li key={`${item.type}-${item.id}`}>
          <Link
            href={item.type === "recipe" ? `/recipes/${item.id}` : `/food/${item.id}`}
            className="flex items-center gap-3 py-2.5 outline-none focus-visible:bg-muted/60"
          >
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-1.5">
                {item.type === "recipe" ? <ChefHatIcon className="size-4 shrink-0 text-muted-foreground" aria-label="Ricetta" /> : null}
                <span className="truncate">{item.name}</span>
                {item.isFavorite ? <StarIcon className="size-3.5 shrink-0 fill-carbs text-carbs" aria-label="Preferito" /> : null}
              </span>
              <span className="block truncate text-sm text-muted-foreground">
                {item.type === "recipe"
                  ? `${formatKcal(item.perServing.kcal)} kcal a porzione, ${item.servings} ${item.servings === 1 ? "porzione" : "porzioni"}`
                  : [item.brand, `${formatKcal(item.per100.kcal)} kcal per 100 ${item.unit}`].filter(Boolean).join(", ")}
              </span>
            </span>
            <ChevronRightIcon className="size-4 shrink-0 text-muted-foreground" />
          </Link>
        </li>
      ))}
    </ul>
  );
}
