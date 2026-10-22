"use client";

import { MinusIcon, PlusIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { maxFreezerPortions } from "@/lib/nutrition/freezer";

export function PortionStepper({
  label,
  value,
  minimum,
  onValueChange,
}: {
  label: string;
  value: number;
  minimum: number;
  onValueChange: (value: number) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-sm font-medium">{label}</span>
      <div className="flex items-center gap-2" role="group" aria-label={label}>
        <Button
          type="button"
          variant="outline"
          size="icon"
          aria-label="Una porzione in meno"
          disabled={value <= minimum}
          onClick={() => onValueChange(Math.max(minimum, value - 1))}
        >
          <MinusIcon />
        </Button>
        <span className="min-w-8 text-center font-heading text-xl font-semibold tabular-nums" aria-live="polite">
          {value}
        </span>
        <Button
          type="button"
          variant="outline"
          size="icon"
          aria-label="Una porzione in più"
          disabled={value >= maxFreezerPortions}
          onClick={() => onValueChange(Math.min(maxFreezerPortions, value + 1))}
        >
          <PlusIcon />
        </Button>
      </div>
    </div>
  );
}
