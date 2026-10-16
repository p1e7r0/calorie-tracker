const applicationUrl = (process.env.BETTER_AUTH_URL ?? "http://localhost:3100").replace(/\/+$/, "");

export const mcpResourceUrl = `${applicationUrl}/api/mcp`;
