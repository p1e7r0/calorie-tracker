import { expect, test } from "@playwright/test";
import { registerUser } from "./helpers";

test("redirects anonymous visitors to the login page", async ({ page }) => {
  await page.goto("/food");
  await expect(page).toHaveURL(/\/login\?next=%2Ffood/);
});

test("registers, signs out and signs back in", async ({ page }) => {
  const { email, password } = await registerUser(page);
  await page.getByRole("tab", { name: "Impostazioni" }).click();
  await expect(page.getByText(email)).toBeVisible();

  await page.getByRole("button", { name: "Esci" }).click();
  await expect(page).toHaveURL(/\/login/);

  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("password-sbagliata");
  await page.getByRole("button", { name: "Accedi" }).click();
  await expect(page.getByText("Email o password non corretti.")).toBeVisible();

  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Accedi" }).click();
  await expect(page).toHaveURL("/");
});
