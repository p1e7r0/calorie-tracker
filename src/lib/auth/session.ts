import "server-only";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "./server";

export type CurrentUser = {
  id: string;
  name: string;
  email: string;
};

export async function getCurrentUser(): Promise<CurrentUser> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    redirect("/login");
  }
  return { id: session.user.id, name: session.user.name, email: session.user.email };
}

export async function requireUserId(): Promise<string> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    throw new Error("Sessione scaduta. Accedi di nuovo.");
  }
  return session.user.id;
}
