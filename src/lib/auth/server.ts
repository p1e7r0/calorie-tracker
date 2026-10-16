import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { database } from "@/db";
import * as schema from "@/db/schema";
import { sendEmail } from "@/lib/email";

const googleClientId = process.env.GOOGLE_CLIENT_ID;
const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET;

const trustedOrigins = (process.env.BETTER_AUTH_TRUSTED_ORIGINS ?? "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

export const auth = betterAuth({
  database: drizzleAdapter(database, { provider: "pg", schema }),
  trustedOrigins,
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
    autoSignIn: true,
    resetPasswordTokenExpiresIn: 60 * 60,
    revokeSessionsOnPasswordReset: true,
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
  plugins: [nextCookies()],
});

export type Session = typeof auth.$Infer.Session;

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => `&#${character.charCodeAt(0)};`);
}
