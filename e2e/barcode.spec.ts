import { expect, type Page, test } from "@playwright/test";
import { registerUser } from "./helpers";

function uniqueBarcode() {
  return `20${Date.now()}`.slice(0, 13);
}

async function typeBarcodeInScanner(page: Page, barcode: string) {
  await page.getByRole("button", { name: "Scansiona codice a barre" }).click();
  const scanner = page.getByRole("dialog");
  await scanner.getByRole("textbox", { name: "Codice a barre" }).fill(barcode);
  await scanner.getByRole("button", { name: "Cerca", exact: true }).click();
}

async function createFoodWithBarcode(page: Page, name: string, barcode: string) {
  await page.goto("/food/new");
  await page.waitForLoadState("networkidle");
  await page.getByLabel("Nome").fill(name);
  await page.getByLabel("Codice a barre", { exact: true }).fill(barcode);
  await page.getByLabel("Kcal", { exact: true }).fill("250");
  await page.getByRole("button", { name: "Crea alimento" }).click();
  await expect(page.getByRole("heading", { name })).toBeVisible();
}

test("opens a food of the catalog by scanning its barcode", async ({ page }) => {
  test.setTimeout(90_000);
  await registerUser(page);
  const name = `Cracker integrali ${Date.now()}`;
  const barcode = uniqueBarcode();
  await createFoodWithBarcode(page, name, barcode);

  await page.goto("/food");
  await page.waitForLoadState("networkidle");
  await typeBarcodeInScanner(page, barcode);
  await expect(page.getByRole("heading", { name })).toBeVisible();
});

test("scanning a barcode already in the catalog from the new food form opens that food", async ({ page }) => {
  test.setTimeout(90_000);
  await registerUser(page);
  const name = `Grissini ${Date.now()}`;
  const barcode = uniqueBarcode();
  await createFoodWithBarcode(page, name, barcode);

  await page.goto("/food/new");
  await page.waitForLoadState("networkidle");
  await typeBarcodeInScanner(page, barcode);
  await expect(page.locator("[data-sonner-toast]").filter({ hasText: `«${name}» è già nel catalogo.` })).toBeVisible();
  await expect(page.getByRole("heading", { name })).toBeVisible();
});

test("rejects a barcode with too few digits", async ({ page }) => {
  await registerUser(page);
  await page.goto("/food/new");
  await page.waitForLoadState("networkidle");
  await page.getByLabel("Nome").fill("Biscotti");
  await page.getByLabel("Codice a barre", { exact: true }).fill("123");
  await page.getByLabel("Kcal", { exact: true }).fill("450");
  await page.getByRole("button", { name: "Crea alimento" }).click();
  await expect(page.getByText("Il codice a barre deve avere da 6 a 14 cifre.")).toBeVisible();
});
