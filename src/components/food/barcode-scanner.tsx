"use client";

import { XIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { normalizeBarcode } from "@/lib/open-food-facts";

type Detector = { detect: (source: HTMLVideoElement) => Promise<{ rawValue: string }[]> };

const formats = ["ean_13", "ean_8", "upc_a", "upc_e"];

async function createDetector(): Promise<Detector> {
  const nativeDetector = (globalThis as { BarcodeDetector?: new (options: { formats: string[] }) => Detector })
    .BarcodeDetector;
  if (nativeDetector) return new nativeDetector({ formats });
  const { BarcodeDetector } = await import("barcode-detector/ponyfill");
  return new BarcodeDetector({ formats: formats as never }) as unknown as Detector;
}

export function BarcodeScanner({
  isLookingUp,
  onDetected,
  onClose,
}: {
  isLookingUp: boolean;
  onDetected: (barcode: string) => void;
  onClose: () => void;
}) {
  const videoReference = useRef<HTMLVideoElement>(null);
  const onDetectedReference = useRef(onDetected);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [manualCode, setManualCode] = useState("");

  useEffect(() => {
    onDetectedReference.current = onDetected;
  }, [onDetected]);

  useEffect(() => {
    let stream: MediaStream | null = null;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    async function start() {
      if (!navigator.mediaDevices?.getUserMedia) {
        setCameraError("Questo browser non può usare la fotocamera. Scrivi il codice qui sotto.");
        return;
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" } },
          audio: false,
        });
      } catch {
        setCameraError("Non ho accesso alla fotocamera. Consenti l'accesso o scrivi il codice qui sotto.");
        return;
      }
      if (cancelled || !videoReference.current) return;
      videoReference.current.srcObject = stream;
      await videoReference.current.play().catch(() => undefined);
      const detector = await createDetector();

      async function scan() {
        if (cancelled || !videoReference.current) return;
        try {
          if (videoReference.current.readyState >= 2) {
            const [result] = await detector.detect(videoReference.current);
            const barcode = result ? normalizeBarcode(result.rawValue) : null;
            if (barcode) {
              navigator.vibrate?.(40);
              onDetectedReference.current(barcode);
              return;
            }
          }
        } catch (error) {
          console.error(error);
        }
        timer = setTimeout(scan, 250);
      }
      scan();
    }

    start();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      stream?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  const manualBarcode = normalizeBarcode(manualCode);

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent showCloseButton={false} className="flex h-dvh max-w-none flex-col gap-0 rounded-none p-0 sm:max-w-md">
        <div className="flex items-center justify-between p-3">
          <div>
            <DialogTitle>Scansiona il codice a barre</DialogTitle>
            <DialogDescription>Inquadra il codice sulla confezione.</DialogDescription>
          </div>
          <Button variant="ghost" size="icon" aria-label="Chiudi" onClick={onClose}>
            <XIcon />
          </Button>
        </div>
        <div className="relative flex flex-1 items-center justify-center overflow-hidden bg-black">
          {cameraError ? (
            <p className="max-w-xs px-6 text-center text-sm text-white/80">{cameraError}</p>
          ) : (
            <>
              <video ref={videoReference} muted playsInline className="h-full w-full object-cover" />
              <div className="pointer-events-none absolute inset-x-10 top-1/2 h-32 -translate-y-1/2 rounded-2xl border-2 border-energy/90 shadow-[0_0_0_100vmax_rgb(0_0_0/0.35)]" />
            </>
          )}
          {isLookingUp ? (
            <div className="absolute inset-0 flex items-center justify-center bg-black/60 text-white">
              <Spinner className="size-6" />
            </div>
          ) : null}
        </div>
        <form
          className="flex gap-2 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
          onSubmit={(event) => {
            event.preventDefault();
            if (manualBarcode) onDetected(manualBarcode);
          }}
        >
          <Input
            inputMode="numeric"
            placeholder="Oppure scrivi il codice"
            aria-label="Codice a barre"
            value={manualCode}
            onChange={(event) => setManualCode(event.target.value)}
          />
          <Button type="submit" disabled={!manualBarcode || isLookingUp}>
            Cerca
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
