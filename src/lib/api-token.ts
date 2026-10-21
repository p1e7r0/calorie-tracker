import { createHash, randomBytes } from "node:crypto";

export const apiTokenPrefix = "blc_";

const tokenPattern = /^blc_[A-Za-z0-9_-]{43}$/;

export function generateApiToken() {
  return `${apiTokenPrefix}${randomBytes(32).toString("base64url")}`;
}

export function hashApiToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function parseBearerToken(authorization: string | null) {
  const match = /^Bearer\s+(\S+)\s*$/i.exec(authorization ?? "");
  if (!match || !tokenPattern.test(match[1])) return null;
  return match[1];
}
