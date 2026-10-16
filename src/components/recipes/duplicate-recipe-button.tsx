"use client";

import { CopyPlusIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { duplicateRecipe } from "@/app/actions/recipes";
import { Button } from "@/components/ui/button";

export function DuplicateRecipeButton({ recipeId }: { recipeId: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label="Duplica ricetta"
      disabled={isPending}
      onClick={() =>
        startTransition(async () => {
          const result = await duplicateRecipe(recipeId);
          if (!result.ok) {
            toast.error(result.error);
            return;
          }
          toast.success("Ricetta duplicata: modifica la copia");
          router.push(`/recipes/${result.data.id}/edit`);
        })
      }
    >
      <CopyPlusIcon />
    </Button>
  );
}
