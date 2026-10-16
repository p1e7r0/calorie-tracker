"use client";

import { CheckIcon } from "lucide-react";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { FieldError } from "@/components/ui/field";
import { Spinner } from "@/components/ui/spinner";
import { authClient } from "@/lib/auth/client";

const permissions = [
  "Cercare tra i tuoi alimenti e le tue ricette",
  "Leggere il diario e i tuoi obiettivi",
  "Aggiungere ed eliminare voci nel diario",
];

export function ConsentForm({ clientName }: { clientName: string }) {
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function answer(accept: boolean) {
    setErrorMessage(null);
    startTransition(async () => {
      const result = await authClient.oauth2.consent({ accept });
      const data: { redirect_uri?: string; url?: string } | null = result.data;
      const destination = data?.redirect_uri ?? data?.url;
      if (result.error || !destination) {
        setErrorMessage("La richiesta è scaduta. Torna all'applicazione e riprova.");
        return;
      }
      window.location.href = destination;
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <ul className="flex flex-col gap-3 rounded-2xl bg-muted/60 p-4 text-sm">
        {permissions.map((permission) => (
          <li key={permission} className="flex gap-3">
            <CheckIcon className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
            {permission}
          </li>
        ))}
      </ul>
      <p className="text-sm text-muted-foreground">
        Puoi scollegare {clientName} in qualsiasi momento dalle sue impostazioni.
      </p>
      {errorMessage ? <FieldError>{errorMessage}</FieldError> : null}
      <div className="flex flex-col gap-3">
        <Button size="lg" disabled={isPending} onClick={() => answer(true)}>
          {isPending ? <Spinner /> : null}
          Consenti
        </Button>
        <Button size="lg" variant="outline" disabled={isPending} onClick={() => answer(false)}>
          Annulla
        </Button>
      </div>
    </div>
  );
}
