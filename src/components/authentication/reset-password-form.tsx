"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { type FormEvent, useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { authClient } from "@/lib/auth/client";

export function ResetPasswordForm() {
  const router = useRouter();
  const searchParameters = useSearchParams();
  const token = searchParameters.get("token");
  const linkError = searchParameters.get("error");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  if (!token || linkError) {
    return (
      <div className="flex flex-col gap-4">
        <p className="rounded-xl bg-muted/60 p-4 text-sm">
          Il link non è valido o è scaduto. Chiedine uno nuovo: vale un&apos;ora.
        </p>
        <Link href="/forgot-password" className="text-center text-sm font-medium underline underline-offset-4">
          Chiedi un nuovo link
        </Link>
      </div>
    );
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const password = String(formData.get("password") ?? "");
    const confirmation = String(formData.get("confirmation") ?? "");
    if (password !== confirmation) {
      setErrorMessage("Le due password non coincidono.");
      return;
    }
    setErrorMessage(null);
    startTransition(async () => {
      const result = await authClient.resetPassword({ newPassword: password, token: token ?? undefined });
      if (result.error) {
        setErrorMessage(
          result.error.code === "PASSWORD_TOO_SHORT"
            ? "La password deve avere almeno 8 caratteri."
            : "Il link non è valido o è scaduto. Chiedine uno nuovo.",
        );
        return;
      }
      toast.success("Password cambiata. Accedi con quella nuova.");
      router.replace("/login");
    });
  }

  return (
    <form onSubmit={handleSubmit}>
      <FieldGroup className="gap-4">
        <Field>
          <FieldLabel htmlFor="password">Nuova password</FieldLabel>
          <Input id="password" name="password" type="password" autoComplete="new-password" minLength={8} required />
        </Field>
        <Field>
          <FieldLabel htmlFor="confirmation">Ripeti la password</FieldLabel>
          <Input
            id="confirmation"
            name="confirmation"
            type="password"
            autoComplete="new-password"
            minLength={8}
            required
          />
        </Field>
        {errorMessage ? <FieldError>{errorMessage}</FieldError> : null}
        <Button type="submit" size="lg" disabled={isPending}>
          {isPending ? <Spinner /> : null}
          Salva la nuova password
        </Button>
      </FieldGroup>
    </form>
  );
}
