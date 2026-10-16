import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthenticationForm } from "@/components/authentication/authentication-form";
import { isGoogleSignInEnabled, isPasswordResetEnabled } from "@/lib/auth/providers";

export const metadata: Metadata = { title: "Accedi" };

export default function LoginPage() {
  return (
    <>
      <h1 className="font-heading text-3xl font-semibold tracking-tight">Accedi</h1>
      <p className="mt-1 mb-8 text-muted-foreground">Entra per vedere il tuo diario.</p>
      <Suspense>
        <AuthenticationForm mode="login" googleEnabled={isGoogleSignInEnabled} passwordResetEnabled={isPasswordResetEnabled} />
      </Suspense>
    </>
  );
}
