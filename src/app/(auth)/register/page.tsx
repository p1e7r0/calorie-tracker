import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthenticationForm } from "@/components/authentication/authentication-form";
import { isGoogleSignInEnabled } from "@/lib/auth/providers";

export const metadata: Metadata = { title: "Registrati" };

export default function RegisterPage() {
  return (
    <>
      <h1 className="font-heading text-3xl font-semibold tracking-tight">Crea il tuo account</h1>
      <p className="mt-1 mb-8 text-muted-foreground">Ti servono solo email e password.</p>
      <Suspense>
        <AuthenticationForm mode="register" googleEnabled={isGoogleSignInEnabled} />
      </Suspense>
    </>
  );
}
