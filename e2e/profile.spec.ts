import { expect, test } from "@playwright/test";
import { registerUser } from "./helpers";

test("computes the daily target and shows it in today's summary", async ({ page }) => {
  await registerUser(page);
  await expect(page.getByText("Inserisci i tuoi dati")).toBeVisible();
  await page.getByRole("button", { name: "Donna" }).click();
  await page.getByLabel("Data di nascita").fill("1990-05-10");
  await page.getByLabel("Altezza (cm)").fill("165");
  await page.getByLabel("Peso attuale (kg)").fill("60");
  await page.getByLabel("Attività").selectOption("moderate");

  const target = page.getByRole("region", { name: "Obiettivo giornaliero" });
  await expect(target.getByText("2000 kcal", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Dimagrire" }).click();
  await expect(target.getByText("1450 kcal", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Salva obiettivo" }).click();
  await expect(page.getByText("Obiettivo salvato: 1450 kcal al giorno")).toBeVisible();

  await page.getByRole("navigation", { name: "Navigazione principale" }).getByRole("link", { name: "Oggi" }).click();
  const summary = page.getByRole("region", { name: "Riepilogo del giorno" });
  await expect(summary.getByText("Restano")).toBeVisible();
  await expect(summary.getByText("1450").first()).toBeVisible();
});
