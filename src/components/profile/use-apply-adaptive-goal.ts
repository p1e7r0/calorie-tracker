"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { applyAdaptiveGoal, restoreTargets } from "@/app/actions/profile";
import { formatKcal } from "@/lib/nutrition/format";

export function useApplyAdaptiveGoal() {
  const [isPending, startTransition] = useTransition();

  function apply() {
    startTransition(async () => {
      const result = await applyAdaptiveGoal();
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      const { previous } = result.data;
      toast.success(`Nuovo obiettivo: ${formatKcal(result.data.kcal)} kcal`, {
        action: {
          label: "Annulla",
          onClick: async () => {
            const restored = await restoreTargets(previous);
            if (!restored.ok) toast.error(restored.error);
          },
        },
      });
    });
  }

  return { isPending, apply };
}
