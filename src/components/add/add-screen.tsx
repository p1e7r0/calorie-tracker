"use client";

import { ArrowLeftIcon, ChefHatIcon, FlameIcon, PlusIcon, SearchIcon, StarIcon, XIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { MealPicker } from "@/components/diary/meal-picker";
import { Button, buttonVariants } from "@/components/ui/button";
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from "@/components/ui/input-group";
import { Spinner } from "@/components/ui/spinner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatKcal } from "@/lib/nutrition/format";
import type { MealType } from "@/lib/nutrition/meals";
import { cn } from "@/lib/utils";
import type { LoggableFood, LoggableItem, LoggableRecipe } from "@/server/loggable";
import { LogItemDrawer } from "./log-item-drawer";
import { QuickKcalDrawer } from "./quick-kcal-drawer";
import { type SearchResults, useFoodSearch } from "@/components/food/use-food-search";

type AddScreenProperties = {
  day: string;
  initialMeal: MealType;
  recentFoods: LoggableFood[];
  favoriteFoods: LoggableFood[];
  recipes: LoggableRecipe[];
  initialItem: LoggableItem | null;
  backHref: string;
};

export function AddScreen(properties: AddScreenProperties) {
  const { bfcacheId } = useRouter();
  return <AddScreenContent key={bfcacheId} {...properties} />;
}

function AddScreenContent({
  day,
  initialMeal,
  recentFoods,
  favoriteFoods,
  recipes,
  initialItem,
  backHref,
}: AddScreenProperties) {
  const router = useRouter();
  const [meal, setMeal] = useState<MealType>(initialMeal);
  const [query, setQuery] = useState("");
  const [selectedItem, setSelectedItem] = useState<LoggableItem | null>(initialItem);
  const [quickKcalOpen, setQuickKcalOpen] = useState(false);
  const [loggedCount, setLoggedCount] = useState(0);
  const search = useFoodSearch(query);
  const trimmedQuery = query.trim();
  const createHref = `/food/new?name=${encodeURIComponent(trimmedQuery)}&next=${encodeURIComponent(`/add?date=${day}&meal=${meal}`)}`;

  function handleLogged() {
    setSelectedItem(null);
    setQuickKcalOpen(false);
    setLoggedCount((count) => count + 1);
  }

  return (
    <div className="flex flex-1 flex-col pb-24">
      <div className="sticky top-0 z-10 -mx-4 flex flex-col gap-2 bg-background/95 px-4 pt-2 pb-3 backdrop-blur-md">
        <div className="flex items-center gap-1">
          <Link href={backHref} aria-label="Torna al diario" className={buttonVariants({ variant: "ghost", size: "icon" })}>
            <ArrowLeftIcon />
          </Link>
          <InputGroup className="h-11 flex-1">
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
        </div>
        <MealPicker value={meal} onValueChange={setMeal} className="w-full" />
      </div>

      {search.isActive ? (
        <SearchResultsList
          query={trimmedQuery}
          isLoading={search.isLoading}
          failed={search.failed}
          results={search.results}
          createHref={createHref}
          onSelect={setSelectedItem}
        />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2 py-1">
            <Button variant="outline" size="lg" onClick={() => setQuickKcalOpen(true)}>
              <FlameIcon />
              Kcal veloci
            </Button>
            <Link href={createHref} className={buttonVariants({ variant: "outline", size: "lg" })}>
              <PlusIcon />
              Nuovo alimento
            </Link>
          </div>
          <Tabs defaultValue={recentFoods.length > 0 ? "recent" : "favorites"} className="mt-3">
            <TabsList className="w-full">
              <TabsTrigger value="recent">Recenti</TabsTrigger>
              <TabsTrigger value="favorites">Preferiti</TabsTrigger>
              <TabsTrigger value="recipes">Ricette</TabsTrigger>
            </TabsList>
            <TabsContent value="recent">
              <ItemList
                items={recentFoods}
                onSelect={setSelectedItem}
                emptyMessage="Qui troverai gli alimenti che usi di più."
              />
            </TabsContent>
            <TabsContent value="favorites">
              <ItemList
                items={favoriteFoods}
                onSelect={setSelectedItem}
                emptyMessage="Tocca la stella su un alimento per averlo sempre a portata di mano."
              />
            </TabsContent>
            <TabsContent value="recipes">
              <ItemList
                items={recipes}
                onSelect={setSelectedItem}
                emptyMessage="Le ricette che crei compaiono qui."
              />
            </TabsContent>
          </Tabs>
        </>
      )}

      {loggedCount > 0 ? (
        <div className="fixed inset-x-0 bottom-0 z-20 border-t bg-background/95 pb-safe backdrop-blur-md">
          <div className="mx-auto flex max-w-md items-center justify-between gap-3 px-4 py-3">
            <span className="text-sm text-muted-foreground">
              {loggedCount === 1 ? "1 voce aggiunta" : `${loggedCount} voci aggiunte`}
            </span>
            <Button size="lg" onClick={() => router.push(backHref)}>
              Fatto
            </Button>
          </div>
        </div>
      ) : null}

      {selectedItem ? (
        <LogItemDrawer
          key={`${selectedItem.type}-${selectedItem.id}`}
          item={selectedItem}
          day={day}
          meal={meal}
          onLogged={handleLogged}
          onOpenChange={(open) => {
            if (!open) setSelectedItem(null);
          }}
        />
      ) : null}
      {quickKcalOpen ? (
        <QuickKcalDrawer
          day={day}
          meal={meal}
          onLogged={handleLogged}
          onOpenChange={(open) => setQuickKcalOpen(open)}
        />
      ) : null}
    </div>
  );
}

function SearchResultsList({
  query,
  isLoading,
  failed,
  results,
  createHref,
  onSelect,
}: {
  query: string;
  isLoading: boolean;
  failed: boolean;
  results: SearchResults | null;
  createHref: string;
  onSelect: (item: LoggableItem) => void;
}) {
  if (failed) {
    return <p className="py-6 text-center text-sm text-muted-foreground">La ricerca non ha risposto. Riprova tra poco.</p>;
  }
  if (!results) {
    return (
      <div className="flex justify-center py-8">
        <Spinner />
      </div>
    );
  }

  const items: LoggableItem[] = [...results.recipes, ...results.foods];
  return (
    <div className={cn("transition-opacity", isLoading && "opacity-60")}>
      {items.length === 0 ? (
        <p className="pt-6 pb-2 text-center text-sm text-muted-foreground">Nessun alimento trovato per «{query}».</p>
      ) : (
        <ItemList items={items} onSelect={onSelect} emptyMessage="" />
      )}
      <Link
        href={createHref}
        className="mt-2 flex items-center gap-3 rounded-lg px-2 py-3 text-sm font-medium transition-colors hover:bg-muted/60"
      >
        <span className="flex size-8 items-center justify-center rounded-full bg-secondary">
          <PlusIcon className="size-4" />
        </span>
        Crea «{query}»
      </Link>
    </div>
  );
}

function ItemList({
  items,
  onSelect,
  emptyMessage,
}: {
  items: LoggableItem[];
  onSelect: (item: LoggableItem) => void;
  emptyMessage: string;
}) {
  if (items.length === 0) {
    return emptyMessage ? <p className="py-6 text-center text-sm text-muted-foreground">{emptyMessage}</p> : null;
  }
  return (
    <ul className="divide-y">
      {items.map((item) => (
        <li key={`${item.type}-${item.id}`}>
          <button
            type="button"
            onClick={() => onSelect(item)}
            className="flex w-full items-center gap-3 px-1 py-2.5 text-left transition-colors outline-none hover:bg-muted/50 focus-visible:bg-muted/60"
          >
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-1.5">
                {item.type === "recipe" ? (
                  <ChefHatIcon className="size-4 shrink-0 text-muted-foreground" aria-label="Ricetta" />
                ) : null}
                <span className="truncate">{item.name}</span>
                {item.isFavorite ? (
                  <StarIcon className="size-3.5 shrink-0 fill-carbs text-carbs" aria-label="Preferito" />
                ) : null}
              </span>
              <span className="block truncate text-sm text-muted-foreground">
                {item.type === "recipe"
                  ? `${formatKcal(item.perServing.kcal)} kcal a porzione`
                  : [item.brand, `${formatKcal(item.per100.kcal)} kcal per 100 ${item.unit}`].filter(Boolean).join(", ")}
              </span>
            </span>
            <PlusIcon className="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
          </button>
        </li>
      ))}
    </ul>
  );
}
