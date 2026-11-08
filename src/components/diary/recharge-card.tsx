"use client";

import { BatteryChargingIcon } from "lucide-react";
import { useTransition } from "react";
import { toast } from "sonner";
import { markRechargeDay } from "@/app/actions/diary";
import { Button } from "@/components/ui/button";
import type { RechargeState } from "@/lib/coach/recharge";
import { formatKcal } from "@/lib/nutrition/format";

export function RechargeCard({
  state,
  proteinG,
  readOnly,
}: {
  state: RechargeState;
  proteinG: number;
  readOnly: boolean;
}) {
  const [isPending, startTransition] = useTransition();

  function change(active: boolean) {
    startTransition(async () => {
      const result = await markRechargeDay({ active });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast(active ? "Oggi è il giorno di ricarica" : "Ricarica annullata", {
        action: {
          label: "Annulla",
          onClick: async () => {
            const restored = await markRechargeDay({ active: !active });
            if (!restored.ok) toast.error(restored.error);
          },
        },
      });
    });
  }

  if (state.status === "unlocked" || state.status === "active") {
    const active = state.status === "active";
    return (
      <section
        aria-label="Ricarica"
        className="mt-2 flex items-start gap-3 rounded-2xl bg-card p-4 text-sm ring-1 ring-border"
      >
        <BatteryChargingIcon className="mt-0.5 size-5 shrink-0 text-energy" aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="font-medium">
            {readOnly ? "Giorno di ricarica" : active ? "Oggi è il giorno di ricarica" : "Ricarica sbloccata"}
          </p>
          <p className="text-muted-foreground">
            {active
              ? `Obiettivo del giorno ${formatKcal(state.dayKcal)} kcal. Le proteine restano a ${formatKcal(proteinG)} g.`
              : `Hai avanzato ${formatKcal(state.bankedKcal)} kcal: oggi puoi arrivare a ${formatKcal(state.dayKcal)} kcal senza sforare il budget settimanale. Una volta a settimana.`}
          </p>
          {readOnly ? null : (
            <Button
              variant={active ? "outline" : "secondary"}
              size="sm"
              className="mt-2"
              disabled={isPending}
              onClick={() => change(!active)}
            >
              {active ? "Annulla la ricarica" : "Segna oggi come ricarica"}
            </Button>
          )}
        </div>
      </section>
    );
  }

  return (
    <p className="mt-6 rounded-xl bg-muted/60 px-3 py-3 text-sm text-muted-foreground">
      {state.status === "used"
        ? "Ricarica già usata questa settimana."
        : `Ricarica: avanza ancora ${formatKcal(state.missingKcal)} kcal questa settimana per sbloccare un giorno a ${formatKcal(state.dayKcal)} kcal.`}
    </p>
  );
}
