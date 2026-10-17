"use client";

import Link from "next/link";
import { useTransition } from "react";
import { toast } from "sonner";
import { dismissWeeklyCheckIn } from "@/app/actions/profile";
import { useApplyAdaptiveGoal } from "@/components/profile/use-apply-adaptive-goal";
import { Button } from "@/components/ui/button";
import { formatDecimal, formatGrams, formatKcal } from "@/lib/nutrition/format";
import { goalPurposes } from "@/lib/nutrition/goals";
import type { WeeklyCheckIn } from "@/server/adaptive-goal";

function formatWeeklyChange(kilograms: number) {
  const sign = kilograms > 0 ? "+" : kilograms < 0 ? "−" : "";
  return `${sign}${formatDecimal(Math.abs(kilograms))} kg`;
}

export function WeeklyCheckInCard({ checkIn }: { checkIn: WeeklyCheckIn }) {
  const { isPending: isApplying, apply } = useApplyAdaptiveGoal();
  const [isDismissing, startDismiss] = useTransition();
  const isPending = isApplying || isDismissing;
  const { estimate, suggestion, goal, weeklyRateKg, currentTargetKcal, summary } = checkIn;
  if (estimate.status !== "ready") return null;
  const isAligned = suggestion !== null && suggestion.kcal === currentTargetKcal;

  function dismiss() {
    startDismiss(async () => {
      const result = await dismissWeeklyCheckIn();
      if (!result.ok) toast.error(result.error);
    });
  }

  return (
    <section aria-labelledby="weekly-check-in-heading" className="mt-3 rounded-2xl bg-card p-4 ring-1 ring-border">
      <h2 id="weekly-check-in-heading" className="font-heading text-lg font-semibold tracking-tight">
        Il punto della settimana
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        {summary
          ? `La settimana scorsa: in media ${formatKcal(summary.averageKcal)} kcal e ${formatGrams(summary.averageProteinG)} g di proteine, in ${summary.loggedDays} ${summary.loggedDays === 1 ? "giorno registrato" : "giorni registrati"}.`
          : "La settimana scorsa non hai registrato niente."}
      </p>
      <p className="mt-2 text-sm">
        Fabbisogno stimato <span className="font-semibold">{formatKcal(estimate.maintenanceKcal)} kcal</span>, peso{" "}
        {formatWeeklyChange(estimate.weeklyWeightChangeKg)} a settimana.
      </p>
      {suggestion && goal ? (
        isAligned ? (
          <p className="mt-2 text-sm">Il tuo obiettivo di {formatKcal(suggestion.kcal)} kcal è già allineato.</p>
        ) : (
          <p className="mt-2 text-sm">
            Per {goalPurposes[goal]}
            {goal === "maintain" ? "" : ` ${formatDecimal(weeklyRateKg ?? 0)} kg a settimana`}:{" "}
            <span className="font-semibold">{formatKcal(suggestion.kcal)} kcal</span>
            {currentTargetKcal ? ` invece di ${formatKcal(currentTargetKcal)}` : ""}.
          </p>
        )
      ) : (
        <p className="mt-2 text-sm text-muted-foreground">
          Completa i tuoi dati in{" "}
          <Link href="/profile" className="font-medium text-foreground underline underline-offset-4">
            Profilo
          </Link>{" "}
          per avere un obiettivo.
        </p>
      )}
      <div className="mt-3 flex gap-2">
        {suggestion && goal && !isAligned ? (
          <>
            <Button size="lg" className="flex-1" onClick={apply} disabled={isPending}>
              Aggiorna obiettivo
            </Button>
            <Button size="lg" variant="outline" onClick={dismiss} disabled={isPending}>
              Non ora
            </Button>
          </>
        ) : (
          <Button size="lg" variant="outline" className="flex-1" onClick={dismiss} disabled={isPending}>
            Ok
          </Button>
        )}
      </div>
    </section>
  );
}
