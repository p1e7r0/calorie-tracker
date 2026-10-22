import { expect, test } from "@playwright/test";
import { registerUser } from "./helpers";

test("saves cookware and subtracts it from the weighed recipe", async ({ page }) => {
  test.setTimeout(90_000);
  await registerUser(page);
  const ingredientName = `Pasta pentola ${Date.now()}`;
  await page.goto(`/food/new?name=${encodeURIComponent(ingredientName)}`);
  await page.waitForLoadState("networkidle");
  await page.getByLabel("Kcal", { exact: true }).fill("350");
  await page.getByRole("button", { name: "Crea alimento" }).click();
  await page.waitForURL(/\/food\/[0-9a-f-]{36}$/);

  await page.goto("/profile");
  await page.getByRole("tab", { name: "Impostazioni" }).click();
  await page.getByRole("button", { name: "Aggiungi pentola" }).click();
  const drawer = page.getByRole("dialog");
  await drawer.getByLabel("Nome").fill("Padella grande");
  await drawer.getByLabel("Peso vuota").fill("1.250");
  await drawer.getByRole("button", { name: "Salva pentola" }).click();
  await expect(page.getByRole("button", { name: "Modifica Padella grande" })).toContainText("1250 g");

  await page.goto("/recipes/new");
  await page.waitForLoadState("networkidle");
  await page.getByLabel("Nome").fill("Pasta al forno");
  await page.getByRole("button", { name: "Aggiungi ingrediente" }).click();
  await page.getByRole("searchbox", { name: "Cerca un ingrediente" }).fill(ingredientName);
  await page.getByRole("button", { name: new RegExp(`^${ingredientName}`) }).first().click();
  await page.getByLabel("Quantità a crudo").fill("400");
  await page.getByRole("dialog").getByRole("button", { name: "Aggiungi ingrediente" }).click();

  await page.getByRole("button", { name: "Pesa con la pentola" }).click();
  const weighDrawer = page.getByRole("dialog");
  await expect(weighDrawer.getByRole("button", { name: /Padella grande/ })).toHaveAttribute("aria-pressed", "true");
  await weighDrawer.getByLabel("Peso con la pentola").fill("1000");
  await expect(weighDrawer.getByText(/deve superare quello della pentola/)).toBeVisible();

  await weighDrawer.getByRole("button", { name: "Nuova pentola" }).click();
  await weighDrawer.getByLabel("Nome").fill("Pirofila");
  await weighDrawer.getByLabel("Peso vuota").fill("600");
  await weighDrawer.getByRole("button", { name: "Salva pentola" }).click();
  await expect(weighDrawer.getByRole("button", { name: /Pirofila/ })).toHaveAttribute("aria-pressed", "true");
  await weighDrawer.getByLabel("Peso con la pentola").fill("1450");
  await expect(weighDrawer.getByText("Peso da cotto 850 g, crudo 400 g.")).toBeVisible();
  await weighDrawer.getByRole("button", { name: "Usa 850 g" }).click();

  await expect(page.getByLabel("Peso da cotto")).toHaveValue("850");
  await page.getByRole("button", { name: "Crea ricetta" }).click();
  await expect(page).toHaveURL(/\/recipes\/[0-9a-f-]{36}$/);
  await expect(page.getByText(/850 g da cotto/)).toBeVisible();

  await page.goto("/profile");
  await page.getByRole("tab", { name: "Impostazioni" }).click();
  await page.getByRole("button", { name: "Modifica Pirofila" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Elimina" }).click();
  await expect(page.getByRole("button", { name: "Modifica Pirofila" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Modifica Padella grande" })).toBeVisible();
});
