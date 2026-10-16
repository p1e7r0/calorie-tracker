import type { Metadata } from "next";
import { Suspense } from "react";
import { ConsentForm } from "@/components/authentication/consent-form";
import { getCurrentUser } from "@/lib/auth/session";
import { getOAuthClientName } from "@/server/oauth-clients";

export const metadata: Metadata = { title: "Autorizza l'accesso" };

export default function ConsentPage({ searchParams }: PageProps<"/consent">) {
  return (
    <Suspense>
      <Consent searchParams={searchParams} />
    </Suspense>
  );
}

async function Consent({ searchParams }: Pick<PageProps<"/consent">, "searchParams">) {
  const user = await getCurrentUser();
  const { client_id: clientId } = await searchParams;
  const clientName = typeof clientId === "string" ? await getOAuthClientName(clientId) : null;

  if (!clientName) {
    return (
      <>
        <h1 className="font-heading text-3xl font-semibold tracking-tight">Richiesta non valida</h1>
        <p className="mt-1 text-muted-foreground">Torna all&apos;applicazione e ricollega Bilancia.</p>
      </>
    );
  }

  return (
    <>
      <h1 className="font-heading text-3xl font-semibold tracking-tight">Collega {clientName}</h1>
      <p className="mt-1 mb-6 text-muted-foreground">
        «{clientName}» chiede di accedere al diario di {user.email}.
      </p>
      <ConsentForm clientName={clientName} />
    </>
  );
}
