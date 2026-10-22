import { formatKcal } from "@/lib/nutrition/format";
import { describePortionsLeft, describeStorage } from "@/lib/nutrition/prepared-meals";
import { cn } from "@/lib/utils";
import type { PreparedMealView } from "@/server/prepared-meals";
import { StorageLocationIcon } from "./storage-controls";

export function PreparedMealSummary({ preparedMeal, today }: { preparedMeal: PreparedMealView; today: string }) {
  const storage = describeStorage(preparedMeal.location, preparedMeal.storedOn, today);
  return (
    <>
      <StorageLocationIcon location={preparedMeal.location} className="size-4 shrink-0 text-muted-foreground" />
      <span className="min-w-0 flex-1">
        <span className="block truncate">{preparedMeal.name}</span>
        <span className="block truncate text-sm text-muted-foreground">
          {describePortionsLeft(preparedMeal.portions)},{" "}
          <span className={cn(storage.isOld && "text-over-text")}>{storage.label.toLowerCase()}</span>
        </span>
      </span>
      <span className="shrink-0 text-sm tabular-nums">{formatKcal(preparedMeal.totals.kcal)} kcal</span>
    </>
  );
}
