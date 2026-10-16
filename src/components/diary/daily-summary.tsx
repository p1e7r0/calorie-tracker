import Link from "next/link";
import { formatGrams, formatKcal } from "@/lib/nutrition/format";
import type { Nutrients } from "@/lib/nutrition/nutrients";
import type { WeeklyBudget } from "@/lib/nutrition/weekly-budget";
import type { DailyTargetsView } from "@/server/diary";
import { cn } from "@/lib/utils";

const macros = [
  { key: "protein", target: "proteinG", label: "Proteine", colorClass: "bg-protein" },
  { key: "carbs", target: "carbsG", label: "Carboidrati", colorClass: "bg-carbs" },
  { key: "fat", target: "fatG", label: "Grassi", colorClass: "bg-fat" },
] as const;

export function DailySummary({
  totals,
  targets,
  weekly,
}: {
  totals: Nutrients;
  targets: DailyTargetsView;
  weekly: WeeklyBudget | null;
}) {
  if (!targets) {
    return (
      <section aria-label="Riepilogo del giorno" className="rounded-2xl bg-card p-4 ring-1 ring-border">
        <p className="text-sm text-muted-foreground">Mangiate</p>
        <p className="font-heading text-5xl leading-none font-semibold tracking-tight">
          {formatKcal(totals.kcal)}
          <span className="ml-1.5 text-base font-medium text-muted-foreground">kcal</span>
        </p>
        <MacroTotals totals={totals} />
        <Link
          href="/profile"
          className="mt-4 flex h-10 items-center justify-center rounded-lg bg-secondary text-sm font-medium"
        >
          Imposta il tuo obiettivo giornaliero
        </Link>
      </section>
    );
  }

  const remaining = targets.kcal - totals.kcal;
  const isOver = remaining < 0;
  const progress = Math.min(totals.kcal / targets.kcal, 1);

  return (
    <section aria-label="Riepilogo del giorno" className="rounded-2xl bg-card p-4 ring-1 ring-border">
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground">{isOver ? "Oltre l'obiettivo" : "Restano"}</p>
          <p
            className={cn(
              "font-heading text-5xl leading-none font-semibold tracking-tight",
              isOver && "text-over",
            )}
          >
            {formatKcal(Math.abs(remaining))}
            <span className="ml-1.5 text-base font-medium text-muted-foreground">kcal</span>
          </p>
        </div>
        <dl className="text-right text-sm">
          <div className="flex justify-end gap-1.5">
            <dt className="text-muted-foreground">Mangiate</dt>
            <dd className="font-medium">{formatKcal(totals.kcal)}</dd>
          </div>
          <div className="flex justify-end gap-1.5">
            <dt className="text-muted-foreground">Obiettivo</dt>
            <dd className="font-medium">{formatKcal(targets.kcal)}</dd>
          </div>
        </dl>
      </div>

      <div
        className="mt-3 h-3 overflow-hidden rounded-full bg-muted"
        role="progressbar"
        aria-label="Kcal mangiate rispetto all'obiettivo"
        aria-valuemin={0}
        aria-valuemax={targets.kcal}
        aria-valuenow={Math.round(totals.kcal)}
      >
        <div
          className={cn("h-full rounded-full transition-[width] duration-500", isOver ? "bg-over" : "bg-energy")}
          style={{ width: `${progress * 100}%` }}
        />
      </div>

      <div className="mt-4 grid grid-cols-3 gap-3">
        {macros.map((macro) => {
          const eaten = totals[macro.key];
          const target = targets[macro.target];
          const ratio = target > 0 ? Math.min(eaten / target, 1) : 0;
          return (
            <div key={macro.key} className="min-w-0">
              <p className="truncate text-xs text-muted-foreground">{macro.label}</p>
              <p className="text-sm font-medium">
                {formatGrams(eaten)}
                <span className="text-muted-foreground"> / {formatGrams(target)} g</span>
              </p>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
                <div className={cn("h-full rounded-full", macro.colorClass)} style={{ width: `${ratio * 100}%` }} />
              </div>
            </div>
          );
        })}
      </div>

      {weekly ? <WeeklyBudgetRow weekly={weekly} /> : null}
    </section>
  );
}

function WeeklyBudgetRow({ weekly }: { weekly: WeeklyBudget }) {
  const isOver = weekly.remainingKcal < 0;
  const ratio = Math.min(weekly.eatenKcal / weekly.budgetKcal, 1);
  return (
    <div className="mt-4 border-t pt-3" aria-label="Budget della settimana" role="group">
      <div className="flex items-baseline justify-between gap-3 text-sm">
        <p>
          <span className="text-muted-foreground">Settimana </span>
          <span className={cn("font-medium", isOver && "text-over")}>
            {isOver
              ? `${formatKcal(-weekly.remainingKcal)} kcal oltre`
              : `${formatKcal(weekly.remainingKcal)} kcal rimaste`}
          </span>
          <span className="text-muted-foreground"> su {formatKcal(weekly.budgetKcal)}</span>
        </p>
        {weekly.daysLeft > 1 && !isOver ? (
          <p className="shrink-0 text-xs text-muted-foreground">
            circa {formatKcal(weekly.suggestedTodayKcal)} al giorno
          </p>
        ) : null}
      </div>
      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted">
        <div
          className={cn("h-full rounded-full", isOver ? "bg-over" : "bg-energy/70")}
          style={{ width: `${ratio * 100}%` }}
        />
      </div>
    </div>
  );
}

function MacroTotals({ totals }: { totals: Nutrients }) {
  return (
    <dl className="mt-3 grid grid-cols-3 gap-3 text-sm">
      {macros.map((macro) => (
        <div key={macro.key}>
          <dt className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className={cn("size-2 rounded-full", macro.colorClass)} aria-hidden="true" />
            {macro.label}
          </dt>
          <dd className="font-medium">{formatGrams(totals[macro.key])} g</dd>
        </div>
      ))}
    </dl>
  );
}
