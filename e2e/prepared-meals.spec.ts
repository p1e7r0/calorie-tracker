import { expect, type Page, test } from "@playwright/test";
import { registerUser } from "./helpers";

async function createFood(page: Page, name: string, kcal: string) {
  await page.goto(`/food/new?name=${encodeURIComponent(name)}`);
  await page.waitForLoadState("networkidle");
  await page.getByLabel("Kcal", { exact: true }).fill(kcal);
  await page.getByRole("button", { name: "Crea alimento" }).click();
  await page.waitForURL(/\/food\/[0-9a-f-]{36}$/);
}

async function addToPreparedMeal(page: Page, name: string, grams: string) {
  await page.getByRole("button", { name: "Aggiungi alimento o ricetta" }).click();
  await page.getByRole("searchbox", { name: "Cerca un alimento o una ricetta" }).fill(name);
  await page.getByRole("button", { name: new RegExp(`^${name}`) }).first().click();
  await page.getByLabel("Quantità").fill(grams);
  await page.getByRole("button", { name: "Aggiungi al pasto" }).click();
}

test("puts the portions of a recipe in the freezer and logs them one at a time", async ({ page }) => {
  test.setTimeout(120_000);
  await registerUser(page);
  const suffix = Date.now();
  const sauce = `Ragù pronto ${suffix}`;
  const bread = `Pane pronto ${suffix}`;
  await createFood(page, sauce, "200");
  await createFood(page, bread, "250");

  await page.goto("/recipes/new");
  await page.waitForLoadState("networkidle");
  await page.getByLabel("Nome").fill(`Lasagne ${suffix}`);
  await page.getByRole("button", { name: "Aggiungi ingrediente" }).click();
  await page.getByRole("searchbox", { name: "Cerca un ingrediente" }).fill(sauce);
  await page.getByRole("button", { name: new RegExp(`^${sauce}`) }).first().click();
  await page.getByLabel("Quantità a crudo").fill("1000");
  await page.getByRole("dialog").getByRole("button", { name: "Aggiungi ingrediente" }).click();
  await page.getByLabel("Peso da cotto").fill("800");
  await page.getByRole("button", { name: "Crea ricetta" }).click();
  await expect(page).toHaveURL(/\/recipes\/[0-9a-f-]{36}$/);
  const recipeUrl = page.url();

  await page.getByRole("link", { name: "Metti in frigo o in congelatore" }).click();
  await expect(page.getByLabel("Nome")).toHaveValue(`Lasagne ${suffix}`);
  await expect(page.getByText("1 porzione, 500 kcal")).toBeVisible();
  await expect(page.getByRole("group", { name: "Porzioni" })).toContainText("4");
  await page.getByRole("button", { name: "Congelatore", exact: true }).click();
  await addToPreparedMeal(page, bread, "50");
  await expect(page.getByText("50 g, 125 kcal")).toBeVisible();
  await page.getByRole("button", { name: "Metti in congelatore" }).click();
  await expect(page.getByText(`«Lasagne ${suffix}» in congelatore: 4 porzioni`)).toBeVisible();
  await expect(page).toHaveURL(/\/food\?tab=prepared/);

  const freezer = page.getByRole("region", { name: "Congelatore" });
  await expect(freezer.getByRole("link", { name: /Lasagne/ })).toContainText("4 porzioni, in congelatore da oggi");
  await expect(freezer.getByRole("link", { name: /Lasagne/ })).toContainText("625 kcal");

  await page.goto(`${recipeUrl}/edit`);
  await page.waitForLoadState("networkidle");
  await page.getByRole("button", { name: "Una porzione in meno" }).click();
  await page.getByRole("button", { name: "Salva ricetta" }).click();
  await expect(page).toHaveURL(/\/recipes\/[0-9a-f-]{36}$/);

  await page.goto("/food?tab=prepared");
  await page.getByRole("link", { name: /Lasagne/ }).click();
  await expect(page.getByRole("heading", { name: "In una porzione" })).toBeVisible();
  await expect(page.getByText("1 porzione, 500 kcal")).toBeVisible();
  await page.getByRole("button", { name: "Frigo", exact: true }).click();
  await expect(page.getByText("Salvando, lo sposti in frigo da oggi.")).toBeVisible();
  await page.getByRole("button", { name: "Salva", exact: true }).click();
  await expect(page).toHaveURL(/\/food\?tab=prepared/);
  await expect(page.getByRole("region", { name: "Frigo" }).getByRole("link", { name: /Lasagne/ })).toContainText(
    "4 porzioni, in frigo da oggi",
  );

  await page.goto("/add?meal=dinner");
  await page.waitForLoadState("networkidle");
  await page.getByRole("tab", { name: "Pasti" }).click();
  await page.getByRole("button", { name: /Lasagne/ }).click();
  await page.getByRole("button", { name: "Aggiungi una porzione a cena" }).click();
  await expect(page.getByText("2 voci aggiunte")).toBeVisible();
  await expect(page.getByRole("button", { name: /Lasagne/ })).toContainText("3 porzioni");
  await page
    .locator("[data-sonner-toast]")
    .filter({ hasText: `Aggiunto a cena: «Lasagne ${suffix}»` })
    .getByRole("button", { name: "Annulla" })
    .click();
  await expect(page.getByText("2 voci aggiunte")).toBeHidden();
  await expect(page.getByRole("button", { name: /Lasagne/ })).toContainText("4 porzioni");

  await page.getByRole("button", { name: /Lasagne/ }).click();
  await page.getByRole("button", { name: "Aggiungi una porzione a cena" }).click();
  await expect(page.getByText("2 voci aggiunte")).toBeVisible();
  await page.getByRole("button", { name: "Fatto" }).click();
  const dinner = page.getByRole("region", { name: "Cena" });
  await expect(dinner.getByText("625 kcal")).toBeVisible();
  await expect(dinner.getByText(`Lasagne ${suffix}`)).toBeVisible();
  await expect(dinner.getByText(bread)).toBeVisible();

  await page.goto("/food?tab=prepared");
  await expect(page.getByRole("link", { name: /Lasagne/ })).toContainText("3 porzioni");
});

test("finds a prepared meal from the search, removes the last portion and deletes one after confirming", async ({
  page,
}) => {
  test.setTimeout(90_000);
  await registerUser(page);
  const suffix = Date.now();
  const soup = `Minestrone pronto ${suffix}`;
  await createFood(page, soup, "60");

  await page.goto("/food?tab=prepared");
  await page.getByRole("link", { name: "Nuovo pasto pronto" }).click();
  await page.waitForLoadState("networkidle");
  await expect(page.getByRole("button", { name: "Metti in frigo" })).toBeDisabled();
  await page.getByLabel("Nome").fill(`Minestrone ${suffix}`);
  await addToPreparedMeal(page, soup, "300");
  await page.getByRole("button", { name: "Metti in frigo" }).click();
  await expect(page.getByText(`«Minestrone ${suffix}» in frigo: 1 porzione`)).toBeVisible();

  await page.goto("/food?tab=prepared");
  await page.getByRole("link", { name: "Nuovo pasto pronto" }).click();
  await page.waitForLoadState("networkidle");
  await page.getByLabel("Nome").fill(`Da buttare ${suffix}`);
  await addToPreparedMeal(page, soup, "100");
  await page.getByRole("button", { name: "Metti in frigo" }).click();
  await expect(page).toHaveURL(/\/food\?tab=prepared/);

  await page.goto("/add?meal=lunch");
  await page.waitForLoadState("networkidle");
  await page.getByRole("searchbox").fill(`minestrone ${suffix}`);
  await page.getByRole("button", { name: new RegExp(`Minestrone ${suffix}`) }).click();
  await expect(page.getByRole("dialog")).toContainText("In frigo da oggi, 1 porzione");
  await page.getByRole("button", { name: "Aggiungi una porzione a pranzo" }).click();
  await expect(page.getByText("1 voce aggiunta")).toBeVisible();
  await page.getByRole("searchbox").fill(`minestrone ${suffix}`);
  await expect(page.getByRole("button", { name: new RegExp(`^${soup}`) }).first()).toBeVisible();
  await expect(page.getByRole("button", { name: new RegExp(`Minestrone ${suffix}`) })).toHaveCount(0);

  await page.goto("/food?tab=prepared");
  await expect(page.getByRole("link", { name: /Minestrone/ })).toHaveCount(0);
  await page.getByRole("link", { name: /Da buttare/ }).click();
  await page.getByRole("button", { name: "Elimina pasto pronto" }).click();
  const dialog = page.getByRole("alertdialog");
  await expect(dialog.getByText(`Eliminare «Da buttare ${suffix}»?`)).toBeVisible();
  await dialog.getByRole("button", { name: "Elimina" }).click();
  await expect(page).toHaveURL(/\/food\?tab=prepared/);
  await expect(page.getByText("Hai cucinato per più giorni?")).toBeVisible();
});
