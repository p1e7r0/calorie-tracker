import { expect, test } from "@playwright/test";
import { isoDay, registerUser } from "./helpers";

test("marks a day as incomplete, undoes it and leaves it out of the averages", async ({ page }) => {
  test.setTimeout(90_000);
  await registerUser(page);
  await page.waitForLoadState("networkidle");
  await page.getByRole("button", { name: "Uomo" }).click();
  await page.getByLabel("Data di nascita").fill("1985-03-12");
  await page.getByLabel("Altezza (cm)").fill("180");
  await page.getByLabel("Peso attuale (kg)").fill("80");
  await page.getByRole("switch").click();
  await page.getByLabel("Kcal", { exact: true }).fill("2000");
  await page.getByLabel("Proteine g").fill("150");
  await page.getByLabel("Carbo g").fill("200");
  await page.getByLabel("Grassi g").fill("60");
  await page.getByRole("button", { name: "Salva obiettivo" }).click();
  await expect(page.getByText("Obiettivo salvato: 2000 kcal al giorno")).toBeVisible();

  const yesterday = isoDay(-1);
  await page.goto(`/add?date=${yesterday}&meal=lunch`);
  await page.waitForLoadState("networkidle");
  await page.getByRole("button", { name: "Kcal veloci" }).click();
  await page.getByLabel("Kcal", { exact: true }).fill("500");
  await page.getByRole("button", { name: "Aggiungi a pranzo" }).click();
  await expect(page.getByText("1 voce aggiunta")).toBeVisible();

  await page.goto(`/?date=${yesterday}`);
  await page.waitForLoadState("networkidle");
  const summary = page.getByRole("region", { name: "Riepilogo del giorno" });
  const toggle = page.getByRole("switch", { name: "Giorno incompleto" });
  await expect(toggle).not.toBeChecked();
  await expect(summary.getByText("Giorno incompleto")).toBeHidden();

  await toggle.click();
  await expect(page.getByText("Giorno segnato come incompleto").first()).toBeVisible();
  await expect(summary.getByText("Giorno incompleto")).toBeVisible();
  await expect(toggle).toBeChecked();

  await page
    .locator("[data-sonner-toast]")
    .filter({ hasText: "Giorno segnato come incompleto" })
    .getByRole("button", { name: "Annulla" })
    .click();
  await expect(summary.getByText("Giorno incompleto")).toBeHidden();
  await expect(toggle).not.toBeChecked();

  await toggle.click();
  await expect(summary.getByText("Giorno incompleto")).toBeVisible();

  const pastDaysThisWeek = (new Date().getDay() + 6) % 7;
  if (pastDaysThisWeek > 0) {
    await page.goto("/");
    const week = page.getByRole("group", { name: "Budget della settimana" });
    const remaining = 14000 - pastDaysThisWeek * 2000;
    await expect(week.getByText(`${new Intl.NumberFormat("it-IT").format(remaining)} kcal rimaste`)).toBeVisible();
    await expect(week.getByText("Il giorno incompleto conta come in linea con l'obiettivo.")).toBeVisible();
  }

  await page.goto("/progress");
  await page.getByRole("tab", { name: "Alimentazione" }).click();
  await expect(
    page.getByText(/^0 giorni registrati su 6, oggi escluso\. Un giorno incompleto non conta nelle medie/),
  ).toBeVisible();
  await expect(page.getByText("Registra qualche pasto per vedere le medie.")).toBeVisible();
});

test("deletes an account that has incomplete days", async ({ page }) => {
  const { email, password } = await registerUser(page);
  await page.goto("/");
  await page.waitForLoadState("networkidle");
  await page.getByRole("switch", { name: "Giorno incompleto" }).click();
  await expect(page.getByText("Giorno segnato come incompleto").first()).toBeVisible();

  await page.goto("/profile");
  await page.getByRole("tab", { name: "Impostazioni" }).click();
  await page.getByRole("button", { name: "Elimina l'account" }).click();
  const dialog = page.getByRole("alertdialog");
  await dialog.getByLabel("Password per confermare").fill(password);
  await dialog.getByRole("button", { name: "Elimina definitivamente" }).click();
  await expect(page).toHaveURL(/\/login/);

  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Accedi" }).click();
  await expect(page.getByText("Email o password non corretti.")).toBeVisible();
});
