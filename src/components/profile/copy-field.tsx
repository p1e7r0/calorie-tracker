"use client";

import { CopyIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

export function CopyField({ label, value }: { label: string; value: string }) {
  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      toast.success(`${label} copiato`);
    } catch {
      toast.error("Non riesco a copiare: seleziona il testo a mano.");
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs text-muted-foreground">{label}</span>
      <div className="flex items-center gap-2 rounded-lg border bg-background py-1 pr-1 pl-3">
        <code className="min-w-0 flex-1 truncate font-mono text-sm select-all">
          {value}
        </code>
        <Button type="button" variant="ghost" size="icon-sm" aria-label={`Copia ${label}`} onClick={copy}>
          <CopyIcon />
        </Button>
      </div>
    </div>
  );
}
