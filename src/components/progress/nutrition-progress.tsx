"use client";

import { useState } from "react";
import { Bar, BarChart, CartesianGrid, Line, LineChart, ReferenceLine, XAxis, YAxis } from "recharts";
import { ChartContainer, ChartTooltip, type ChartConfig } from "@/components/ui/chart";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { addDays, formatShortDay } from "@/lib/nutrition/days";
import { formatDecimal, formatGrams, formatKcal } from "@/lib/nutrition/format";
import { dailySeries } from "@/lib/nutrition/trends";
import { averageByWeek, weekStart } from "@/lib/nutrition/weeks";
import { cn } from "@/lib/utils";
import type { DailyTargetsView } from "@/server/diary";
import type { DailyTotals } from "@/server/statistics";

const kcalConfig = { kcal: { label: "Kcal", color: "var(--chart-energy)" } } satisfies ChartConfig;
const weightConfig = { weight: { label: "Peso", color: "var(--foreground)" } } satisfies ChartConfig;
const maintenanceConfig = {
  maintenanceKcal: { label: "Fabbisogno", color: "var(--chart-energy)" },
} satisfies ChartConfig;

const macroRows = [
  { key: "protein", target: "proteinG", label: "Proteine", colorClass: "bg-protein" },
  { key: "carbs", target: "carbsG", label: "Carboidrati", colorClass: "bg-carbs" },
  { key: "fat", target: "fatG", label: "Grassi", colorClass: "bg-fat" },
] as const;

const weekdayFormatter = new Intl.DateTimeFormat("it-IT", { weekday: "narrow", timeZone: "UTC" });

export function NutritionProgress({
  dailyTotals,
  weights,
  maintenanceHistory,
  targets,
  today,
}: {
  dailyTotals: DailyTotals[];
  weights: { day: string; value: number }[];
  maintenanceHistory: { day: string; maintenanceKcal: number | null }[];
  targets: DailyTargetsView;
  today: string;
}) {
  const [rangeDays, setRangeDays] = useState<7 | 30>(7);
  const totalsByDay = new Map(dailyTotals.map((totals) => [totals.day, totals]));
  const days = dailySeries(addDays(today, -(rangeDays - 1)), today);
  const kcalData = days.map((day) => ({ day, kcal: totalsByDay.get(day)?.kcal ?? null }));
  const completedTotals = dailyTotals.filter((totals) => totals.day !== today);
  const completedTotalsByDay = new Map(completedTotals.map((totals) => [totals.day, totals]));
  const loggedDays = days.map((day) => completedTotalsByDay.get(day)).filter((totals) => totals !== undefined);
  const averageKcal = loggedDays.length
    ? loggedDays.reduce((sum, totals) => sum + totals.kcal, 0) / loggedDays.length
    : null;

  const lastWeekDays = dailySeries(addDays(today, -7), addDays(today, -1))
    .map((day) => completedTotalsByDay.get(day))
    .filter((totals) => totals !== undefined);
  const macroAverages = macroRows.map((row) => ({
    ...row,
    average: lastWeekDays.length
      ? lastWeekDays.reduce((sum, totals) => sum + totals[row.key], 0) / lastWeekDays.length
      : 0,
  }));

  const firstWeek = weekStart(addDays(today, -7 * 11));
  const weeklyKcal = averageByWeek(
    completedTotals.filter((totals) => totals.day >= firstWeek),
    (totals) => totals.kcal,
  );
  const weeklyWeight = averageByWeek(
    weights.filter((point) => point.day >= firstWeek),
    (point) => point.value,
  );
  const weeks = dailySeries(firstWeek, weekStart(today)).filter((day) => weekStart(day) === day);
  const weeklyRows = weeks.map((week) => ({
    week,
    kcal: weeklyKcal.find((row) => row.week === week)?.average ?? null,
    weight: weeklyWeight.find((row) => row.week === week)?.average ?? null,
  }));
  const weightValues = weeklyRows.flatMap((row) => (row.weight === null ? [] : [row.weight]));
  const latestMaintenance = maintenanceHistory.findLast((point) => point.maintenanceKcal !== null) ?? null;

  return (
    <div className="flex flex-col gap-6">
      <section aria-labelledby="kcal-heading" className="flex flex-col gap-3">
        <div className="flex items-end justify-between gap-3">
          <div>
            <h2 id="kcal-heading" className="text-sm text-muted-foreground">
              Kcal al giorno
            </h2>
            <p className="font-heading text-3xl font-semibold tracking-tight">
              {averageKcal === null ? "–" : formatKcal(averageKcal)}
              <span className="ml-1 text-sm font-medium text-muted-foreground">kcal di media</span>
            </p>
            <p className="text-sm text-muted-foreground">
              {loggedDays.length} {loggedDays.length === 1 ? "giorno registrato" : "giorni registrati"} su {rangeDays - 1}, oggi
              escluso
              {targets ? `. Obiettivo ${formatKcal(targets.kcal)} (linea tratteggiata)` : ""}
            </p>
          </div>
          <ToggleGroup
            variant="outline"
            spacing={0}
            size="sm"
            value={[String(rangeDays)]}
            onValueChange={(selected) => {
              const [value] = selected;
              if (value === "7" || value === "30") setRangeDays(Number(value) as 7 | 30);
            }}
            aria-label="Periodo"
          >
            <ToggleGroupItem value="7">7 g</ToggleGroupItem>
            <ToggleGroupItem value="30">30 g</ToggleGroupItem>
          </ToggleGroup>
        </div>
        <ChartContainer config={kcalConfig} className="aspect-[16/9] w-full">
          <BarChart data={kcalData} margin={{ top: 16, right: 4, bottom: 0, left: -8 }} barCategoryGap={rangeDays === 7 ? "28%" : "12%"}>
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="day"
              tickLine={false}
              axisLine={false}
              tickMargin={6}
              minTickGap={rangeDays === 7 ? 0 : 20}
              tickFormatter={(day: string) =>
                rangeDays === 7 ? weekdayFormatter.format(new Date(`${day}T12:00:00Z`)) : formatShortDay(day)
              }
            />
            <YAxis tickLine={false} axisLine={false} width={52} tickFormatter={(value: number) => formatKcal(value)} />
            <ChartTooltip
              cursor={{ fillOpacity: 0.4 }}
              content={({ active, payload }) => {
                const row = payload?.[0]?.payload as { day: string; kcal: number | null } | undefined;
                if (!active || !row) return null;
                const totals = totalsByDay.get(row.day);
                return (
                  <div className="rounded-lg border bg-popover px-2.5 py-1.5 text-xs shadow-md">
                    <p className="font-medium">{formatShortDay(row.day)}</p>
                    {totals ? (
                      <>
                        <p>{formatKcal(totals.kcal)} kcal</p>
                        <p className="text-muted-foreground">
                          P {formatGrams(totals.protein)} g, C {formatGrams(totals.carbs)} g, G {formatGrams(totals.fat)} g
                        </p>
                      </>
                    ) : (
                      <p className="text-muted-foreground">Niente registrato</p>
                    )}
                  </div>
                );
              }}
            />
            {targets ? (
              <ReferenceLine
                y={targets.kcal}
                ifOverflow="extendDomain"
                stroke="var(--muted-foreground)"
                strokeDasharray="4 4"
                strokeWidth={1}
              />
            ) : null}
            <Bar dataKey="kcal" fill="var(--color-kcal)" radius={[4, 4, 0, 0]} isAnimationActive={false} />
          </BarChart>
        </ChartContainer>
      </section>

      <section aria-labelledby="macro-heading">
        <h2 id="macro-heading" className="font-heading text-lg font-semibold tracking-tight">
          Macronutrienti, media degli ultimi 7 giorni completi
        </h2>
        {lastWeekDays.length === 0 ? (
          <p className="py-3 text-sm text-muted-foreground">Registra qualche pasto per vedere le medie.</p>
        ) : (
          <dl className="mt-2 flex flex-col gap-3">
            {macroAverages.map((row) => {
              const target = targets?.[row.target] ?? 0;
              return (
                <div key={row.key}>
                  <div className="flex justify-between text-sm">
                    <dt>{row.label}</dt>
                    <dd>
                      <span className="font-medium">{formatGrams(row.average)} g</span>
                      {target ? <span className="text-muted-foreground"> su {formatGrams(target)} g</span> : null}
                    </dd>
                  </div>
                  {target ? (
                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
                      <div
                        className={cn("h-full rounded-full", row.colorClass)}
                        style={{ width: `${Math.min(row.average / target, 1) * 100}%` }}
                      />
                    </div>
                  ) : null}
                </div>
              );
            })}
          </dl>
        )}
      </section>

      <section aria-labelledby="weekly-heading" className="flex flex-col gap-2">
        <h2 id="weekly-heading" className="font-heading text-lg font-semibold tracking-tight">
          Kcal medie e peso, settimana per settimana
        </h2>
        <p className="text-sm text-muted-foreground">Ultime 12 settimane. Le due serie hanno scale diverse, per questo sono in due grafici.</p>
        <p className="mt-2 text-xs font-medium text-muted-foreground">Kcal medie al giorno</p>
        <ChartContainer config={kcalConfig} className="aspect-[16/6] w-full">
          <BarChart data={weeklyRows} syncId="weekly" margin={{ top: 4, right: 4, bottom: 0, left: -8 }}>
            <CartesianGrid vertical={false} />
            <XAxis dataKey="week" hide />
            <YAxis tickLine={false} axisLine={false} width={52} tickFormatter={(value: number) => formatKcal(value)} />
            <ChartTooltip
              cursor={{ fillOpacity: 0.4 }}
              content={({ active, payload }) => (
                <WeekTooltip active={active} row={payload?.[0]?.payload as (typeof weeklyRows)[number] | undefined} />
              )}
            />
            <Bar dataKey="kcal" fill="var(--color-kcal)" radius={[4, 4, 0, 0]} isAnimationActive={false} />
          </BarChart>
        </ChartContainer>
        <p className="mt-2 text-xs font-medium text-muted-foreground">Peso medio (kg)</p>
        {weightValues.length > 0 ? (
          <ChartContainer config={weightConfig} className="aspect-[16/6] w-full">
            <LineChart data={weeklyRows} syncId="weekly" margin={{ top: 4, right: 4, bottom: 0, left: -8 }}>
              <CartesianGrid vertical={false} />
              <XAxis
                dataKey="week"
                tickLine={false}
                axisLine={false}
                tickMargin={6}
                minTickGap={24}
                tickFormatter={(week: string) => formatShortDay(week)}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                width={52}
                domain={[Math.floor(Math.min(...weightValues) - 1), Math.ceil(Math.max(...weightValues) + 1)]}
                tickFormatter={(value: number) => formatDecimal(value)}
              />
              <ChartTooltip
                cursor={{ strokeWidth: 1 }}
                content={({ active, payload }) => (
                  <WeekTooltip active={active} row={payload?.[0]?.payload as (typeof weeklyRows)[number] | undefined} />
                )}
              />
              <Line
                dataKey="weight"
                type="monotone"
                stroke="var(--color-weight)"
                strokeWidth={2}
                connectNulls
                dot={{ r: 4, strokeWidth: 2, stroke: "var(--card)", fill: "var(--color-weight)" }}
                isAnimationActive={false}
              />
            </LineChart>
          </ChartContainer>
        ) : (
          <p className="py-2 text-sm text-muted-foreground">Nessuna misurazione del peso in questo periodo.</p>
        )}
      </section>

      <section aria-labelledby="maintenance-heading" className="flex flex-col gap-2">
        <h2 id="maintenance-heading" className="font-heading text-lg font-semibold tracking-tight">
          Fabbisogno stimato, settimana per settimana
        </h2>
        {latestMaintenance?.maintenanceKcal == null ? (
          <p className="text-sm text-muted-foreground">
            Con almeno 2 settimane di pasti e pesate qui vedi come cambia il fabbisogno stimato dai tuoi dati.
          </p>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">
              Calcolato ogni lunedì sulle 4 settimane precedenti,{" "}
              {latestMaintenance.day === today ? "oggi è" : `lunedì ${formatShortDay(latestMaintenance.day)} era`}{" "}
              {formatKcal(latestMaintenance.maintenanceKcal)} kcal
              {targets ? `. Obiettivo ${formatKcal(targets.kcal)} (linea tratteggiata)` : ""}.
            </p>
            <ChartContainer config={maintenanceConfig} className="aspect-[16/7] w-full">
              <LineChart data={maintenanceHistory} margin={{ top: 8, right: 4, bottom: 0, left: -8 }}>
                <CartesianGrid vertical={false} />
                <XAxis
                  dataKey="day"
                  tickLine={false}
                  axisLine={false}
                  tickMargin={6}
                  minTickGap={24}
                  tickFormatter={(day: string) => formatShortDay(day)}
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  width={52}
                  domain={["dataMin - 100", "dataMax + 100"]}
                  tickFormatter={(value: number) => formatKcal(value)}
                />
                <ChartTooltip
                  cursor={{ strokeWidth: 1 }}
                  content={({ active, payload }) => {
                    const row = payload?.[0]?.payload as (typeof maintenanceHistory)[number] | undefined;
                    if (!active || !row) return null;
                    return (
                      <div className="rounded-lg border bg-popover px-2.5 py-1.5 text-xs shadow-md">
                        <p className="font-medium">{row.day === today ? "Oggi" : `Lunedì ${formatShortDay(row.day)}`}</p>
                        <p>
                          {row.maintenanceKcal === null
                            ? "Dati insufficienti"
                            : `${formatKcal(row.maintenanceKcal)} kcal al giorno`}
                        </p>
                      </div>
                    );
                  }}
                />
                {targets ? (
                  <ReferenceLine
                    y={targets.kcal}
                    ifOverflow="extendDomain"
                    stroke="var(--muted-foreground)"
                    strokeDasharray="4 4"
                    strokeWidth={1}
                  />
                ) : null}
                <Line
                  dataKey="maintenanceKcal"
                  type="monotone"
                  stroke="var(--color-maintenanceKcal)"
                  strokeWidth={2}
                  connectNulls
                  dot={{ r: 4, strokeWidth: 2, stroke: "var(--card)", fill: "var(--color-maintenanceKcal)" }}
                  isAnimationActive={false}
                />
              </LineChart>
            </ChartContainer>
          </>
        )}
      </section>
    </div>
  );
}

function WeekTooltip({
  active,
  row,
}: {
  active?: boolean;
  row: { week: string; kcal: number | null; weight: number | null } | undefined;
}) {
  if (!active || !row) return null;
  return (
    <div className="rounded-lg border bg-popover px-2.5 py-1.5 text-xs shadow-md">
      <p className="font-medium">Settimana del {formatShortDay(row.week)}</p>
      <p>{row.kcal === null ? "Kcal non registrate" : `${formatKcal(row.kcal)} kcal al giorno`}</p>
      <p>{row.weight === null ? "Peso non misurato" : `${formatDecimal(row.weight)} kg`}</p>
    </div>
  );
}
