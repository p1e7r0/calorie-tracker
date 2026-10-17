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
  await dialog.getByRole("button", { name: /^Aggiungi a / }).click();
  await expect(page.getByText("1 voce aggiunta")).toBeVisible();

  await page.getByRole("tab", { name: "Suggeriti" }).click();
  await expect(page.getByText("Ultima volta 150 g, 164 kcal")).toBeVisible();
  await page.getByRole("button", { name: "Aggiungi 150 g di Pollo e albicocche" }).click();
  await expect(page.getByText("2 voci aggiunte")).toBeVisible();
});

test("shows a recipe read-only, scales the ingredients, edits and duplicates it", async ({ page }) => {
  test.setTimeout(60_000);
  await registerUser(page);
  await page.goto("/recipes/new");
  await page.getByLabel("Nome").fill("Riso e pollo");
  await addIngredient(page, "riso raffinato secco", /Riso raffinato, secco/, "200");
  await addIngredient(page, "pollo petto senza pelle", /Pollo, petto senza pelle, crudo/, "300");
  await page.getByRole("button", { name: "Una porzione in meno" }).click();
  await page.getByRole("button", { name: "Una porzione in meno" }).click();
  await page.getByRole("button", { name: "Crea ricetta" }).click();
  await expect(page).toHaveURL(/\/recipes\/[0-9a-f-]{36}$/);

  await expect(page.getByRole("heading", { name: "Riso e pollo" })).toBeVisible();
  const ingredients = page.getByRole("region", { name: "Ingredienti" }).or(page.locator("section").filter({ hasText: "Ingredienti" }));
  await expect(ingredients.getByText("200 g").first()).toBeVisible();
  await page.getByRole("button", { name: "Una porzione in più" }).click();
  await page.getByRole("button", { name: "Una porzione in più" }).click();
  await expect(page.getByText("per 4 porzioni")).toBeVisible();
  await expect(ingredients.getByText("400 g").first()).toBeVisible();

  await page.getByRole("link", { name: "Modifica" }).click();
  await expect(page.getByRole("heading", { name: "Modifica ricetta" })).toBeVisible();
  await expect(page.getByLabel("Nome")).toBeEditable();
  await page.getByLabel("Nome").fill("Riso e pollo light");
  await page.getByRole("button", { name: "Salva ricetta" }).click();
  await expect(page).toHaveURL(/\/recipes\/[0-9a-f-]{36}$/);
  await expect(page.getByRole("heading", { name: "Riso e pollo light" })).toBeVisible();

  await page.getByRole("button", { name: "Duplica ricetta" }).click();
  await expect(page).toHaveURL(/\/edit$/);
  await expect(page.getByLabel("Nome")).toHaveValue("Riso e pollo light (copia)");
});
