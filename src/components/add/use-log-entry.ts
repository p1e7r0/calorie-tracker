"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { type AddEntryInput, addDiaryEntry, deleteDiaryEntry } from "@/app/actions/diary";
import { mealLabels, type MealType } from "@/lib/nutrition/meals";

export function useLogEntry(onLogged: () => void, onUndone?: () => void) {
  const [isPending, startTransition] = useTransition();

  function log(input: AddEntryInput, label: string) {
    startTransition(async () => {
      const result = await addDiaryEntry(input);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      const entryId = result.data.id;
      toast.success(`${label} aggiunto a ${mealLabels[input.meal as MealType].toLowerCase()}`, {
        action: {
          label: "Annulla",
          onClick: async () => {
            const deleted = await deleteDiaryEntry(entryId);
            if (!deleted.ok) {
              toast.error(deleted.error);
              return;
            }
            onUndone?.();
          },
        },
      });
      onLogged();
    });
  }

  return { isPending, log };
}
