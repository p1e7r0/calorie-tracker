"use client";

import { KeyRoundIcon, TrashIcon } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { createShortcutToken, revokeShortcutToken } from "@/app/actions/shortcut-token";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { CopyField } from "./copy-field";

const dateFormatter = new Intl.DateTimeFormat("it-IT", { day: "numeric", month: "long", year: "numeric" });

export function SiriShortcutSettings({
  endpointUrl,
  tokenCreatedAt,
  tokenLastUsedAt,
}: {
  endpointUrl: string;
  tokenCreatedAt: string | null;
  tokenLastUsedAt: string | null;
}) {
  const [token, setToken] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function createToken() {
    startTransition(async () => {
      const result = await createShortcutToken();
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setToken(result.data.token);
    });
  }

  function revokeToken() {
    startTransition(async () => {
      const result = await revokeShortcutToken();
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setToken(null);
      toast.success("Token revocato");
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-muted-foreground">
        Detta a Siri cosa hai mangiato: Bilancia lo interpreta e lo aggiunge al diario.
      </p>
      <CopyField label="URL" value={endpointUrl} />
      {token ? (
        <div className="flex flex-col gap-3 rounded-2xl bg-muted/60 p-3">
          <CopyField label="Token" value={token} />
          <p className="text-xs text-muted-foreground">
            Il token si vede solo adesso: copialo nel comando rapido prima di uscire da questa pagina.
          </p>
        </div>
      ) : null}
      <ol className="list-decimal space-y-1 pl-5 text-sm">
        <li>In Comandi rapidi crea un comando «Registra pasto» con l&apos;azione «Detta testo».</li>
        <li>
          Aggiungi «Ottieni contenuto dell&apos;URL»: metodo POST, intestazione Authorization con valore «Bearer » seguito
          dal token, corpo JSON con il campo text uguale al testo dettato.
        </li>
        <li>Aggiungi «Ottieni valore dizionario» per la chiave message e poi «Pronuncia testo».</li>
        <li>Per annullare l&apos;ultima registrazione crea un secondo comando con metodo DELETE sullo stesso URL.</li>
      </ol>
      <p className="text-sm text-muted-foreground">
        Il token permette solo di aggiungere pasti al diario e di annullare l&apos;ultimo aggiunto da Siri. Non condividere
        il comando: chi lo riceve avrebbe anche il token.
      </p>
      {tokenCreatedAt && !token ? (
        <p className="text-sm text-muted-foreground">
          Token creato il {dateFormatter.format(new Date(tokenCreatedAt))}
          {tokenLastUsedAt ? `, usato l'ultima volta il ${dateFormatter.format(new Date(tokenLastUsedAt))}` : ", mai usato"}.
        </p>
      ) : null}
      <div className="grid grid-cols-2 gap-2">
        <Button
          type="button"
          variant={tokenCreatedAt ? "outline" : "default"}
          className={tokenCreatedAt ? undefined : "col-span-2"}
          disabled={isPending}
          onClick={createToken}
        >
          {isPending ? <Spinner /> : <KeyRoundIcon />}
          {tokenCreatedAt ? "Rigenera" : "Crea token"}
        </Button>
        {tokenCreatedAt ? (
          <Button type="button" variant="outline" disabled={isPending} onClick={revokeToken}>
            <TrashIcon />
            Revoca
          </Button>
        ) : null}
      </div>
    </div>
  );
}
