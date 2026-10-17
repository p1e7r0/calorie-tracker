import { expect, test } from "@playwright/test";
import { isoDay, registerUser } from "./helpers";

test("estimates maintenance from logged kcal and weight and applies it as the goal", async ({ page }) => {
  test.setTimeout(120_000);
  await registerUser(page);
  await page.getByRole("button", { name: "Uomo" }).click();
  await page.getByLabel("Data di nascita").fill("1985-03-12");
  await page.getByLabel("Altezza (cm)").fill("180");
  await page.getByLabel("Peso attuale (kg)").fill("85");
  await page.getByRole("button", { name: "Mantenere" }).click();
  await page.getByRole("button", { name: /^Salva/ }).click();
  await expect(page.getByText("Giorni registrati nelle ultime 4 settimane")).toBeVisible();

  for (let offset = -15; offset <= -1; offset += 1) {
    await page.goto(`/add?date=${isoDay(offset)}&meal=lunch`);
    await page.getByRole("button", { name: "Kcal veloci" }).click();
    await page.getByLabel("Kcal", { exact: true }).fill("2000");
    await page.getByRole("button", { name: "Aggiungi a pranzo" }).click();
    await expect(page.getByText("1 voce aggiunta")).toBeVisible();
  }

  await page.goto("/progress");
  for (const [offset, weight] of [[-15, "86"], [-1, "85"]] as const) {
    await page.getByRole("button", { name: "Misura" }).click();
    await page.getByLabel("Data").fill(isoDay(offset));
    await page.getByLabel("Peso (kg)").fill(weight);
    await page.getByRole("button", { name: "Salva" }).click();
    await expect(page.getByRole("dialog")).toBeHidden();
  }

  await page.goto("/");
  const summary = page.getByRole("region", { name: "Riepilogo del giorno" });
  const summaryBefore = (await summary.textContent()) ?? "";
  const checkIn = page.getByRole("region", { name: "Il punto della settimana" });
  await expect(checkIn.getByText(/^La settimana scorsa: in media 2000 kcal/)).toBeVisible();
  await checkIn.getByRole("button", { name: "Aggiorna obiettivo" }).click();
  await expect(checkIn).toBeHidden();
  await page
    .locator("[data-sonner-toast]")
    .filter({ hasText: "Nuovo obiettivo" })
    .getByRole("button", { name: "Annulla" })
    .click();
  await expect(summary).toHaveText(summaryBefore);

  await page.goto("/progress");
  await page.getByRole("tab", { name: "Alimentazione" }).click();
  await expect(page.getByRole("heading", { name: "Fabbisogno stimato, settimana per settimana" })).toBeVisible();

  await page.goto("/profile");
  const card = page.getByRole("region", { name: "Fabbisogno dai tuoi dati" });
  await expect(card.getByText(/^25[0-9]0kcal al giorno$/)).toBeVisible();
  await card.getByRole("button", { name: /^Usa 25[0-9]0 kcal come obiettivo$/ }).click();
  await expect(card.getByText("Il tuo obiettivo è già allineato.")).toBeVisible();
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Il punto della settimana" })).toBeHidden();
});
