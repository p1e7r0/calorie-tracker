"use client";

import { Trash2Icon } from "lucide-react";
import { useRouter } from "next/navigation";
import { type FormEvent, useState, useTransition } from "react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { authClient } from "@/lib/auth/client";

export function DeleteAccountButton() {
  const router = useRouter();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const password = String(new FormData(event.currentTarget).get("password") ?? "");
    setErrorMessage(null);
    startTransition(async () => {
      const result = await authClient.deleteUser({ password });
      if (result.error) {
        setErrorMessage(
          result.error.code === "INVALID_PASSWORD" ? "Password non corretta." : "Non è stato possibile eliminare l'account.",
        );
        return;
      }
      toast.success("Account eliminato");
      router.replace("/login");
      router.refresh();
    });
  }

  return (
    <AlertDialog onOpenChange={() => setErrorMessage(null)}>
      <AlertDialogTrigger render={<Button variant="destructive" className="w-full" />}>
        <Trash2Icon />
        Elimina l&apos;account
      </AlertDialogTrigger>
      <AlertDialogContent>
        <form onSubmit={handleSubmit} className="contents">
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminare l&apos;account?</AlertDialogTitle>
            <AlertDialogDescription>
              Cancello diario, misure, alimenti, ricette, pasti salvati e pasti pronti. Non si può annullare: se vuoi tenerli,
              scarica prima i CSV.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Field>
            <FieldLabel htmlFor="delete-account-password">Password per confermare</FieldLabel>
            <Input id="delete-account-password" name="password" type="password" autoComplete="current-password" required />
          </Field>
          {errorMessage ? <FieldError>{errorMessage}</FieldError> : null}
          <AlertDialogFooter>
            <AlertDialogCancel type="button">Annulla</AlertDialogCancel>
            <Button type="submit" variant="destructive" disabled={isPending}>
              Elimina definitivamente
            </Button>
          </AlertDialogFooter>
        </form>
      </AlertDialogContent>
    </AlertDialog>
  );
}
