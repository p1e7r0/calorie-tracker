"use client";

import { MinusIcon, PlusIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  maximumStoredPortions,
  type StorageLocation,
  storageLocationLabels,
  storageLocations,
} from "@/lib/nutrition/stored-meals";

export function StorageLocationPicker({
  value,
  onValueChange,
  labelId,
}: {
  value: StorageLocation;
  onValueChange: (location: StorageLocation) => void;
  labelId: string;
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
      aria-labelledby={labelId}
      className="w-full"
    >
      {storageLocations.map((location) => (
        <ToggleGroupItem key={location} value={location} className="flex-1">
          {storageLocationLabels[location]}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}

export function PortionsStepper({
  value,
  onValueChange,
  labelId,
}: {
  value: number;
  onValueChange: (portions: number) => void;
  labelId: string;
}) {
  return (
    <div className="flex items-center gap-3" role="group" aria-labelledby={labelId}>
      <Button
        type="button"
        variant="outline"
        size="icon"
        aria-label="Una porzione in meno"
        disabled={value <= 1}
        onClick={() => onValueChange(value - 1)}
      >
        <MinusIcon />
      </Button>
      <output aria-live="polite" className="min-w-8 text-center font-heading text-xl font-semibold tabular-nums">
        {value}
      </output>
      <Button
        type="button"
        variant="outline"
        size="icon"
        aria-label="Una porzione in più"
        disabled={value >= maximumStoredPortions}
        onClick={() => onValueChange(value + 1)}
      >
        <PlusIcon />
      </Button>
    </div>
  );
}
