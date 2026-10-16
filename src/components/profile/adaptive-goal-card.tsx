"use client";

import { TrendingDownIcon, TrendingUpIcon } from "lucide-react";
import { useTransition } from "react";
import { toast } from "sonner";
import { applyAdaptiveGoal } from "@/app/actions/profile";
import { Button } from "@/components/ui/button";
import { requiredLoggedDays, requiredWeightSpanDays } from "@/lib/nutrition/adaptive";
import { formatDecimal, formatKcal } from "@/lib/nutrition/format";
import type { AdaptiveGoal } from "@/server/adaptive-goal";

const goalLabels = { lose: "dimagrire", maintain: "mantenere il peso", gain: "aumentare" } as const;

export function AdaptiveGoalCard({ adaptiveGoal }: { adaptiveGoal: AdaptiveGoal }) {
  const [isPending, startTransition] = useTransition();
  const { estimate, suggestion, goal, weeklyRateKg, currentTargetKcal } = adaptiveGoal;

  function apply() {
    startTransition(async () => {
      const result = await applyAdaptiveGoal();
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(`Nuovo obiettivo: ${formatKcal(result.data.kcal)} kcal`);
    });
  }

  return (
    <section aria-labelledby="adaptive-goal-heading" className="rounded-2xl bg-card p-4 ring-1 ring-border">
      <h2 id="adaptive-goal-heading" className="font-heading text-lg font-semibold tracking-tight">
        Fabbisogno dai tuoi dati
      </h2>
      {estimate.status === "ready" ? (
        <>
          <p className="mt-1 font-heading text-3xl font-semibold tracking-tight">
            {formatKcal(estimate.maintenanceKcal)}
            <span className="ml-1 text-base font-medium text-muted-foreground">kcal al giorno</span>
          </p>
          <p className="mt-1 flex items-start gap-1.5 text-sm text-muted-foreground">
            {estimate.weeklyWeightChangeKg < 0 ? (
              <TrendingDownIcon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            ) : (
              <TrendingUpIcon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            )}
            <span>
              Hai mangiato in media {formatKcal(estimate.averageIntakeKcal)} kcal in {estimate.loggedDays} giorni e il
              peso è cambiato di {estimate.weeklyWeightChangeKg > 0 ? "+" : ""}
              {formatDecimal(estimate.weeklyWeightChangeKg)} kg a settimana: per restare stabile ti servono circa{" "}
              {formatKcal(estimate.maintenanceKcal)} kcal.
            </span>
          </p>
          {suggestion && goal ? (
            suggestion.kcal === currentTargetKcal ? (
              <p className="mt-3 text-sm font-medium">Il tuo obiettivo è già allineato.</p>
            ) : (
              <div className="mt-3 flex flex-col gap-2">
                <p className="text-sm">
                  Per {goalLabels[goal]}
                  {goal === "maintain" ? "" : ` ${formatDecimal(weeklyRateKg ?? 0)} kg a settimana`}:{" "}
                  <span className="font-semibold">{formatKcal(suggestion.kcal)} kcal</span>
                  {currentTargetKcal ? ` invece di ${formatKcal(currentTargetKcal)}` : ""}.
                </p>
                <Button onClick={apply} disabled={isPending}>
                  Usa {formatKcal(suggestion.kcal)} kcal come obiettivo
                </Button>
              </div>
            )
          ) : (
            <p className="mt-3 text-sm text-muted-foreground">Compila i tuoi dati qui sopra per avere un obiettivo.</p>
          )}
        </>
      ) : estimate.status === "implausible" ? (
        <p className="mt-1 text-sm text-muted-foreground">
          I dati delle ultime 4 settimane non tornano: forse qualche pasto non è stato registrato o una pesata è
          sbagliata. Controlla lo storico e riprova tra qualche giorno.
        </p>
      ) : (
        <>
          <p className="mt-1 text-sm text-muted-foreground">
            Con qualche settimana di dati calcolo quante kcal ti servono davvero, dal confronto tra quello che mangi e
            come cambia il peso.
          </p>
          <Progress
            label="Giorni registrati nelle ultime 4 settimane"
            value={estimate.loggedDays}
            required={requiredLoggedDays}
          />
          <Progress
            label="Giorni tra la prima e l'ultima pesata"
            value={estimate.weightSpanDays}
            required={requiredWeightSpanDays}
          />
        </>
      )}
    </section>
  );
}

function Progress({ label, value, required }: { label: string; value: number; required: number }) {
  const ratio = Math.min(value / required, 1);
  return (
    <div className="mt-3">
      <div className="flex justify-between text-sm">
        <span>{label}</span>
        <span className="font-medium tabular-nums">
          {Math.min(value, required)} su {required}
        </span>
      </div>
      <div
        className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted"
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={required}
        aria-valuenow={Math.min(value, required)}
      >
        <div className="h-full rounded-full bg-energy" style={{ width: `${ratio * 100}%` }} />
      </div>
    </div>
  );
}
