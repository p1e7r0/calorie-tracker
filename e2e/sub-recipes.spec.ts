import { expect, type Page, test } from "@playwright/test";
import { registerUser } from "./helpers";

async function createFood(page: Page, name: string, kcal: string) {
  await page.goto("/food/new");
  await page.waitForLoadState("networkidle");
  await page.getByLabel("Nome").fill(name);
  await page.getByLabel("Kcal", { exact: true }).fill(kcal);
  await page.getByRole("button", { name: "Crea alimento" }).click();
  await expect(page.getByRole("heading", { name })).toBeVisible();
}

async function pickIngredient(page: Page, search: string, name: RegExp) {
  await page.getByRole("button", { name: "Aggiungi ingrediente" }).click();
  await page.getByRole("searchbox", { name: "Cerca un ingrediente" }).fill(search);
  await page.getByRole("dialog").getByRole("button", { name }).first().click();
}

test("uses a recipe as an ingredient of another recipe and blocks cycles", async ({ page }) => {
  test.setTimeout(120_000);
  await registerUser(page);
  await createFood(page, "Pomodoro di prova", "20");
  await createFood(page, "Pasta di prova", "350");

  await page.goto("/recipes/new");
  await page.waitForLoadState("networkidle");
  await page.getByLabel("Nome").fill("Sugo di prova");
  await pickIngredient(page, "pomodoro di prova", /^Pomodoro di prova/);
  await page.getByLabel("Quantità a crudo").fill("1000");
  await page.getByRole("dialog").getByRole("button", { name: "Aggiungi ingrediente" }).click();
  await page.getByLabel("Peso da cotto").fill("500");
  await page.getByRole("button", { name: "Crea ricetta" }).click();
  await expect(page).toHaveURL(/\/recipes\/[0-9a-f-]{36}$/);
  const sauceUrl = page.url();

  await page.goto("/recipes/new");
  await page.waitForLoadState("networkidle");
  await page.getByLabel("Nome").fill("Pasta al sugo di prova");
  await pickIngredient(page, "pasta di prova", /^Pasta di prova/);
  await page.getByLabel("Quantità a crudo").fill("200");
  await page.getByRole("dialog").getByRole("button", { name: "Aggiungi ingrediente" }).click();
  await pickIngredient(page, "sugo di prova", /Sugo di prova.*Ricetta, 40 kcal per 100 g/);
  await expect(page.getByText("Quantità da cotto")).toBeVisible();
  await page.getByLabel("Quantità da cotto").fill("100");
  await expect(page.getByRole("dialog").getByText(/^40\s*kcal$/)).toBeVisible();
  await page.getByRole("dialog").getByRole("button", { name: "Aggiungi ingrediente" }).click();
  await expect(page.getByText("40 kcal, da cotto")).toBeVisible();
  await page.getByRole("button", { name: "Una porzione in meno" }).click();
  await page.getByRole("button", { name: "Una porzione in meno" }).click();
  const summary = page.getByRole("region", { name: "Valori della ricetta" });
  await expect(summary.getByText("740")).toBeVisible();
  await expect(summary.getByText("370")).toBeVisible();
  await page.getByRole("button", { name: "Crea ricetta" }).click();
  await expect(page).toHaveURL(/\/recipes\/[0-9a-f-]{36}$/);
  const dishUrl = page.url();
  await expect(page.getByRole("region", { name: "Valori a porzione" })).toContainText("370");

  await page.getByRole("link", { name: "Sugo di prova" }).click();
  await expect(page).toHaveURL(sauceUrl);
  await expect(page.getByRole("heading", { name: "Sugo di prova" })).toBeVisible();

  await page.getByRole("link", { name: "Modifica" }).click();
  await page.waitForLoadState("networkidle");
  await page.getByRole("button", { name: "Aggiungi ingrediente" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("searchbox", { name: "Cerca un ingrediente" }).fill("sugo di prova");
  await expect(dialog.getByRole("button", { name: /Pasta al sugo di prova/ })).toBeVisible();
  await expect(dialog.getByRole("button", { name: /^Ricetta Sugo di prova/ })).toHaveCount(0);
  await dialog.getByRole("button", { name: /Pasta al sugo di prova/ }).click();
  await dialog.getByRole("button", { name: "Aggiungi ingrediente" }).click();
  await page.getByRole("button", { name: "Salva ricetta" }).click();
  await expect(page.getByText("Una delle ricette usate come ingrediente contiene già questa ricetta.")).toBeVisible();

  await page.goto(dishUrl);
  await page.getByRole("link", { name: "Aggiungi al diario" }).click();
  const logDialog = page.getByRole("dialog");
  await expect(logDialog.getByText(/^370\s*kcal$/)).toBeVisible();
  await logDialog.getByRole("button", { name: /^Aggiungi a / }).click();
  await expect(page.getByText("1 voce aggiunta")).toBeVisible();
});
