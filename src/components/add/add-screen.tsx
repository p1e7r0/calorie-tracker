"use client";

import {
  ArrowLeftIcon,
  ChefHatIcon,
  FlameIcon,
  PlusIcon,
  ScanBarcodeIcon,
  SearchIcon,
  StarIcon,
  XIcon,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { lookupBarcode } from "@/app/actions/open-food-facts";
import { ScreenBody, ScreenFooter } from "@/components/app-shell/screen";
import { MealPicker } from "@/components/diary/meal-picker";
import { Button, buttonVariants } from "@/components/ui/button";
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from "@/components/ui/input-group";
import { Spinner } from "@/components/ui/spinner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatGrams, formatKcal } from "@/lib/nutrition/format";
import type { MealType } from "@/lib/nutrition/meals";
import { cn } from "@/lib/utils";
import type { LoggableFood, LoggableItem, LoggableRecipe } from "@/server/loggable";
import { LogItemDrawer } from "./log-item-drawer";
import { useLogEntry } from "./use-log-entry";
import { BarcodeScanner } from "./barcode-scanner";
import { OpenFoodFactsResults } from "./open-food-facts-results";
import { QuickKcalDrawer } from "./quick-kcal-drawer";
import { LogSavedMealDrawer } from "@/components/saved-meals/log-saved-meal-drawer";
import type { SavedMealView } from "@/server/saved-meals";
import { type SearchResults, useFoodSearch } from "@/components/food/use-food-search";

type AddScreenProperties = {
  day: string;
  initialMeal: MealType;
  recentFoods: LoggableFood[];
  favoriteFoods: LoggableFood[];
  recipes: LoggableRecipe[];
  savedMeals: SavedMealView[];
  initialItem: LoggableItem | null;
  backHref: string;
};

export function AddScreen(properties: AddScreenProperties) {
  const { bfcacheId } = useRouter();
  const initialKey = properties.initialItem ? `${properties.initialItem.type}-${properties.initialItem.id}` : "none";
  return <AddScreenContent key={`${bfcacheId}-${initialKey}`} {...properties} />;
}

function AddScreenContent({
  day,
  initialMeal,
  recentFoods,
  favoriteFoods,
  recipes,
  savedMeals,
  initialItem,
  backHref,
}: AddScreenProperties) {
  const router = useRouter();
  const [meal, setMeal] = useState<MealType>(initialMeal);
  const [query, setQuery] = useState("");
  const [selectedItem, setSelectedItem] = useState<LoggableItem | null>(initialItem);
  const [quickKcalOpen, setQuickKcalOpen] = useState(false);
  const [selectedSavedMeal, setSelectedSavedMeal] = useState<SavedMealView | null>(null);
  const [loggedCount, setLoggedCount] = useState(0);
  const search = useFoodSearch(query);
  const trimmedQuery = query.trim();
  const addHref = `/add?date=${day}&meal=${meal}`;
  const createHref = `/food/new?name=${encodeURIComponent(trimmedQuery)}&next=${encodeURIComponent(addHref)}`;
  const [scannerOpen, setScannerOpen] = useState(false);
  const [isLookingUp, startLookup] = useTransition();

  function handleBarcode(barcode: string) {
    startLookup(async () => {
      const result = await lookupBarcode(barcode);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setScannerOpen(false);
      if (result.data.item) {
        setSelectedItem(result.data.item);
      } else {
        toast("Prodotto non trovato. Inserisci i valori dall'etichetta.");
        router.push(`/food/new?barcode=${result.data.barcode}&next=${encodeURIComponent(addHref)}`);
      }
    });
  }

  function handleLogged(count = 1) {
    setSelectedItem(null);
    setQuickKcalOpen(false);
    setSelectedSavedMeal(null);
    setLoggedCount((current) => current + count);
  }

  function handleUndone() {
    setLoggedCount((current) => Math.max(0, current - 1));
  }

  const quickLog = useLogEntry(() => handleLogged(), handleUndone);

  function quickAdd(food: LoggableFood, grams: number) {
    quickLog.log({ day, meal, item: { type: "food", foodId: food.id, grams, portionLabel: null } }, food.name);
  }

  return (
    <>
      <header className="-ml-2 flex h-14 shrink-0 items-center gap-1">
        <Link href={backHref} aria-label="Torna al diario" className={buttonVariants({ variant: "ghost", size: "icon" })}>
          <ArrowLeftIcon />
        </Link>
        <MealPicker value={meal} onValueChange={setMeal} className="flex-1" />
      </header>

      {search.isActive ? (
        <ScreenBody>
          <SearchResultsList
            query={trimmedQuery}
            isLoading={search.isLoading}
            failed={search.failed}
            results={search.results}
            createHref={createHref}
            onSelect={setSelectedItem}
            onQuickAdd={quickAdd}
            onOpenFood={setSelectedItem}
          />
        </ScreenBody>
      ) : (
        <Tabs defaultValue={recentFoods.length > 0 ? "recent" : "favorites"} className="min-h-0 flex-1 gap-0">
          <TabsList className="mb-2 w-full shrink-0">
            <TabsTrigger value="recent">Recenti</TabsTrigger>
            <TabsTrigger value="favorites">Preferiti</TabsTrigger>
            <TabsTrigger value="recipes">Ricette</TabsTrigger>
            <TabsTrigger value="meals">Pasti</TabsTrigger>
          </TabsList>
          <ScreenBody>
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
            <TabsContent value="recent">
              <ItemList
                items={recentFoods}
                onSelect={setSelectedItem}
                onQuickAdd={quickAdd}
                emptyMessage="Qui troverai gli alimenti che usi di più."
              />
            </TabsContent>
            <TabsContent value="favorites">
              <ItemList
                items={favoriteFoods}
                onSelect={setSelectedItem}
                onQuickAdd={quickAdd}
                emptyMessage="Tocca la stella su un alimento per averlo sempre a portata di mano."
              />
            </TabsContent>
            <TabsContent value="recipes">
              <ItemList
                items={recipes}
                onSelect={setSelectedItem}
                onQuickAdd={quickAdd}
                emptyMessage="Le ricette che crei compaiono qui."
              />
            </TabsContent>
            <TabsContent value="meals">
              {savedMeals.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  Nel diario, apri il menu ⋯ di un pasto e scegli «Salva come pasto».
                </p>
              ) : (
                <ul className="divide-y">
                  {savedMeals.map((savedMeal) => (
                    <li key={savedMeal.id}>
                      <button
                        type="button"
                        onClick={() => setSelectedSavedMeal(savedMeal)}
                        className="flex w-full items-center gap-3 px-1 py-2.5 text-left outline-none hover:bg-muted/50 focus-visible:bg-muted/60"
                      >
                        <span className="min-w-0 flex-1">
                          <span className="block truncate">{savedMeal.name}</span>
                          <span className="block truncate text-sm text-muted-foreground">
                            {savedMeal.items.map((item) => item.name).join(", ")}
                          </span>
                        </span>
                        <span className="shrink-0 text-sm tabular-nums">{formatKcal(savedMeal.totals.kcal)} kcal</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </TabsContent>
          </ScreenBody>
        </Tabs>
      )}

      <ScreenFooter className="flex flex-col gap-2">
        {loggedCount > 0 ? (
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm text-muted-foreground">
              {loggedCount === 1 ? "1 voce aggiunta" : `${loggedCount} voci aggiunte`}
            </span>
            <Button onClick={() => router.push(backHref)}>Fatto</Button>
          </div>
        ) : null}
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
          <InputGroupAddon align="inline-end">
            {query ? (
              <InputGroupButton size="icon-xs" aria-label="Cancella ricerca" onClick={() => setQuery("")}>
                <XIcon />
              </InputGroupButton>
            ) : (
              <InputGroupButton size="icon-sm" aria-label="Scansiona codice a barre" onClick={() => setScannerOpen(true)}>
                <ScanBarcodeIcon />
              </InputGroupButton>
            )}
          </InputGroupAddon>
        </InputGroup>
      </ScreenFooter>

      {selectedItem ? (
        <LogItemDrawer
          key={`${selectedItem.type}-${selectedItem.id}`}
          item={selectedItem}
          day={day}
          meal={meal}
          onLogged={() => handleLogged()}
          onUndone={handleUndone}
          onOpenChange={(open) => {
            if (!open) setSelectedItem(null);
          }}
        />
      ) : null}
      {selectedSavedMeal ? (
        <LogSavedMealDrawer
          savedMeal={selectedSavedMeal}
          day={day}
          meal={meal}
          onLogged={handleLogged}
          onOpenChange={(open) => {
            if (!open) setSelectedSavedMeal(null);
          }}
        />
      ) : null}
      {scannerOpen ? (
        <BarcodeScanner isLookingUp={isLookingUp} onDetected={handleBarcode} onClose={() => setScannerOpen(false)} />
      ) : null}
      {quickKcalOpen ? (
        <QuickKcalDrawer
          day={day}
          meal={meal}
          onLogged={() => handleLogged()}
          onOpenChange={(open) => setQuickKcalOpen(open)}
        />
      ) : null}
    </>
  );
}

function SearchResultsList({
  query,
  isLoading,
  failed,
  results,
  createHref,
  onSelect,
  onQuickAdd,
  onOpenFood,
}: {
  query: string;
  isLoading: boolean;
  failed: boolean;
  results: SearchResults | null;
  createHref: string;
  onSelect: (item: LoggableItem) => void;
  onQuickAdd: (food: LoggableFood, grams: number) => void;
  onOpenFood: (item: LoggableItem) => void;
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
        <ItemList items={items} onSelect={onSelect} onQuickAdd={onQuickAdd} emptyMessage="" />
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
      <OpenFoodFactsResults
        key={query}
        query={query}
        automatic={!isLoading && query.length >= 3 && items.length < 3}
        onOpenFood={onOpenFood}
      />
    </div>
  );
}

function ItemList({
  items,
  onSelect,
  onQuickAdd,
  emptyMessage,
}: {
  items: LoggableItem[];
  onSelect: (item: LoggableItem) => void;
  onQuickAdd: (food: LoggableFood, grams: number) => void;
  emptyMessage: string;
}) {
  if (items.length === 0) {
    return emptyMessage ? <p className="py-6 text-center text-sm text-muted-foreground">{emptyMessage}</p> : null;
  }
  return (
    <ul className="divide-y">
      {items.map((item) => {
        const lastGrams = item.type === "food" ? item.lastGrams : null;
        return (
          <li key={`${item.type}-${item.id}`} className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => onSelect(item)}
              className="flex min-w-0 flex-1 items-center gap-3 px-1 py-2.5 text-left transition-colors outline-none hover:bg-muted/50 focus-visible:bg-muted/60"
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
                    : lastGrams
                      ? `Ultima volta ${formatGrams(lastGrams)} ${item.unit}, ${formatKcal((item.per100.kcal * lastGrams) / 100)} kcal`
                      : [item.brand, `${formatKcal(item.per100.kcal)} kcal per 100 ${item.unit}`].filter(Boolean).join(", ")}
                </span>
              </span>
            </button>
            {item.type === "food" && lastGrams ? (
              <Button
                variant="secondary"
                size="icon"
                aria-label={`Aggiungi ${formatGrams(lastGrams)} ${item.unit} di ${item.name}`}
                onClick={() => onQuickAdd(item, lastGrams)}
              >
                <PlusIcon />
              </Button>
            ) : (
              <Button variant="ghost" size="icon" aria-label={`Scegli quanto di ${item.name}`} onClick={() => onSelect(item)}>
                <PlusIcon className="text-muted-foreground" />
              </Button>
            )}
          </li>
        );
      })}
    </ul>
  );
}
