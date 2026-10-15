import { expect, type Page, test } from "@playwright/test";
import { registerUser } from "./helpers";

async function addIngredient(page: Page, search: string, name: RegExp, grams: string) {
  await page.getByRole("button", { name: "Aggiungi ingrediente" }).click();
  await page.getByRole("searchbox", { name: "Cerca un ingrediente" }).fill(search);
  await page.getByRole("button", { name }).first().click();
  await page.getByLabel("Quantità a crudo").fill(grams);
  await page.getByRole("dialog").getByRole("button", { name: "Aggiungi ingrediente" }).click();
}

test("creates a recipe with cooked weight and logs a weighed portion", async ({ page }) => {
  await registerUser(page);
  await page.goto("/recipes/new");
  await page.getByLabel("Nome").fill("Pollo e albicocche");
  await addIngredient(page, "pollo petto senza pelle", /Pollo, petto senza pelle, crudo/, "400");
  await addIngredient(page, "albicocca cruda", /Albicocca, cruda/, "250");

  await page.getByLabel("Peso da cotto").fill("500");
  await page.getByRole("button", { name: "Una porzione in meno" }).click();
  await page.getByRole("button", { name: "Una porzione in meno" }).click();

  const summary = page.getByRole("region", { name: "Valori della ricetta" });
  await expect(summary.getByText("548")).toBeVisible();
  await expect(summary.getByText("274")).toBeVisible();
  await expect(summary.getByText("110")).toBeVisible();

  await page.getByRole("button", { name: "Crea ricetta" }).click();
  await expect(page).toHaveURL(/\/recipes\/[0-9a-f-]{36}$/);

  await page.getByRole("link", { name: "Aggiungi al diario" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "Grammi da cotto" }).click();
  await dialog.getByLabel("Quantità").fill("150");
  await expect(dialog.getByText(/^164\s*kcal$/)).toBeVisible();
});
