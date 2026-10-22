import { cimd } from "@better-auth/cimd";
import { fetchClientMetadataResource } from "@better-auth/cimd/node";
import { mcp } from "@better-auth/mcp";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { jwt } from "better-auth/plugins";
import { database } from "@/db";
import * as schema from "@/db/schema";
import { sendEmail } from "@/lib/email";
import { deleteApiTokens } from "@/server/api-tokens";
import { applicationUrl, mcpResourceUrl, vercelOrigins } from "./mcp-resource";

const googleClientId = process.env.GOOGLE_CLIENT_ID;
const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET;

const trustedOrigins = (process.env.BETTER_AUTH_TRUSTED_ORIGINS ?? "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean)
  .concat(vercelOrigins);

export const auth = betterAuth({
  baseURL: applicationUrl,
  database: drizzleAdapter(database, { provider: "pg", schema }),
  trustedOrigins,
  disabledPaths: ["/token"],
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
    autoSignIn: true,
    resetPasswordTokenExpiresIn: 60 * 60,
    revokeSessionsOnPasswordReset: true,
    onPasswordReset: async ({ user }) => {
      await deleteApiTokens(user.id);
    },
    sendResetPassword: async ({ user, url }) => {
      await sendEmail({
        to: user.email,
        subject: "Reimposta la password di Bilancia",
        text: `Ciao ${user.name},\n\nper scegliere una nuova password apri questo link entro un'ora:\n${url}\n\nSe non hai chiesto tu il cambio, ignora questa email: la password resta quella di prima.`,
        html: `<p>Ciao ${escapeHtml(user.name)},</p><p>per scegliere una nuova password apri questo link entro un'ora:</p><p><a href="${url}">Reimposta la password</a></p><p>Se non hai chiesto tu il cambio, ignora questa email: la password resta quella di prima.</p>`,
      });
    },
  },
  user: {
    deleteUser: { enabled: true },
  },
  socialProviders:
    googleClientId && googleClientSecret
      ? { google: { clientId: googleClientId, clientSecret: googleClientSecret } }
      : {},
  session: {
    expiresIn: 60 * 60 * 24 * 60,
    updateAge: 60 * 60 * 24,
    cookieCache: { enabled: true, maxAge: 5 * 60 },
  },
  plugins: [
    jwt(),
    mcp({
      loginPage: "/login",
      consentPage: "/consent",
      resource: mcpResourceUrl,
    }),
    cimd({
      fetchClientMetadataResource,
      metadataProfile: "mcp-2026-07-28",
    }),
    nextCookies(),
  ],
});

export type Session = typeof auth.$Infer.Session;

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => `&#${character.charCodeAt(0)};`);
}
