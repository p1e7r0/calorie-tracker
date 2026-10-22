import { daysBetween } from "./days";

export const storageLocations = ["fridge", "freezer"] as const;

export type StorageLocation = (typeof storageLocations)[number];

export const storageLocationLabels: Record<StorageLocation, string> = {
  fridge: "Frigo",
  freezer: "Congelatore",
};

export const maximumPreparedPortions = 50;

export const storageDayLimits: Record<StorageLocation, number> = {
  fridge: 3,
  freezer: 90,
};

export function isStorageLocation(value: unknown): value is StorageLocation {
  return typeof value === "string" && (storageLocations as readonly string[]).includes(value);
}

function describeElapsed(days: number) {
  if (days <= 0) return "da oggi";
  if (days === 1) return "da ieri";
  if (days < 14) return `da ${days} giorni`;
  if (days < 60) return `da ${Math.round(days / 7)} settimane`;
  return `da ${Math.round(days / 30)} mesi`;
}

export function describeStorage(location: StorageLocation, storedOn: string, today: string) {
  const days = Math.max(0, daysBetween(storedOn, today));
  return {
    days,
    label: `${location === "fridge" ? "In frigo" : "In congelatore"} ${describeElapsed(days)}`,
    isOld: days > storageDayLimits[location],
  };
}

export function describePortionsLeft(portions: number) {
  return portions === 1 ? "1 porzione" : `${portions} porzioni`;
}
