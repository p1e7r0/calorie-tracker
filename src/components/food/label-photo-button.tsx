"use client";

import { CameraIcon } from "lucide-react";
import { useRef, useTransition } from "react";
import { toast } from "sonner";
import { readLabelFromPhoto } from "@/app/actions/ai";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import type { NutritionLabel } from "@/lib/ai-schemas";
import { resizeImage } from "@/lib/resize-image";

export function LabelPhotoButton({ onRead }: { onRead: (label: NutritionLabel) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isPending, startTransition] = useTransition();

  function handleFile(file: File) {
    startTransition(async () => {
      try {
        const formData = new FormData();
        formData.set("photo", new File([await resizeImage(file)], "label.jpg", { type: "image/jpeg" }));
        const result = await readLabelFromPhoto(formData);
        if (!result.ok) {
          toast.error(result.error);
          return;
        }
        onRead(result.data);
        toast.success("Valori letti dall'etichetta: controllali prima di salvare.");
      } catch {
        toast.error("Non riesco ad aprire la foto. Riprova.");
      }
    });
  }

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        hidden
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (file) handleFile(file);
        }}
      />
      <Button
        type="button"
        variant="outline"
        size="lg"
        className="w-full"
        disabled={isPending}
        onClick={() => inputRef.current?.click()}
      >
        {isPending ? <Spinner /> : <CameraIcon />}
        {isPending ? "Leggo l'etichetta…" : "Compila da una foto dell'etichetta"}
      </Button>
    </>
  );
}
