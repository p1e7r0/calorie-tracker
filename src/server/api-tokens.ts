import "server-only";
import { eq } from "drizzle-orm";
import { database } from "@/db";
import { apiToken } from "@/db/schema";
import { generateApiToken, hashApiToken, parseBearerToken } from "@/lib/api-token";

export async function createApiToken(userId: string) {
  const token = generateApiToken();
  await database.transaction(async (transaction) => {
    await transaction.delete(apiToken).where(eq(apiToken.userId, userId));
    await transaction.insert(apiToken).values({ userId, tokenHash: hashApiToken(token) });
  });
  return token;
}

export async function deleteApiTokens(userId: string) {
  await database.delete(apiToken).where(eq(apiToken.userId, userId));
}

export async function getApiTokenInfo(userId: string) {
  const [row] = await database
    .select({ createdAt: apiToken.createdAt, lastUsedAt: apiToken.lastUsedAt })
    .from(apiToken)
    .where(eq(apiToken.userId, userId));
  return row ?? null;
}

export async function authenticateApiToken(authorization: string | null) {
  const token = parseBearerToken(authorization);
  if (!token) return null;
  const [row] = await database
    .update(apiToken)
    .set({ lastUsedAt: new Date() })
    .where(eq(apiToken.tokenHash, hashApiToken(token)))
    .returning({ userId: apiToken.userId });
  return row?.userId ?? null;
}
