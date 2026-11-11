"use client";

import { CameraIcon, PlusIcon, XIcon } from "lucide-react";
import Image from "next/image";
import { useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { readLabelFromPhotos } from "@/app/actions/ai";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import type { NutritionLabel } from "@/lib/ai-schemas";
import { labelPhotosProblem, maximumLabelPhotos } from "@/lib/label-photos";
import { resizeImage } from "@/lib/resize-image";

type StagedPhoto = { id: number; blob: Blob; previewUrl: string };

export function LabelPhotoButton({ onRead }: { onRead: (label: NutritionLabel) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const nextPhotoId = useRef(0);
  const [photos, setPhotos] = useState<StagedPhoto[]>([]);
  const [isPreparing, setIsPreparing] = useState(false);
  const [isPending, startTransition] = useTransition();
  const previewUrls = useRef(new Set<string>());

  useEffect(() => {
    const urls = previewUrls.current;
    return () => {
      for (const url of urls) URL.revokeObjectURL(url);
      urls.clear();
    };
  }, []);

  function revokePreview(url: string) {
    URL.revokeObjectURL(url);
    previewUrls.current.delete(url);
  }

  async function addPhoto(file: File) {
    setIsPreparing(true);
    try {
      const blob = await resizeImage(file);
      nextPhotoId.current += 1;
      const photo = { id: nextPhotoId.current, blob, previewUrl: URL.createObjectURL(blob) };
      previewUrls.current.add(photo.previewUrl);
      setPhotos((current) => [...current, photo]);
    } catch {
      toast.error("Non riesco ad aprire la foto. Riprova.");
    } finally {
      setIsPreparing(false);
    }
  }

  function removePhoto(removed: StagedPhoto) {
    revokePreview(removed.previewUrl);
    setPhotos((current) => current.filter((photo) => photo.id !== removed.id));
  }

  function clearPhotos() {
    for (const photo of photos) revokePreview(photo.previewUrl);
    setPhotos([]);
  }

  function readPhotos() {
    const problem = labelPhotosProblem(photos.map((photo) => photo.blob.size));
    if (problem) {
      toast.error(problem);
      return;
    }
    startTransition(async () => {
      try {
        const formData = new FormData();
        photos.forEach((photo, index) => {
          formData.append("photo", new File([photo.blob], `label-${index + 1}.jpg`, { type: "image/jpeg" }));
        });
        const result = await readLabelFromPhotos(formData);
        if (!result.ok) {
          toast.error(result.error);
          return;
        }
        onRead(result.data);
        clearPhotos();
        toast.success("Valori letti dall'etichetta: controllali prima di salvare.");
      } catch {
        toast.error("Non riesco a inviare le foto. Riprova.");
      }
    });
  }

  const isBusy = isPreparing || isPending;
  const canAddPhoto = photos.length < maximumLabelPhotos;

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
          if (file) addPhoto(file);
        }}
      />
      {photos.length === 0 ? (
        <Button
          type="button"
          variant="outline"
          size="lg"
          className="w-full"
          disabled={isBusy}
          onClick={() => inputRef.current?.click()}
        >
          {isBusy ? <Spinner /> : <CameraIcon />}
          Compila da una foto dell&apos;etichetta
        </Button>
      ) : (
        <div className="flex flex-col gap-3 rounded-xl border p-3">
          <p className="text-sm text-muted-foreground">
            Aggiungi anche il fronte della confezione per leggere nome e marca (al massimo {maximumLabelPhotos} foto).
          </p>
          <ul className="flex flex-wrap gap-3" aria-label="Foto della confezione">
            {photos.map((photo, index) => (
              <li key={photo.id} className="relative size-20 shrink-0">
                <Image
                  src={photo.previewUrl}
                  alt={`Foto ${index + 1}`}
                  fill
                  unoptimized
                  sizes="5rem"
                  className="rounded-lg border object-cover"
                />
                <button
                  type="button"
                  aria-label={`Togli la foto ${index + 1}`}
                  disabled={isBusy}
                  onClick={() => removePhoto(photo)}
                  className="absolute -top-2.5 -right-2.5 flex size-8 items-center justify-center disabled:opacity-50"
                >
                  <span className="flex size-5 items-center justify-center rounded-full bg-foreground text-background shadow-sm">
                    <XIcon className="size-3.5" />
                  </span>
                </button>
              </li>
            ))}
            {canAddPhoto ? (
              <li className="size-20 shrink-0">
                <button
                  type="button"
                  aria-label="Aggiungi una foto"
                  disabled={isBusy}
                  onClick={() => inputRef.current?.click()}
                  className="flex size-full items-center justify-center rounded-lg border border-dashed text-muted-foreground disabled:opacity-50"
                >
                  {isPreparing ? <Spinner /> : <PlusIcon />}
                </button>
              </li>
            ) : null}
          </ul>
          <Button type="button" size="lg" className="w-full" disabled={isBusy} onClick={readPhotos}>
            {isPending ? <Spinner /> : <CameraIcon />}
            {isPending ? "Leggo l'etichetta…" : photos.length === 1 ? "Leggi la foto" : `Leggi le ${photos.length} foto`}
          </Button>
        </div>
      )}
    </>
  );
}
