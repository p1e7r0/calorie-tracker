import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ForgotPasswordForm } from "@/components/authentication/forgot-password-form";
import { isPasswordResetEnabled } from "@/lib/auth/providers";

export const metadata: Metadata = { title: "Password dimenticata" };

export default function ForgotPasswordPage() {
  if (!isPasswordResetEnabled) notFound();
  return (
    <>
      <h1 className="font-heading text-3xl font-semibold tracking-tight">Password dimenticata</h1>
      <p className="mt-1 mb-8 text-muted-foreground">Ti mando un link per sceglierne una nuova.</p>
      <ForgotPasswordForm />
    </>
  );
}
