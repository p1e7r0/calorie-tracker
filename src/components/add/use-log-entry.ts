"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { type AddEntryInput, addDiaryEntry } from "@/app/actions/diary";
import { addedToMealMessage, toastWithUndo } from "@/components/diary/toast-with-undo";
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
      toastWithUndo(addedToMealMessage(mealLabels[input.meal as MealType], label), [result.data.id], onUndone);
      onLogged();
    });
  }

  return { isPending, log };
}
