import "server-only";
import { and, desc, eq } from "drizzle-orm";
import { database } from "@/db";
import { oauthClient } from "@/db/schema";
import { claudeClientName } from "@/lib/claude-connector";

export async function getOAuthClientName(clientId: string) {
  const [row] = await database
    .select({ name: oauthClient.name })
    .from(oauthClient)
    .where(eq(oauthClient.clientId, clientId));
  if (!row) return null;
  return row.name || "Un'applicazione";
}

function claudeClientCondition(userId: string) {
  return and(eq(oauthClient.userId, userId), eq(oauthClient.name, claudeClientName));
}

export async function getClaudeClientCreatedAt(userId: string) {
  const [row] = await database
    .select({ createdAt: oauthClient.createdAt })
    .from(oauthClient)
    .where(claudeClientCondition(userId))
    .orderBy(desc(oauthClient.createdAt))
    .limit(1);
  return row ? (row.createdAt ?? new Date(0)) : null;
}

export async function deleteClaudeClients(userId: string) {
  await database.delete(oauthClient).where(claudeClientCondition(userId));
}
