"use client";

import { MinusIcon, PlusIcon, RefrigeratorIcon, SnowflakeIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  maximumPreparedPortions,
  type StorageLocation,
  storageLocationLabels,
  storageLocations,
} from "@/lib/nutrition/prepared-meals";

export function StorageLocationIcon({ location, className }: { location: StorageLocation; className?: string }) {
  return location === "fridge" ? (
    <RefrigeratorIcon className={className} aria-hidden="true" />
  ) : (
    <SnowflakeIcon className={className} aria-hidden="true" />
  );
}

export function StorageLocationPicker({
  value,
  onValueChange,
  labelledBy,
}: {
  value: StorageLocation;
  onValueChange: (location: StorageLocation) => void;
  labelledBy: string;
}) {
  return (
    <ToggleGroup
      variant="outline"
      spacing={0}
      value={[value]}
      onValueChange={(values) => {
        const [selected] = values;
        if (selected) onValueChange(selected as StorageLocation);
      }}
      aria-labelledby={labelledBy}
      className="w-full"
    >
      {storageLocations.map((location) => (
        <ToggleGroupItem key={location} value={location} className="h-10 flex-1">
          <StorageLocationIcon location={location} />
          {storageLocationLabels[location]}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}

export function PortionsStepper({
  value,
  onValueChange,
  labelledBy,
}: {
  value: number;
  onValueChange: (portions: number) => void;
  labelledBy: string;
}) {
  return (
    <div className="flex h-10 items-center justify-between rounded-lg border" role="group" aria-labelledby={labelledBy}>
      <Button
        variant="ghost"
        size="icon"
        aria-label="Una porzione in meno"
        disabled={value <= 1}
        onClick={() => onValueChange(Math.max(1, value - 1))}
      >
        <MinusIcon />
      </Button>
      <span className="font-medium tabular-nums" aria-live="polite">
        {value}
      </span>
      <Button
        variant="ghost"
        size="icon"
        aria-label="Una porzione in più"
        disabled={value >= maximumPreparedPortions}
        onClick={() => onValueChange(Math.min(maximumPreparedPortions, value + 1))}
      >
        <PlusIcon />
      </Button>
    </div>
  );
}
