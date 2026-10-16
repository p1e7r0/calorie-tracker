import type { Metadata } from "next";
import { Suspense } from "react";
import { ResetPasswordForm } from "@/components/authentication/reset-password-form";

export const metadata: Metadata = { title: "Nuova password" };

export default function ResetPasswordPage() {
  return (
    <>
      <h1 className="font-heading text-3xl font-semibold tracking-tight">Nuova password</h1>
      <p className="mt-1 mb-8 text-muted-foreground">Scegline una di almeno 8 caratteri.</p>
      <Suspense>
        <ResetPasswordForm />
      </Suspense>
    </>
  );
}
