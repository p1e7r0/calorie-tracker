"use client";

import { CameraIcon, XIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { normalizeBarcode } from "@/lib/open-food-facts";

type Detector = { detect: (source: ImageBitmapSource) => Promise<{ rawValue: string }[]> };

const formats = ["ean_13", "ean_8", "upc_a", "upc_e"];

async function createDetector(): Promise<Detector> {
  const nativeDetector = (globalThis as { BarcodeDetector?: new (options: { formats: string[] }) => Detector })
    .BarcodeDetector;
  if (nativeDetector) return new nativeDetector({ formats });
  const { BarcodeDetector } = await import("barcode-detector/ponyfill");
  return new BarcodeDetector({ formats: formats as never }) as unknown as Detector;
}

async function detectBarcodeInPhoto(file: File) {
  const [detector, bitmap] = await Promise.all([createDetector(), createImageBitmap(file)]);
  try {
    const results = await detector.detect(bitmap);
    for (const result of results) {
      const barcode = normalizeBarcode(result.rawValue);
      if (barcode) return barcode;
    }
    return null;
  } finally {
    bitmap.close();
  }
}

const photoToastId = "barcode-photo";

export function useBarcodeScanner({
  isLookingUp,
  onDetected,
}: {
  isLookingUp: boolean;
  onDetected: (barcode: string) => void;
}) {
  const photoInputReference = useRef<HTMLInputElement>(null);
  const [isFallbackOpen, setIsFallbackOpen] = useState(false);
  const [isDecoding, setIsDecoding] = useState(false);

  useEffect(() => {
    if (!isDecoding && !isLookingUp) toast.dismiss(photoToastId);
  }, [isDecoding, isLookingUp]);

  function open() {
    photoInputReference.current?.click();
  }

  function close() {
    setIsFallbackOpen(false);
  }

  async function readPhoto(file: File) {
    setIsDecoding(true);
    toast.loading("Leggo il codice a barre…", { id: photoToastId });
    let barcode: string | null = null;
    try {
      barcode = await detectBarcodeInPhoto(file);
    } catch (error) {
      console.error(error);
    }
    setIsDecoding(false);
    if (barcode) {
      setIsFallbackOpen(false);
      onDetected(barcode);
    } else {
      setIsFallbackOpen(true);
    }
  }

  const element = (
    <>
      <input
        ref={photoInputReference}
        type="file"
        accept="image/*"
        capture="environment"
        hidden
        aria-label="Foto del codice a barre"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (file) readPhoto(file);
        }}
      />
      {isFallbackOpen ? (
        <BarcodeFallbackDialog
          isBusy={isDecoding || isLookingUp}
          onDetected={onDetected}
          onRetakePhoto={open}
          onClose={close}
        />
      ) : null}
    </>
  );

  return { open, close, element };
}

function BarcodeFallbackDialog({
  isBusy,
  onDetected,
  onRetakePhoto,
  onClose,
}: {
  isBusy: boolean;
  onDetected: (barcode: string) => void;
  onRetakePhoto: () => void;
  onClose: () => void;
}) {
  const [manualCode, setManualCode] = useState("");
  const manualBarcode = normalizeBarcode(manualCode);

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent showCloseButton={false} className="flex flex-col gap-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-col gap-1">
            <DialogTitle>Codice a barre non trovato</DialogTitle>
            <DialogDescription>
              Riprova con il codice al centro, ben illuminato e a fuoco, oppure scrivilo qui sotto.
            </DialogDescription>
          </div>
          <Button variant="ghost" size="icon" aria-label="Chiudi" onClick={onClose}>
            <XIcon />
          </Button>
        </div>
        <Button variant="outline" size="lg" disabled={isBusy} onClick={onRetakePhoto}>
          <CameraIcon />
          Scatta di nuovo
        </Button>
        <form
          className="flex gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            if (manualBarcode) onDetected(manualBarcode);
          }}
        >
          <Input
            inputMode="numeric"
            placeholder="Scrivi il codice"
            aria-label="Codice a barre"
            value={manualCode}
            onChange={(event) => setManualCode(event.target.value)}
          />
          <Button type="submit" disabled={!manualBarcode || isBusy}>
            Cerca
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
