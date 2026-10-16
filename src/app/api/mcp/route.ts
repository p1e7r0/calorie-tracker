import { requireMcpAuth } from "@better-auth/mcp";
import { createMcpHandler } from "@modelcontextprotocol/server";
import { auth } from "@/lib/auth/server";
import { mcpResourceUrl } from "@/lib/auth/mcp-resource";
import { createClaudeConnectorServer } from "@/server/claude-connector";

const mcpHandler = createMcpHandler(({ authInfo }) => {
  const userId = authInfo?.extra?.userId;
  if (typeof userId !== "string") throw new Error("Missing user");
  return createClaudeConnectorServer(userId);
});

const handler = requireMcpAuth(
  auth,
  (request, claims) => {
    if (!claims.sub) return Response.json({ error: "Non autenticato" }, { status: 401 });
    const clientId = typeof claims.azp === "string" ? claims.azp : "";
    const scopes = typeof claims.scope === "string" ? claims.scope.split(" ") : [];
    return mcpHandler.fetch(request, {
      authInfo: { token: "", clientId, scopes, expiresAt: claims.exp, extra: { userId: claims.sub } },
    });
  },
  { resource: mcpResourceUrl, challengeScopes: ["offline_access"] },
);

export { handler as DELETE, handler as GET, handler as POST };
