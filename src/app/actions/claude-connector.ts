"use server";

import { refresh } from "next/cache";
import { headers } from "next/headers";
import { auth } from "@/lib/auth/server";
import { mcpResourceUrl } from "@/lib/auth/mcp-resource";
import { requireUserId } from "@/lib/auth/session";
import { claudeClientName, claudeRedirectUri } from "@/lib/claude-connector";
import { deleteClaudeClients } from "@/server/oauth-clients";
import type { ActionResult } from "./diary";

function failure(error: unknown): { ok: false; error: string } {
  if (error instanceof Error && error.message.startsWith("Sessione")) return { ok: false, error: error.message };
  console.error(error);
  return { ok: false, error: "Non è stato possibile creare le credenziali. Riprova." };
}

export async function createClaudeCredentials(): Promise<ActionResult<{ clientId: string; clientSecret: string }>> {
  try {
    const userId = await requireUserId();
    await deleteClaudeClients(userId);
    const client = await auth.api.adminCreateOAuthClient({
      headers: await headers(),
      body: {
        client_name: claudeClientName,
        redirect_uris: [claudeRedirectUri],
        grant_types: ["authorization_code", "refresh_token"],
        response_types: ["code"],
        token_endpoint_auth_method: "client_secret_basic",
        scope: "openid offline_access",
        resources: [mcpResourceUrl],
      },
    });
    if (!client.client_secret) throw new Error("Missing client secret");
    refresh();
    return { ok: true, data: { clientId: client.client_id, clientSecret: client.client_secret } };
  } catch (error) {
    return failure(error);
  }
}

export async function disconnectClaude(): Promise<ActionResult> {
  try {
    const userId = await requireUserId();
    await deleteClaudeClients(userId);
    refresh();
    return { ok: true, data: undefined };
  } catch (error) {
    return failure(error);
  }
}
