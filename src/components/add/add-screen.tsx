"use client";

import {
  ArrowLeftIcon,
  CalendarDaysIcon,
  ChefHatIcon,
  FlameIcon,
  PlusIcon,
  ScanBarcodeIcon,
  SearchIcon,
  SparklesIcon,
  StarIcon,
  XIcon,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { lookupBarcode } from "@/app/actions/open-food-facts";
import { ScreenBody, ScreenFooter } from "@/components/app-shell/screen";
import { MealPicker } from "@/components/diary/meal-picker";
import { Button, buttonVariants } from "@/components/ui/button";
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from "@/components/ui/input-group";
import { Spinner } from "@/components/ui/spinner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatDecimal, formatGrams, formatKcal } from "@/lib/nutrition/format";
import { mealTypes, type MealType } from "@/lib/nutrition/meals";
import { cn } from "@/lib/utils";
import type { LoggableFood, LoggableItem, LoggableRecipe } from "@/server/loggable";
import { LogItemDrawer } from "./log-item-drawer";
import { useLogEntry } from "./use-log-entry";
import { BarcodeScanner } from "./barcode-scanner";
import { OpenFoodFactsResults } from "./open-food-facts-results";
import { DescribeMealDrawer } from "./describe-meal-drawer";
import { QuickKcalDrawer } from "./quick-kcal-drawer";
import { LogSavedMealDrawer } from "@/components/saved-meals/log-saved-meal-drawer";
import type { SavedMealView } from "@/server/saved-meals";
import { type SearchResults, useFoodSearch } from "@/components/food/use-food-search";

type AddScreenProperties = {
  day: string;
  dayLabel: string | null;
  initialMeal: MealType;
  suggestions: Record<MealType, LoggableItem[]>;
  favoriteFoods: LoggableFood[];
  recipes: LoggableRecipe[];
  savedMeals: SavedMealView[];
  initialItem: LoggableItem | null;
  backHref: string;
  aiEnabled: boolean;
};

export function AddScreen(properties: AddScreenProperties) {
  const { bfcacheId } = useRouter();
  const initialKey = properties.initialItem ? `${properties.initialItem.type}-${properties.initialItem.id}` : "none";
  return <AddScreenContent key={`${bfcacheId}-${initialKey}`} {...properties} />;
}

function AddScreenContent({
  day,
  dayLabel,
  initialMeal,
  suggestions,
  favoriteFoods,
  recipes,
  savedMeals,
  initialItem,
  backHref,
  aiEnabled,
}: AddScreenProperties) {
  const router = useRouter();
  const [meal, setMeal] = useState<MealType>(initialMeal);
  const [query, setQuery] = useState("");
  const searchInputReference = useRef<HTMLInputElement>(null);
  const [selectedItem, setSelectedItem] = useState<LoggableItem | null>(initialItem);
  const [quickKcalOpen, setQuickKcalOpen] = useState(false);
  const [describeMealOpen, setDescribeMealOpen] = useState(false);
  const [selectedSavedMeal, setSelectedSavedMeal] = useState<SavedMealView | null>(null);
  const [loggedCount, setLoggedCount] = useState(0);
  const [tab, setTab] = useState(() =>
    mealTypes.some((mealType) => suggestions[mealType].length > 0) ? "suggested" : "favorites",
  );
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
    if (searchInputReference.current?.value) {
      setQuery("");
      searchInputReference.current.focus();
    }
    setSelectedItem(null);
    setQuickKcalOpen(false);
    setDescribeMealOpen(false);
    setSelectedSavedMeal(null);
    setLoggedCount((current) => current + count);
  }

  function handleUndone() {
    setLoggedCount((current) => Math.max(0, current - 1));
  }

  const quickLog = useLogEntry(() => handleLogged(), handleUndone);

  function quickAdd(item: LoggableItem) {
    if (item.type === "food") {
      if (!item.lastGrams) return;
      quickLog.log({ day, meal, item: { type: "food", foodId: item.id, grams: item.lastGrams, portionLabel: null } }, item.name);
      return;
    }
    if (!item.lastServings && !item.lastGrams) return;
    quickLog.log(
      { day, meal, item: { type: "recipe", recipeId: item.id, grams: item.lastGrams, servings: item.lastServings } },
      item.name,
    );
  }

  return (
    <>
      <header className="-ml-2 flex h-14 shrink-0 items-center gap-1">
        <Link href={backHref} aria-label="Torna al diario" className={buttonVariants({ variant: "ghost", size: "icon" })}>
          <ArrowLeftIcon />
        </Link>
        <MealPicker value={meal} onValueChange={setMeal} className="flex-1" />
      </header>
      {dayLabel ? (
        <p className="-mt-1 mb-2 flex shrink-0 items-center gap-1.5 text-sm text-muted-foreground">
          <CalendarDaysIcon className="size-4" aria-hidden="true" />
          Diario di {dayLabel}
        </p>
      ) : null}

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
        <Tabs
          value={tab}
          onValueChange={(value) => setTab(String(value))}
          className="min-h-0 flex-1 gap-0"
        >
          <TabsList className="mb-2 w-full shrink-0">
            <TabsTrigger value="suggested">Suggeriti</TabsTrigger>
            <TabsTrigger value="favorites">Preferiti</TabsTrigger>
            <TabsTrigger value="recipes">Ricette</TabsTrigger>
            <TabsTrigger value="meals">Pasti</TabsTrigger>
          </TabsList>
          <ScreenBody>
            <div className={cn("grid gap-2 py-1", aiEnabled ? "grid-cols-3" : "grid-cols-2")}>
              <Button variant="outline" size="lg" className="px-2" onClick={() => setQuickKcalOpen(true)}>
                <FlameIcon />
                Kcal veloci
              </Button>
              <Link href={createHref} className={buttonVariants({ variant: "outline", size: "lg", className: "px-2" })}>
                <PlusIcon />
                {aiEnabled ? "Nuovo" : "Nuovo alimento"}
              </Link>
              {aiEnabled ? (
                <Button variant="outline" size="lg" className="px-2" onClick={() => setDescribeMealOpen(true)}>
                  <SparklesIcon />
                  Descrivi
                </Button>
              ) : null}
            </div>
            <TabsContent value="suggested">
              <ItemList
                items={suggestions[meal]}
                onSelect={setSelectedItem}
                onQuickAdd={quickAdd}
                emptyMessage="Qui troverai quello che registri più spesso in questo pasto."
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
            ref={searchInputReference}
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
              <InputGroupButton
                size="icon-sm"
                className="touch-target"
                aria-label="Cancella ricerca"
                onClick={() => {
                  setQuery("");
                  searchInputReference.current?.focus();
                }}
              >
                <XIcon />
              </InputGroupButton>
            ) : (
              <InputGroupButton
                size="icon-sm"
                className="touch-target"
                aria-label="Scansiona codice a barre"
                onClick={() => setScannerOpen(true)}
              >
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
      {describeMealOpen ? (
        <DescribeMealDrawer day={day} meal={meal} onLogged={handleLogged} onOpenChange={setDescribeMealOpen} />
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
  onQuickAdd: (item: LoggableItem) => void;
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
  onQuickAdd: (item: LoggableItem) => void;
  emptyMessage: string;
}) {
  if (items.length === 0) {
    return emptyMessage ? <p className="py-6 text-center text-sm text-muted-foreground">{emptyMessage}</p> : null;
  }
  return (
    <ul className="divide-y">
      {items.map((item) => {
        const lastQuantity = describeLastQuantity(item);
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
                  {lastQuantity
                    ? `Ultima volta ${lastQuantity.label}, ${formatKcal(lastQuantity.kcal)} kcal`
                    : item.type === "recipe"
                      ? `${formatKcal(item.perServing.kcal)} kcal a porzione`
                      : [item.brand, `${formatKcal(item.per100.kcal)} kcal per 100 ${item.unit}`].filter(Boolean).join(", ")}
                </span>
              </span>
            </button>
            {lastQuantity ? (
              <Button
                variant="secondary"
                size="icon"
                className="touch-target"
                aria-label={`Aggiungi ${lastQuantity.label} di ${item.name}`}
                onClick={() => onQuickAdd(item)}
              >
                <PlusIcon />
              </Button>
            ) : (
              <Button
                variant="ghost"
                size="icon"
                className="touch-target"
                aria-label={`Scegli quanto di ${item.name}`}
                onClick={() => onSelect(item)}
              >
                <PlusIcon className="text-muted-foreground" />
              </Button>
            )}
          </li>
        );
      })}
    </ul>
  );
}

function describeLastQuantity(item: LoggableItem) {
  if (item.type === "food") {
    if (!item.lastGrams) return null;
    return { label: `${formatGrams(item.lastGrams)} ${item.unit}`, kcal: (item.per100.kcal * item.lastGrams) / 100 };
  }
  if (item.lastServings) {
    return {
      label: `${formatDecimal(item.lastServings)} ${item.lastServings === 1 ? "porzione" : "porzioni"}`,
      kcal: item.perServing.kcal * item.lastServings,
    };
  }
  if (item.lastGrams) {
    return { label: `${formatGrams(item.lastGrams)} g`, kcal: (item.per100.kcal * item.lastGrams) / 100 };
  }
  return null;
}
