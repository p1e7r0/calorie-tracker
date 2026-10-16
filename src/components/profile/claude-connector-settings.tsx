"use client";

import { CopyIcon, KeyRoundIcon, UnplugIcon } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { createClaudeCredentials, disconnectClaude } from "@/app/actions/claude-connector";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";

const dateFormatter = new Intl.DateTimeFormat("it-IT", { day: "numeric", month: "long", year: "numeric" });

function CopyField({ label, value }: { label: string; value: string }) {
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

export function ClaudeConnectorSettings({
  serverUrl,
  credentialsCreatedAt,
}: {
  serverUrl: string;
  credentialsCreatedAt: string | null;
}) {
  const [credentials, setCredentials] = useState<{ clientId: string; clientSecret: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  function createCredentials() {
    startTransition(async () => {
      const result = await createClaudeCredentials();
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setCredentials(result.data);
    });
  }

  function disconnect() {
    startTransition(async () => {
      const result = await disconnectClaude();
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setCredentials(null);
      toast.success("Claude scollegato");
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-muted-foreground">
        Scrivi a Claude cosa hai mangiato: cerca gli alimenti e li aggiunge al diario.
      </p>
      <CopyField label="URL del server" value={serverUrl} />
      {credentials ? (
        <div className="flex flex-col gap-3 rounded-2xl bg-muted/60 p-3">
          <CopyField label="Client ID" value={credentials.clientId} />
          <CopyField label="Client Secret" value={credentials.clientSecret} />
          <p className="text-xs text-muted-foreground">
            Il Client Secret si vede solo adesso: incollalo su claude.ai prima di uscire da questa pagina.
          </p>
        </div>
      ) : null}
      <ol className="list-decimal space-y-1 pl-5 text-sm">
        <li>Su claude.ai apri Impostazioni › Connettori › Aggiungi connettore personalizzato.</li>
        <li>Incolla l&apos;URL del server e, nelle impostazioni avanzate, Client ID e Client Secret.</li>
        <li>Premi «Connetti», accedi a Bilancia e consenti l&apos;accesso.</li>
      </ol>
      {credentialsCreatedAt && !credentials ? (
        <p className="text-sm text-muted-foreground">
          Credenziali create il {dateFormatter.format(new Date(credentialsCreatedAt))}.
        </p>
      ) : null}
      <div className="grid grid-cols-2 gap-2">
        <Button
          type="button"
          variant={credentialsCreatedAt ? "outline" : "default"}
          className={credentialsCreatedAt ? undefined : "col-span-2"}
          disabled={isPending}
          onClick={createCredentials}
        >
          {isPending ? <Spinner /> : <KeyRoundIcon />}
          {credentialsCreatedAt ? "Rigenera" : "Crea credenziali"}
        </Button>
        {credentialsCreatedAt ? (
          <Button type="button" variant="outline" disabled={isPending} onClick={disconnect}>
            <UnplugIcon />
            Scollega
          </Button>
        ) : null}
      </div>
    </div>
  );
}
