import { readFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";
import { registerUser } from "./helpers";

test("downloads the diary as CSV", async ({ page }) => {
  await registerUser(page);
  await page.goto("/add?meal=snack");
  await page.getByRole("button", { name: "Kcal veloci" }).click();
  await page.getByLabel("Kcal", { exact: true }).fill("320");
  await page.getByLabel("Descrizione").fill("Gelato; cono");
  await page.getByRole("button", { name: "Aggiungi a spuntini" }).click();
  await page.getByRole("button", { name: "Fatto" }).click();

  await page.goto("/profile");
  await page.getByRole("tab", { name: "Impostazioni" }).click();
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("link", { name: "Diario" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("bilancia-diario.csv");
  const content = await readFile((await download.path())!, "utf8");
  expect(content).toContain("Giorno;Pasto;Voce;Grammi;Porzioni;Kcal");
  expect(content).toContain(';Spuntini;"Gelato; cono";;;320;');
});

test("deletes the account after confirming the password", async ({ page }) => {
  const { email, password } = await registerUser(page);
  await page.getByRole("tab", { name: "Impostazioni" }).click();
  await page.getByRole("button", { name: "Elimina l'account" }).click();
  const dialog = page.getByRole("alertdialog");
  await dialog.getByLabel("Password per confermare").fill("password-sbagliata");
  await dialog.getByRole("button", { name: "Elimina definitivamente" }).click();
  await expect(dialog.getByText("Password non corretta.")).toBeVisible();
  await dialog.getByLabel("Password per confermare").fill(password);
  await dialog.getByRole("button", { name: "Elimina definitivamente" }).click();
  await expect(page).toHaveURL(/\/login/);

  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Accedi" }).click();
  await expect(page.getByText("Email o password non corretti.")).toBeVisible();
});
