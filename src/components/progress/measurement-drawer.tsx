"use client";

import { ChevronDownIcon, Trash2Icon } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { deleteMeasurement, saveMeasurement } from "@/app/actions/measurements";
import { toFormNumber } from "@/components/food/food-form-values";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { type BodyMetricKey, bodyMetrics } from "@/lib/nutrition/body-metrics";
import { formatShortDay } from "@/lib/nutrition/days";
import { formatDecimal, parseDecimal } from "@/lib/nutrition/format";
import { cn } from "@/lib/utils";
import type { MeasurementView } from "@/server/measurements";

export function MeasurementDrawer({
  measurement,
  previous,
  today,
  onOpenChange,
}: {
  measurement: MeasurementView | null;
  previous: MeasurementView | null;
  today: string;
  onOpenChange: (open: boolean) => void;
}) {
  const [measuredOn, setMeasuredOn] = useState(measurement?.measuredOn ?? today);
  const [values, setValues] = useState<Record<BodyMetricKey, string>>(
    () =>
      Object.fromEntries(
        bodyMetrics.map((metric) => [metric.key, toFormNumber(measurement?.[metric.key])]),
      ) as Record<BodyMetricKey, string>,
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [primaryMetric, ...otherMetrics] = bodyMetrics;
  const [showOtherMetrics, setShowOtherMetrics] = useState(() =>
    otherMetrics.some((metric) => measurement?.[metric.key] != null),
  );

  function placeholderFor(key: BodyMetricKey) {
    const value = previous?.[key];
    return value == null ? undefined : formatDecimal(value);
  }

  function save() {
    setErrorMessage(null);
    const weightKg = parseDecimal(values.weightKg);
    if (weightKg === null) {
      setErrorMessage("Il peso è obbligatorio.");
      return;
    }
    startTransition(async () => {
      const result = await saveMeasurement({
        id: measurement?.id ?? null,
        measuredOn,
        weightKg,
        bodyFatPercent: parseDecimal(values.bodyFatPercent),
        musclePercent: parseDecimal(values.musclePercent),
        visceralFat: parseDecimal(values.visceralFat),
        bodyWaterPercent: parseDecimal(values.bodyWaterPercent),
        boneMassKg: parseDecimal(values.boneMassKg),
        waistCm: parseDecimal(values.waistCm),
        hipCm: parseDecimal(values.hipCm),
      });
      if (!result.ok) {
        setErrorMessage(result.error);
        return;
      }
      toast.success("Misurazione salvata");
      onOpenChange(false);
    });
  }

  function remove() {
    if (!measurement) return;
    startTransition(async () => {
      const result = await deleteMeasurement(measurement.id);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Misurazione eliminata");
      onOpenChange(false);
    });
  }

  return (
    <Drawer open onOpenChange={onOpenChange}>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle className="text-lg">{measurement ? "Modifica misurazione" : "Nuova misurazione"}</DrawerTitle>
          <DrawerDescription>
            {previous && !measurement
              ? `L'ultima volta (${formatShortDay(previous.measuredOn)}): ${formatDecimal(previous.weightKg)} kg.`
              : "Solo il peso è obbligatorio."}
          </DrawerDescription>
        </DrawerHeader>
        <form
          className="flex flex-col gap-3 overflow-y-auto p-4"
          onSubmit={(event) => {
            event.preventDefault();
            save();
          }}
        >
          <div className="grid grid-cols-2 gap-2">
            <Field>
              <FieldLabel htmlFor="measurement-day">Data</FieldLabel>
              <Input
                id="measurement-day"
                type="date"
                max={today}
                value={measuredOn}
                onChange={(event) => setMeasuredOn(event.target.value)}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor={`measurement-${primaryMetric.key}`}>
                {primaryMetric.label} ({primaryMetric.unit})
              </FieldLabel>
              <Input
                id={`measurement-${primaryMetric.key}`}
                inputMode="decimal"
                autoFocus
                className="font-semibold"
                placeholder={placeholderFor("weightKg")}
                value={values.weightKg}
                onChange={(event) => setValues((current) => ({ ...current, weightKg: event.target.value }))}
              />
            </Field>
          </div>
          <button
            type="button"
            aria-expanded={showOtherMetrics}
            aria-controls="measurement-other-metrics"
            onClick={() => setShowOtherMetrics((current) => !current)}
            className="flex items-center gap-1 self-start rounded-md text-sm text-muted-foreground outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            Altre misure: grasso, muscolo, viscerale, acqua, ossa, vita, fianchi
            <ChevronDownIcon className={cn("size-4 transition-transform", showOtherMetrics && "rotate-180")} />
          </button>
          <div id="measurement-other-metrics" hidden={!showOtherMetrics} className="grid grid-cols-2 gap-2">
            {otherMetrics.map((metric) => (
              <Field key={metric.key} className="gap-1.5">
                <FieldLabel htmlFor={`measurement-${metric.key}`} className="text-xs text-muted-foreground">
                  {metric.label}
                  {metric.unit ? ` (${metric.unit})` : ""}
                </FieldLabel>
                <Input
                  id={`measurement-${metric.key}`}
                  inputMode="decimal"
                  placeholder={placeholderFor(metric.key)}
                  value={values[metric.key]}
                  onChange={(event) => setValues((current) => ({ ...current, [metric.key]: event.target.value }))}
                />
              </Field>
            ))}
          </div>
          {errorMessage ? <FieldError>{errorMessage}</FieldError> : null}
          <button type="submit" hidden />
        </form>
        <DrawerFooter className="flex-row pb-[max(1rem,env(safe-area-inset-bottom))]">
          {measurement ? (
            <Button variant="destructive" size="lg" onClick={remove} disabled={isPending} aria-label="Elimina misurazione">
              <Trash2Icon />
            </Button>
          ) : null}
          <Button size="lg" className="flex-1" onClick={save} disabled={isPending}>
            Salva
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
