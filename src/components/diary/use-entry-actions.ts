"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { deleteDiaryEntry, duplicateDiaryEntry, restoreDiaryEntry } from "@/app/actions/diary";
import type { DiaryEntryView } from "@/server/diary";

export function useEntryActions() {
  const [isPending, startTransition] = useTransition();

  function removeEntry(entry: DiaryEntryView, onRemoved?: () => void) {
    startTransition(async () => {
      const result = await deleteDiaryEntry(entry.id);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      onRemoved?.();
      toast(`Eliminato: «${entry.label}»`, {
        action: {
          label: "Annulla",
          onClick: async () => {
            const restored = await restoreDiaryEntry(result.data);
            if (!restored.ok) toast.error(restored.error);
          },
        },
      });
    });
  }

  function duplicateEntry(entry: DiaryEntryView, onDuplicated?: () => void) {
    startTransition(async () => {
      const result = await duplicateDiaryEntry(entry.id);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      onDuplicated?.();
      toast.success(`Duplicato: «${entry.label}»`, {
        action: {
          label: "Annulla",
          onClick: async () => {
            const deleted = await deleteDiaryEntry(result.data.id);
            if (!deleted.ok) toast.error(deleted.error);
          },
        },
      });
    });
  }

  return { isPending, removeEntry, duplicateEntry };
}
