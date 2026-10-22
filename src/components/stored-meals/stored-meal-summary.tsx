import { RefrigeratorIcon, SnowflakeIcon, TriangleAlertIcon } from "lucide-react";
import { formatKcal } from "@/lib/nutrition/format";
import {
  describePortions,
  describeStoredMealAge,
  isStoredMealOld,
  storageLocationLabels,
} from "@/lib/nutrition/stored-meals";
import { cn } from "@/lib/utils";
import type { StoredMealView } from "@/server/stored-meals";

export function StoredMealSummary({ storedMeal, today }: { storedMeal: StoredMealView; today: string }) {
  const isOld = isStoredMealOld(storedMeal.location, storedMeal.preparedOn, today);
  const LocationIcon = storedMeal.location === "freezer" ? SnowflakeIcon : RefrigeratorIcon;
  return (
    <>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5">
          <LocationIcon
            className="size-4 shrink-0 text-muted-foreground"
            aria-label={storageLocationLabels[storedMeal.location]}
          />
          <span className="truncate">{storedMeal.name}</span>
        </span>
        <span className={cn("flex items-center gap-1 text-sm", isOld ? "text-over-text" : "text-muted-foreground")}>
          {isOld ? <TriangleAlertIcon className="size-3.5 shrink-0" aria-label="Da controllare" /> : null}
          <span className="truncate">
            {describePortions(storedMeal.portions)}, {describeStoredMealAge(storedMeal.preparedOn, today)}
          </span>
        </span>
      </span>
      <span className="shrink-0 text-right text-sm tabular-nums">
        {formatKcal(storedMeal.perPortion.kcal)} kcal
        <span className="block text-xs text-muted-foreground">a porzione</span>
      </span>
    </>
  );
}
