import { expect, test } from "@playwright/test";
import pg from "pg";
import { registerUser } from "./helpers";

async function latestResetToken(email: string) {
  process.loadEnvFile(".env.local");
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL_UNPOOLED });
  await client.connect();
  try {
    const result = await client.query<{ identifier: string }>(
      `select verification.identifier from verification
       join "user" on "user".id = verification.value
       where "user".email = $1 and verification.identifier like 'reset-password:%'
       order by verification.created_at desc limit 1`,
      [email],
    );
    return result.rows[0]?.identifier.replace("reset-password:", "") ?? null;
  } finally {
    await client.end();
  }
}

test("resets a forgotten password with the emailed link", async ({ page }) => {
  const { email } = await registerUser(page);
  await page.getByRole("tab", { name: "Impostazioni" }).click();
  await page.getByRole("button", { name: "Esci" }).click();
  await expect(page).toHaveURL(/\/login/);

  await page.getByRole("link", { name: "Password dimenticata?" }).click();
  await expect(page).toHaveURL(/\/forgot-password$/);
  await page.waitForLoadState("networkidle");
  await page.getByLabel("Email").fill(email);
  await page.getByRole("button", { name: "Invia il link" }).click();
  await expect(page.getByText(/troverai un'email con il link/)).toBeVisible();

  const token = await latestResetToken(email);
  expect(token).toBeTruthy();
  await page.goto(`/api/auth/reset-password/${token}?callbackURL=${encodeURIComponent("/reset-password")}`);
  await expect(page).toHaveURL(/\/reset-password\?token=/);
  await page.waitForLoadState("networkidle");
  await page.getByLabel("Nuova password").fill("password-nuova");
  await page.getByLabel("Ripeti la password").fill("password-nuova");
  await page.getByRole("button", { name: "Salva la nuova password" }).click();
  await expect(page).toHaveURL(/\/login/);

  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill("password-nuova");
  await page.getByRole("button", { name: "Accedi" }).click();
  await expect(page).toHaveURL("/");
});

test("explains an invalid reset link", async ({ page }) => {
  await page.goto("/reset-password?error=INVALID_TOKEN");
  await expect(page.getByText("Il link non è valido o è scaduto.")).toBeVisible();
});
