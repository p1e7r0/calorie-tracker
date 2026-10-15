import { expect, test } from "@playwright/test";
import { registerUser } from "./helpers";

test("creates a food from an empty search and logs it right away", async ({ page }) => {
  await registerUser(page);
  await page.goto("/add?meal=breakfast");
  const name = `Granola artigianale ${Date.now()}`;
  await page.getByRole("searchbox").fill(name);
  await page.getByRole("link", { name: `Crea «${name}»` }).click();

  await expect(page.getByLabel("Nome")).toHaveValue(name);
  await page.getByLabel("Proteine").fill("10");
  await page.getByLabel("Carboidrati").fill("60");
  await page.getByLabel("Grassi").fill("20");
  await expect(page.getByText("Se la lasci vuota uso 460 kcal")).toBeVisible();
  await page.getByRole("button", { name: "Aggiungi porzione" }).click();
  await page.getByLabel("Nome della porzione").fill("1 ciotola");
  await page.getByLabel("Grammi della porzione 1").fill("40");
  await page.getByRole("button", { name: "Crea e aggiungi" }).click();

  const dialog = page.getByRole("dialog");
  await expect(dialog.getByText(name)).toBeVisible();
  await dialog.getByRole("button", { name: /^1 ciotola/ }).click();
  await expect(dialog.getByText(/^184\s*kcal$/)).toBeVisible();
  await dialog.getByRole("button", { name: "Aggiungi a colazione" }).click();
  await page.getByRole("button", { name: "Fatto" }).click();
  await expect(page.getByRole("region", { name: "Colazione" }).getByText("1 ciotola (40 g)")).toBeVisible();
});

test("editing a shared food creates a personal copy", async ({ page }) => {
  await registerUser(page);
  await page.goto("/food");
  await page.getByRole("searchbox", { name: "Cerca nel catalogo" }).fill("albicocca cruda");
  await page.getByRole("link", { name: /Albicocca, cruda/ }).first().click();
  await expect(page.getByRole("heading", { name: "Albicocca, cruda" })).toBeVisible();
  await expect(async () => {
    await page.getByRole("button", { name: "Aggiungi ai preferiti" }).click({ timeout: 1000 });
    await expect(page.getByRole("button", { name: "Togli dai preferiti" })).toBeVisible({ timeout: 1000 });
  }).toPass({ timeout: 10_000 });

  await page.getByRole("link", { name: "Modifica" }).click();
  await expect(page.getByText("Le modifiche creano una tua copia personale")).toBeVisible();
  await page.getByLabel("Kcal").fill("50");
  await page.getByRole("button", { name: "Salva la mia copia" }).click();
  await expect(page.getByText("Creato da te")).toBeVisible();
  await expect(page.getByText("50", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Togli dai preferiti" })).toBeVisible();
});
