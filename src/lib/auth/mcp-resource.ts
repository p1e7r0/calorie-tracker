const vercelUrls = [process.env.VERCEL_BRANCH_URL, process.env.VERCEL_URL]
  .filter((host): host is string => Boolean(host))
  .map((host) => `https://${host}`);

export const applicationUrl = (process.env.BETTER_AUTH_URL ?? vercelUrls[0] ?? "http://localhost:3100").replace(/\/+$/, "");

export const vercelOrigins = vercelUrls;

export const mcpResourceUrl = `${applicationUrl}/api/mcp`;
