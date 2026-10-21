import { expect, test } from "@playwright/test";
import { registerUser } from "./helpers";

test.describe("Open Food Facts", () => {
  test.slow();

  test("imports a product by barcode typed in the scanner", async ({ page }) => {
    await registerUser(page);
    await page.goto("/add?meal=snack");
    await page.getByRole("button", { name: "Scansiona codice a barre" }).click();
    await page.getByRole("textbox", { name: "Codice a barre" }).fill("8000500310427");
    await page.getByRole("button", { name: "Cerca", exact: true }).click();

    const dialog = page.getByRole("dialog");
    await expect(dialog.getByText("515 kcal per 100 g")).toBeVisible({ timeout: 20_000 });
    await expect(dialog.getByRole("button", { name: /^1 porzione/ })).toBeVisible();
  });

  test("scanning an unknown barcode from the catalog opens the new food form", async ({ page }) => {
    await registerUser(page);
    await page.goto("/food");
    await page.waitForLoadState("networkidle");
    const barcode = `200${Date.now()}`.slice(0, 13);
    await page.getByRole("button", { name: "Scansiona codice a barre" }).click();
    await page.getByRole("textbox", { name: "Codice a barre" }).fill(barcode);
    await page.getByRole("button", { name: "Cerca", exact: true }).click();

    await expect(page).toHaveURL(/\/food\/new\?barcode=/, { timeout: 20_000 });
    await expect(page.getByLabel("Codice a barre", { exact: true })).toHaveValue(barcode);
  });

  test("searches Open Food Facts on demand when the catalog has enough results", async ({ page }) => {
    await registerUser(page);
    await page.goto("/add?meal=snack");
    await page.getByRole("searchbox").fill("mela");
    await expect(page.getByRole("button", { name: "Cerca «mela» su Open Food Facts" })).toBeVisible();
    await page.waitForTimeout(1500);
    await expect(page.getByRole("region", { name: "Risultati da Open Food Facts" })).toHaveCount(0);
  });

  test("searches Open Food Facts automatically and imports a result", async ({ page }) => {
    await registerUser(page);
    await page.goto("/add?meal=snack");
    await page.getByRole("searchbox").fill("pan di stelle");
    const results = page.getByRole("region", { name: "Risultati da Open Food Facts" });
    await results.getByRole("button").first().click({ timeout: 20_000 });
    await expect(page.getByRole("button", { name: "Aggiungi a spuntini" })).toBeVisible({ timeout: 20_000 });
  });
});
