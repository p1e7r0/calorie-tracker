"use client";

import { BatteryChargingIcon, XIcon } from "lucide-react";
import { useTransition } from "react";
import { toast } from "sonner";
import { updateRecharge } from "@/app/actions/diary";
import { Button } from "@/components/ui/button";
import type { RechargeState } from "@/lib/coach/recharge";
import { formatKcal } from "@/lib/nutrition/format";

type RechargeAction = "use" | "decline" | "clear" | "postpone" | "resume";

const confirmations: Partial<Record<RechargeAction, { message: string; undo: RechargeAction }>> = {
  use: { message: "Oggi è il giorno di ricarica", undo: "clear" },
  decline: { message: "Ricarica rifiutata: il conto riparte da zero", undo: "clear" },
  postpone: { message: "Ricarica rimandata a domani", undo: "resume" },
};

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

  function change(action: RechargeAction) {
    startTransition(async () => {
      const result = await updateRecharge({ action });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      if (action === "clear" && state.status === "active") {
        toast("Ricarica annullata");
        return;
      }
      const confirmation = confirmations[action];
      if (!confirmation) return;
      toast(confirmation.message, {
        action: {
          label: "Annulla",
          onClick: async () => {
            const restored = await updateRecharge({ action: confirmation.undo });
            if (!restored.ok) toast.error(restored.error);
          },
        },
      });
    });
  }

  if (state.status === "active") {
    return (
      <section
        aria-label="Ricarica"
        className="mt-2 flex items-start gap-3 rounded-2xl bg-card p-4 text-sm ring-1 ring-border"
      >
        <BatteryChargingIcon className="mt-0.5 size-5 shrink-0 text-energy" aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="font-medium">{readOnly ? "Giorno di ricarica" : "Oggi è il giorno di ricarica"}</p>
          <p className="text-muted-foreground">
            {`Obiettivo del giorno ${formatKcal(state.dayKcal)} kcal (+${formatKcal(state.bonusKcal)}). Le proteine restano a ${formatKcal(proteinG)} g.`}
          </p>
          {readOnly ? null : (
            <Button variant="outline" size="sm" className="mt-2" disabled={isPending} onClick={() => change("clear")}>
              Annulla la ricarica
            </Button>
          )}
        </div>
      </section>
    );
  }

  if (state.status === "unlocked") {
    return (
      <section
        aria-label="Ricarica"
        className="mt-2 flex items-start gap-3 rounded-2xl bg-card p-4 text-sm ring-1 ring-border"
      >
        <BatteryChargingIcon className="mt-0.5 size-5 shrink-0 text-energy" aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="font-medium">Ricarica sbloccata</p>
          <p className="text-muted-foreground">
            {`Hai messo da parte ${formatKcal(state.bankedKcal)} kcal: oggi puoi arrivare a ${formatKcal(state.dayKcal)} kcal. Se la rifiuti, il conto riparte da zero.`}
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <Button variant="secondary" size="sm" disabled={isPending} onClick={() => change("use")}>
              Segna oggi come ricarica
            </Button>
            <Button variant="outline" size="sm" disabled={isPending} onClick={() => change("decline")}>
              Rifiuta
            </Button>
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon-sm"
          className="-mt-1 -mr-1 touch-target"
          aria-label="Rimanda a domani"
          disabled={isPending}
          onClick={() => change("postpone")}
        >
          <XIcon />
        </Button>
      </section>
    );
  }

  if (state.status === "postponed" || state.status === "declined") {
    const postponed = state.status === "postponed";
    return (
      <div className="mt-6 flex items-center gap-3 rounded-xl bg-muted/60 px-3 py-2 text-sm text-muted-foreground">
        <p className="min-w-0 flex-1">
          {postponed
            ? `Ricarica rimandata a domani: hai ${formatKcal(state.bankedKcal)} kcal da parte.`
            : "Ricarica rifiutata: il conto riparte da domani."}
        </p>
        <Button
          variant="ghost"
          size="sm"
          className="shrink-0"
          disabled={isPending}
          onClick={() => change(postponed ? "resume" : "clear")}
        >
          {postponed ? "Usala oggi" : "Annulla"}
        </Button>
      </div>
    );
  }

  return (
    <p className="mt-6 rounded-xl bg-muted/60 px-3 py-3 text-sm text-muted-foreground">
      {state.bankedKcal > 0
        ? `Ricarica: hai ${formatKcal(state.bankedKcal)} kcal da parte, ne servono altre ${formatKcal(state.missingKcal)} per sbloccarla.`
        : `Ricarica: avanza ancora ${formatKcal(state.missingKcal)} kcal per sbloccarla.`}
    </p>
  );
}
