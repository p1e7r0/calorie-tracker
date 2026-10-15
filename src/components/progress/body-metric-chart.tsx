"use client";

import { CartesianGrid, ComposedChart, Line, Scatter, XAxis, YAxis } from "recharts";
import { ChartContainer, ChartTooltip, type ChartConfig } from "@/components/ui/chart";
import { formatShortDay } from "@/lib/nutrition/days";
import { formatDecimal } from "@/lib/nutrition/format";

export type BodyChartPoint = { day: string; time: number; value: number; average: number };

const chartConfig = {
  value: { label: "Misurazione", color: "var(--muted-foreground)" },
  average: { label: "Media 7 giorni", color: "var(--foreground)" },
} satisfies ChartConfig;

function dayFromTime(time: number) {
  return new Date(time).toISOString().slice(0, 10);
}

export function BodyMetricChart({ points, unit }: { points: BodyChartPoint[]; unit: string }) {
  const values = points.map((point) => point.value);
  const minimum = Math.min(...values);
  const maximum = Math.max(...values);
  const padding = Math.max((maximum - minimum) * 0.15, 0.5);

  return (
    <ChartContainer config={chartConfig} className="aspect-[16/10] w-full">
      <ComposedChart data={points} margin={{ top: 8, right: 4, bottom: 0, left: -8 }}>
        <CartesianGrid vertical={false} strokeDasharray="0" />
        <XAxis
          dataKey="time"
          type="number"
          scale="time"
          domain={["dataMin", "dataMax"]}
          tickFormatter={(time: number) => formatShortDay(dayFromTime(time))}
          tickLine={false}
          axisLine={false}
          minTickGap={24}
          tickMargin={8}
        />
        <YAxis
          domain={[Math.floor(minimum - padding), Math.ceil(maximum + padding)]}
          tickFormatter={(value: number) => formatDecimal(value)}
          tickLine={false}
          axisLine={false}
          width={52}
          allowDecimals
        />
        <ChartTooltip
          cursor={{ strokeWidth: 1 }}
          content={({ active, payload }) => {
            const point = payload?.[0]?.payload as BodyChartPoint | undefined;
            if (!active || !point) return null;
            return (
              <div className="rounded-lg border bg-popover px-2.5 py-1.5 text-xs shadow-md">
                <p className="font-medium">{formatShortDay(point.day)}</p>
                <p>
                  <span className="text-muted-foreground">Misurazione </span>
                  {formatDecimal(point.value)} {unit}
                </p>
                <p>
                  <span className="text-muted-foreground">Media 7 giorni </span>
                  {formatDecimal(point.average)} {unit}
                </p>
              </div>
            );
          }}
        />
        <Scatter
          dataKey="value"
          fill="var(--color-value)"
          stroke="var(--card)"
          strokeWidth={2}
          shape="circle"
          isAnimationActive={false}
        />
        <Line
          dataKey="average"
          type="monotone"
          stroke="var(--color-average)"
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 4, strokeWidth: 2, stroke: "var(--card)" }}
          isAnimationActive={false}
        />
      </ComposedChart>
    </ChartContainer>
  );
}
