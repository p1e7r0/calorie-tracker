"use client";

import { Trash2Icon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { archiveRecipe } from "@/app/actions/recipes";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";

export function ArchiveRecipeButton({ recipeId, name }: { recipeId: string; name: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  return (
    <AlertDialog>
      <AlertDialogTrigger render={<Button variant="ghost" size="icon" aria-label="Elimina ricetta" />}>
        <Trash2Icon />
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Eliminare «{name}»?</AlertDialogTitle>
          <AlertDialogDescription>Le porzioni già registrate nel diario restano invariate.</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Annulla</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            disabled={isPending}
            onClick={() =>
              startTransition(async () => {
                const result = await archiveRecipe(recipeId);
                if (!result.ok) {
                  toast.error(result.error);
                  return;
                }
                toast.success("Ricetta eliminata");
                router.replace("/food?tab=recipes");
              })
            }
          >
            Elimina
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
