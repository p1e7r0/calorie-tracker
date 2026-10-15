"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { type FormEvent, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldGroup, FieldLabel, FieldSeparator } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { authClient } from "@/lib/auth/client";

type AuthenticationMode = "login" | "register";

const errorMessages: Record<string, string> = {
  INVALID_EMAIL_OR_PASSWORD: "Email o password non corretti.",
  USER_ALREADY_EXISTS: "Esiste già un account con questa email. Accedi.",
  USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL: "Esiste già un account con questa email. Accedi.",
  PASSWORD_TOO_SHORT: "La password deve avere almeno 8 caratteri.",
  INVALID_EMAIL: "Controlla l'indirizzo email.",
};

function describeError(error: { code?: string; message?: string }) {
  return (error.code && errorMessages[error.code]) ?? "Non è stato possibile completare l'accesso. Riprova.";
}

function safeRedirectTarget(value: string | null) {
  if (value && value.startsWith("/") && !value.startsWith("//")) return value;
  return "/";
}

export function AuthenticationForm({
  mode,
  googleEnabled,
}: {
  mode: AuthenticationMode;
  googleEnabled: boolean;
}) {
  const router = useRouter();
  const searchParameters = useSearchParams();
  const redirectTarget = safeRedirectTarget(searchParameters.get("next"));
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const email = String(formData.get("email") ?? "").trim();
    const password = String(formData.get("password") ?? "");
    const name = String(formData.get("name") ?? "").trim();

    setErrorMessage(null);
    startTransition(async () => {
      const result =
        mode === "register"
          ? await authClient.signUp.email({ email, password, name: name || email.split("@")[0] })
          : await authClient.signIn.email({ email, password });

      if (result.error) {
        setErrorMessage(describeError(result.error));
        return;
      }
      router.replace(mode === "register" ? "/profile?setup=1" : redirectTarget);
      router.refresh();
    });
  }

  function handleGoogleSignIn() {
    setErrorMessage(null);
    startTransition(async () => {
      const result = await authClient.signIn.social({
        provider: "google",
        callbackURL: redirectTarget,
      });
      if (result.error) setErrorMessage(describeError(result.error));
    });
  }

  return (
    <form onSubmit={handleSubmit}>
      <FieldGroup className="gap-4">
        {mode === "register" ? (
          <Field>
            <FieldLabel htmlFor="name">Nome</FieldLabel>
            <Input id="name" name="name" autoComplete="given-name" placeholder="Come ti chiami?" />
          </Field>
        ) : null}
        <Field>
          <FieldLabel htmlFor="email">Email</FieldLabel>
          <Input
            id="email"
            name="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            required
            aria-invalid={errorMessage ? true : undefined}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="password">Password</FieldLabel>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete={mode === "register" ? "new-password" : "current-password"}
            minLength={8}
            required
            aria-invalid={errorMessage ? true : undefined}
          />
        </Field>
        {errorMessage ? <FieldError>{errorMessage}</FieldError> : null}
        <Button type="submit" size="lg" disabled={isPending}>
          {isPending ? <Spinner /> : null}
          {mode === "register" ? "Crea account" : "Accedi"}
        </Button>
        {googleEnabled ? (
          <>
            <FieldSeparator>oppure</FieldSeparator>
            <Button
              type="button"
              variant="outline"
              size="lg"
              disabled={isPending}
              onClick={handleGoogleSignIn}
            >
              Continua con Google
            </Button>
          </>
        ) : null}
        <p className="text-center text-sm text-muted-foreground">
          {mode === "register" ? (
            <>
              Hai già un account?{" "}
              <Link href="/login" className="font-medium text-foreground underline underline-offset-4">
                Accedi
              </Link>
            </>
          ) : (
            <>
              Non hai un account?{" "}
              <Link href="/register" className="font-medium text-foreground underline underline-offset-4">
                Registrati
              </Link>
            </>
          )}
        </p>
      </FieldGroup>
    </form>
  );
}
