import { toast } from "sonner";
import { type ActionResult, deleteDiaryEntries } from "@/app/actions/diary";

export function toastWithUndo(
  message: string,
  entryIds: string[],
  onUndone?: () => void,
  undo: (entryIds: string[]) => Promise<ActionResult<unknown>> = deleteDiaryEntries,
) {
  toast.success(message, {
    action: {
      label: "Annulla",
      onClick: async () => {
        const result = await undo(entryIds);
        if (!result.ok) {
          toast.error(result.error);
          return;
        }
        onUndone?.();
      },
    },
  });
}

export function addedToMealMessage(mealLabel: string, name: string) {
  return `Aggiunto a ${mealLabel.toLowerCase()}: «${name}»`;
}
