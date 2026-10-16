"use client";

import { MailCheckIcon } from "lucide-react";
import Link from "next/link";
import { type FormEvent, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { authClient } from "@/lib/auth/client";

export function ForgotPasswordForm() {
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const email = String(new FormData(event.currentTarget).get("email") ?? "").trim();
    setErrorMessage(null);
    startTransition(async () => {
      const result = await authClient.requestPasswordReset({ email, redirectTo: "/reset-password" });
      if (result.error) {
        setErrorMessage("Non è stato possibile inviare l'email. Riprova tra poco.");
        return;
      }
      setSentTo(email);
    });
  }

  if (sentTo) {
    return (
      <div className="flex flex-col gap-4">
        <p className="flex items-start gap-3 rounded-xl bg-muted/60 p-4 text-sm">
          <MailCheckIcon className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
          <span>
            Se esiste un account per <span className="font-medium">{sentTo}</span>, troverai un&apos;email con il link.
            Vale per un&apos;ora; controlla anche lo spam.
          </span>
        </p>
        <Link href="/login" className="text-center text-sm font-medium underline underline-offset-4">
          Torna all&apos;accesso
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit}>
      <FieldGroup className="gap-4">
        <Field>
          <FieldLabel htmlFor="email">Email</FieldLabel>
          <Input id="email" name="email" type="email" inputMode="email" autoComplete="email" required />
        </Field>
        {errorMessage ? <FieldError>{errorMessage}</FieldError> : null}
        <Button type="submit" size="lg" disabled={isPending}>
          {isPending ? <Spinner /> : null}
          Invia il link
        </Button>
        <Link href="/login" className="text-center text-sm text-muted-foreground underline underline-offset-4">
          Torna all&apos;accesso
        </Link>
      </FieldGroup>
    </form>
  );
}
