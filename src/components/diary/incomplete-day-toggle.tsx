"use client";

import { useId, useOptimistic, useTransition } from "react";
import { toast } from "sonner";
import { markIncompleteDay } from "@/app/actions/diary";
import { Switch } from "@/components/ui/switch";

export function IncompleteDayToggle({ day, incomplete }: { day: string; incomplete: boolean }) {
  const labelId = useId();
  const descriptionId = useId();
  const [optimisticIncomplete, setOptimisticIncomplete] = useOptimistic(incomplete);
  const [isPending, startTransition] = useTransition();

  function change(nextIncomplete: boolean) {
    startTransition(async () => {
      setOptimisticIncomplete(nextIncomplete);
      const result = await markIncompleteDay({ day, incomplete: nextIncomplete });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast(nextIncomplete ? "Giorno segnato come incompleto" : "Giorno segnato come completo", {
        action: {
          label: "Annulla",
          onClick: async () => {
            const restored = await markIncompleteDay({ day, incomplete: !nextIncomplete });
            if (!restored.ok) toast.error(restored.error);
          },
        },
      });
    });
  }

  return (
    <div className="mt-6 flex items-center justify-between gap-3 rounded-xl bg-muted/60 px-3 py-3 text-sm">
      <div className="min-w-0">
        <p id={labelId} className="font-medium">
          Giorno incompleto
        </p>
        <p id={descriptionId} className="text-muted-foreground">
          Non hai registrato tutto? Il giorno resta fuori dalle medie e dalla stima del fabbisogno.
        </p>
      </div>
      <Switch
        aria-labelledby={labelId}
        aria-describedby={descriptionId}
        checked={optimisticIncomplete}
        disabled={isPending}
        onCheckedChange={change}
      />
    </div>
  );
}
