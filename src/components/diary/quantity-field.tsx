"use client";

import { useId } from "react";
import { MinusIcon, PlusIcon } from "lucide-react";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
  InputGroupText,
} from "@/components/ui/input-group";
import { formatDecimal, formatGrams, parseDecimal } from "@/lib/nutrition/format";
import { cn } from "@/lib/utils";

export type QuantityShortcut = { label: string; value: number; detail?: string; isPortion?: boolean };

export function QuantityField({
  label,
  unit,
  value,
  onValueChange,
  shortcuts = [],
  autoFocus = false,
  step,
}: {
  label: string;
  unit: string;
  value: string;
  onValueChange: (value: string, shortcut?: QuantityShortcut) => void;
  shortcuts?: QuantityShortcut[];
  autoFocus?: boolean;
  step?: number;
}) {
  const inputId = useId();

  function stepBy(delta: number) {
    const next = Math.max(0, (parseDecimal(value) ?? 0) + delta);
    onValueChange(formatDecimal(next).replace(/\./g, ""));
  }

  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={inputId} className="text-sm font-medium">
        {label}
      </label>
      <InputGroup className="h-12">
        {step ? (
          <InputGroupAddon>
            <InputGroupButton size="icon-sm" aria-label={`${step} ${unit} in meno`} onClick={() => stepBy(-step)}>
              <MinusIcon />
            </InputGroupButton>
          </InputGroupAddon>
        ) : null}
        <InputGroupInput
          id={inputId}
          inputMode="decimal"
          autoComplete="off"
          enterKeyHint="done"
          autoFocus={autoFocus}
          value={value}
          onChange={(event) => onValueChange(event.target.value.replace(/[^\d.,]/g, ""))}
          onFocus={(event) => event.currentTarget.select()}
          className="text-2xl font-semibold"
        />
        <InputGroupAddon align="inline-end">
          <InputGroupText className="text-base">{unit}</InputGroupText>
          {step ? (
            <InputGroupButton size="icon-sm" aria-label={`${step} ${unit} in più`} onClick={() => stepBy(step)}>
              <PlusIcon />
            </InputGroupButton>
          ) : null}
        </InputGroupAddon>
      </InputGroup>
      {shortcuts.length > 0 ? (
        <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1 [scrollbar-width:none]">
          {shortcuts.map((shortcut) => {
            const isSelected = value.replace(",", ".") === String(shortcut.value);
            return (
              <button
                key={`${shortcut.label}-${shortcut.value}`}
                type="button"
                onClick={() => onValueChange(formatDecimal(shortcut.value).replace(/\./g, ""), shortcut)}
                className={cn(
                  "flex shrink-0 items-baseline gap-1 rounded-full border px-3 py-1.5 text-sm transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                  isSelected ? "border-foreground bg-foreground text-background" : "bg-card hover:bg-muted",
                )}
              >
                {shortcut.label}
                {shortcut.detail ? (
                  <span className={cn("text-xs", isSelected ? "text-background/70" : "text-muted-foreground")}>
                    {shortcut.detail}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

export function gramsShortcut(label: string, grams: number, unit: string, isPortion = false): QuantityShortcut {
  return { label, value: grams, detail: `${formatGrams(grams)} ${unit}`, isPortion };
}
