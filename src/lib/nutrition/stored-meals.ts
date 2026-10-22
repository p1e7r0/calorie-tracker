import { daysBetween } from "./days";

export const storageLocations = ["fridge", "freezer"] as const;

export type StorageLocation = (typeof storageLocations)[number];

export const storageLocationLabels: Record<StorageLocation, string> = {
  fridge: "Frigo",
  freezer: "Congelatore",
};

export const storageLimitDays: Record<StorageLocation, number> = {
  fridge: 3,
  freezer: 90,
};

export const maximumStoredPortions = 20;

export function isStorageLocation(value: unknown): value is StorageLocation {
  return typeof value === "string" && (storageLocations as readonly string[]).includes(value);
}

export function storedMealAgeDays(preparedOn: string, today: string) {
  return Math.max(0, daysBetween(preparedOn, today));
}

export function isStoredMealOld(location: StorageLocation, preparedOn: string, today: string) {
  return storedMealAgeDays(preparedOn, today) > storageLimitDays[location];
}

export function describeStoredMealAge(preparedOn: string, today: string) {
  const days = storedMealAgeDays(preparedOn, today);
  if (days === 0) return "preparato oggi";
  if (days === 1) return "preparato ieri";
  if (days < 60) return `preparato ${days} giorni fa`;
  return `preparato ${Math.floor(days / 30)} mesi fa`;
}

export function describePortions(portions: number) {
  return portions === 1 ? "1 porzione" : `${portions} porzioni`;
}

export function sortStoredMeals<Meal extends { location: StorageLocation; preparedOn: string; name: string }>(
  meals: readonly Meal[],
  today: string,
) {
  return [...meals].sort((first, second) => {
    const firstOld = isStoredMealOld(first.location, first.preparedOn, today);
    const secondOld = isStoredMealOld(second.location, second.preparedOn, today);
    if (firstOld !== secondOld) return firstOld ? -1 : 1;
    if (first.location !== second.location) return first.location === "fridge" ? -1 : 1;
    if (first.preparedOn !== second.preparedOn) return first.preparedOn < second.preparedOn ? -1 : 1;
    return first.name.localeCompare(second.name, "it");
  });
}
