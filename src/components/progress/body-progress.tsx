"use client";

import { PlusIcon } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { type BodyMetricKey, bodyMetrics } from "@/lib/nutrition/body-metrics";
import { addDays, daysBetween, formatElapsed, formatShortDay } from "@/lib/nutrition/days";
import { formatDecimal } from "@/lib/nutrition/format";
import type { GoalType } from "@/lib/nutrition/goals";
import { describeTargetWeightProjection, projectTargetWeight } from "@/lib/nutrition/target-weight";
import { changeOverDays, lastValuePerDay, movingAverage } from "@/lib/nutrition/trends";
import { cn } from "@/lib/utils";
import type { MeasurementView } from "@/server/measurements";
import { BodyMetricChart } from "./body-metric-chart";
import { MeasurementDrawer } from "./measurement-drawer";

const ranges = [
  { value: "30", label: "30 g", days: 30 },
  { value: "90", label: "90 g", days: 90 },
  { value: "365", label: "1 anno", days: 365 },
  { value: "all", label: "Tutto", days: null },
] as const;

export type TargetWeightSettings = { targetKg: number; goal: GoalType; plannedWeeklyRateKg: number };

export function BodyProgress({
  measurements,
  today,
  targetWeight,
}: {
  measurements: MeasurementView[];
  today: string;
  targetWeight: TargetWeightSettings | null;
}) {
  const [metricKey, setMetricKey] = useState<BodyMetricKey>("weightKg");
  const [rangeValue, setRangeValue] = useState<(typeof ranges)[number]["value"]>("90");
  const [editing, setEditing] = useState<MeasurementView | "new" | null>(null);
  const [showAllHistory, setShowAllHistory] = useState(false);
  const history = [...measurements].reverse();
  const visibleHistory = showAllHistory ? history : history.slice(0, 10);
  const metric = bodyMetrics.find((candidate) => candidate.key === metricKey)!;
  const range = ranges.find((candidate) => candidate.value === rangeValue)!;

  const availableMetrics = bodyMetrics.filter((candidate) =>
    measurements.some((measurement) => measurement[candidate.key] !== null),
  );
  const series = lastValuePerDay(
    measurements
      .filter((measurement) => measurement[metricKey] !== null)
      .map((measurement) => ({ day: measurement.measuredOn, value: measurement[metricKey] as number })),
  );
  const averages = movingAverage(series);
  const fromDay = range.days ? addDays(today, -(range.days - 1)) : "0000-01-01";
  const points = series
    .map((point, index) => ({
      day: point.day,
      time: new Date(`${point.day}T12:00:00Z`).getTime(),
      value: point.value,
      average: averages[index].value,
    }))
    .filter((point) => point.day >= fromDay);
  const latest = series.at(-1);
  const change = changeOverDays(series, 30);
  const unitSuffix = metric.unit ? ` ${metric.unit}` : "";
  const showsTargetWeight = metricKey === "weightKg" && targetWeight !== null && targetWeight.goal !== "maintain";
  const targetProjection = showsTargetWeight
    ? projectTargetWeight({
        ...targetWeight,
        weights: measurements.map((measurement) => ({ day: measurement.measuredOn, value: measurement.weightKg })),
        today,
      })
    : null;

  return (
    <div className="flex flex-col gap-4">
      {availableMetrics.length > 1 ? (
        <div className="-mx-4 flex gap-1.5 overflow-x-auto px-4 [scrollbar-width:none]" role="tablist" aria-label="Misura">
          {availableMetrics.map((candidate) => (
            <button
              key={candidate.key}
              type="button"
              role="tab"
              aria-selected={candidate.key === metricKey}
              onClick={() => setMetricKey(candidate.key)}
              className={cn(
                "shrink-0 rounded-full border px-3 py-1.5 text-sm transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                candidate.key === metricKey ? "border-foreground bg-foreground text-background" : "bg-card",
              )}
            >
              {candidate.shortLabel}
            </button>
          ))}
        </div>
      ) : null}

      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground">{metric.label}</p>
          <p className="font-heading text-4xl font-semibold tracking-tight">
            {latest ? formatDecimal(latest.value) : "–"}
            <span className="ml-1 text-base font-medium text-muted-foreground">{metric.unit}</span>
          </p>
          <p className="text-sm text-muted-foreground">
            {change
              ? `${change.change > 0 ? "+" : change.change < 0 ? "−" : ""}${formatDecimal(Math.abs(change.change))}${unitSuffix} ${formatElapsed(daysBetween(change.fromDay, latest!.day))}, dal ${formatShortDay(change.fromDay)}`
              : latest
                ? `Ultima misurazione ${formatShortDay(latest.day)}`
                : "Nessuna misurazione"}
          </p>
        </div>
        <Button onClick={() => setEditing("new")}>
          <PlusIcon />
          Misura
        </Button>
      </div>

      {targetProjection ? (
        <section aria-label="Peso obiettivo" className="rounded-xl bg-muted/60 px-3 py-2.5 text-sm text-pretty">
          <p>{describeTargetWeightProjection(targetProjection, today)}</p>
        </section>
      ) : null}

      {points.length >= 2 ? (
        <>
          <BodyMetricChart
            points={points}
            unit={metric.unit}
            reference={showsTargetWeight ? { value: targetWeight.targetKg, label: "Obiettivo" } : null}
          />
          <ToggleGroup
            variant="outline"
            spacing={0}
            size="sm"
            value={[rangeValue]}
            onValueChange={(selected) => {
              const [value] = selected;
              if (value) setRangeValue(value as typeof rangeValue);
            }}
            aria-label="Periodo"
            className="w-full"
          >
            {ranges.map((candidate) => (
              <ToggleGroupItem key={candidate.value} value={candidate.value} className="flex-1">
                {candidate.label}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </>
      ) : (
        <p className="rounded-xl bg-muted/60 px-3 py-4 text-center text-sm text-muted-foreground">
          {series.length === 0
            ? "Aggiungi la prima misurazione per iniziare a vedere l'andamento."
            : "Con almeno due misurazioni nel periodo vedrai il grafico."}
        </p>
      )}

      <section aria-labelledby="measurement-history">
        <h2 id="measurement-history" className="font-heading text-lg font-semibold tracking-tight">
          Storico
        </h2>
        <ul className="mt-1 divide-y">
          {visibleHistory.map((measurement) => (
            <li key={measurement.id}>
              <button
                type="button"
                onClick={() => setEditing(measurement)}
                className="flex w-full items-center justify-between gap-3 py-2.5 text-left outline-none hover:bg-muted/50 focus-visible:bg-muted/60"
              >
                <span>
                  <span className="block">{formatShortDay(measurement.measuredOn)}</span>
                  <span className="block text-sm text-muted-foreground">
                    {bodyMetrics
                      .slice(1)
                      .filter((candidate) => measurement[candidate.key] !== null)
                      .map(
                        (candidate) =>
                          `${candidate.shortLabel} ${formatDecimal(measurement[candidate.key] as number)}${candidate.unit ? ` ${candidate.unit}` : ""}`,
                      )
                      .join(", ") || "Solo peso"}
                  </span>
                </span>
                <span className="shrink-0 font-medium">{formatDecimal(measurement.weightKg)} kg</span>
              </button>
            </li>
          ))}
        </ul>
        {history.length > visibleHistory.length ? (
          <Button variant="ghost" className="mt-1 w-full" onClick={() => setShowAllHistory(true)}>
            Mostra tutte le {history.length} misurazioni
          </Button>
        ) : null}
      </section>

      {editing ? (
        <MeasurementDrawer
          key={editing === "new" ? "new" : editing.id}
          measurement={editing === "new" ? null : editing}
          previous={
            editing === "new"
              ? (measurements.at(-1) ?? null)
              : (measurements.filter((candidate) => candidate.measuredOn < editing.measuredOn).at(-1) ?? null)
          }
          today={today}
          onOpenChange={(open) => {
            if (!open) setEditing(null);
          }}
        />
      ) : null}
    </div>
  );
}
