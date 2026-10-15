"use client";

import { StarIcon } from "lucide-react";
import { useOptimistic, useTransition } from "react";
import { toast } from "sonner";
import { setFoodFavorite, setRecipeFavorite } from "@/app/actions/foods";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function FavoriteButton({
  type,
  id,
  isFavorite,
}: {
  type: "food" | "recipe";
  id: string;
  isFavorite: boolean;
}) {
  const [optimisticFavorite, setOptimisticFavorite] = useOptimistic(isFavorite);
  const [, startTransition] = useTransition();

  function toggle() {
    const next = !optimisticFavorite;
    startTransition(async () => {
      setOptimisticFavorite(next);
      const result = type === "food" ? await setFoodFavorite(id, next) : await setRecipeFavorite(id, next);
      if (!result.ok) toast.error(result.error);
    });
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={toggle}
      aria-pressed={optimisticFavorite}
      aria-label={optimisticFavorite ? "Togli dai preferiti" : "Aggiungi ai preferiti"}
    >
      <StarIcon className={cn(optimisticFavorite && "fill-carbs text-carbs")} />
    </Button>
  );
}
