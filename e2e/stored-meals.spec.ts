import { expect, type Page, test } from "@playwright/test";
import { isoDay, registerUser } from "./helpers";

async function createFood(page: Page, name: string, kcal: string) {
  await page.goto(`/food/new?name=${encodeURIComponent(name)}`);
  await page.waitForLoadState("networkidle");
  await page.getByLabel("Kcal", { exact: true }).fill(kcal);
  await page.getByRole("button", { name: "Crea alimento" }).click();
  await page.waitForURL(/\/food\/[0-9a-f-]{36}$/);
}

test("stores portions in the freezer and logs them one at a time", async ({ page }) => {
  test.setTimeout(120_000);
  await registerUser(page);
  const foodName = `Lasagna congelata ${Date.now()}`;
  await createFood(page, foodName, "200");

  await page.goto("/food?tab=meals");
  await page.getByRole("link", { name: "Metti da parte un pasto" }).click();
  await page.waitForLoadState("networkidle");
  await page.getByLabel("Nome").fill("Lasagna della domenica");
  await page.getByRole("button", { name: "Congelatore", exact: true }).click();
  await page.getByRole("button", { name: "Una porzione in più" }).click();
  await page.getByRole("button", { name: "Aggiungi alimento o ricetta" }).click();
  await page.getByRole("searchbox", { name: "Cerca un alimento o una ricetta" }).fill(foodName);
  await page.getByRole("button", { name: new RegExp(`^${foodName}`) }).first().click();
  await page.getByLabel("Quantità").fill("300");
  await page.getByRole("button", { name: "Aggiungi al pasto" }).click();
  await expect(page.getByText(`${foodName}`)).toBeVisible();
  await expect(page.getByText("600 kcal").first()).toBeVisible();
  await page.getByRole("button", { name: "Metti da parte" }).click();
  await expect(page.getByText("«Lasagna della domenica» nel congelatore")).toBeVisible();
  await expect(page).toHaveURL(/\/food\?tab=meals$/);
  await expect(page.getByRole("link", { name: /Lasagna della domenica/ })).toContainText("2 porzioni, preparato oggi");

  await page.goto("/add?meal=dinner");
  await page.getByRole("tab", { name: "Pasti" }).click();
  await page.getByRole("button", { name: /Lasagna della domenica/ }).click();
  await page.getByRole("button", { name: "Aggiungi una porzione a cena" }).click();
  await expect(page.getByText("Ne restano 1 porzione.")).toBeVisible();
  await expect(page.getByText("1 voce aggiunta")).toBeVisible();
  await page
    .locator("[data-sonner-toast]")
    .filter({ hasText: "«Lasagna della domenica»" })
    .getByRole("button", { name: "Annulla" })
    .click();
  await expect(page.getByText("1 voce aggiunta")).toBeHidden();
  await expect(page.getByRole("button", { name: /Lasagna della domenica/ })).toContainText("2 porzioni");

  for (const remaining of ["Ne restano 1 porzione.", "Era l'ultima porzione."]) {
    await page.getByRole("button", { name: /Lasagna della domenica/ }).click();
    await page.getByRole("button", { name: "Aggiungi una porzione a cena" }).click();
    await expect(page.getByText(remaining)).toBeVisible();
    await expect(page.getByRole("dialog")).toBeHidden();
  }
  await expect(page.getByRole("button", { name: /Lasagna della domenica/ })).toHaveCount(0);
  await page.getByRole("button", { name: "Fatto" }).click();
  await expect(page.getByRole("region", { name: "Cena" }).getByText("1.200 kcal")).toBeVisible();

  await page.goto("/food?tab=meals");
  await expect(page.getByRole("link", { name: /Lasagna della domenica/ })).toHaveCount(0);
});

test("stores a meal from the diary and warns when it has been in the fridge too long", async ({ page }) => {
  test.setTimeout(120_000);
  await registerUser(page);
  const foodName = `Minestrone ${Date.now()}`;
  await createFood(page, foodName, "50");

  await page.goto("/add?meal=lunch");
  await page.waitForLoadState("networkidle");
  await page.getByRole("searchbox").fill(foodName);
  await page.getByRole("button", { name: new RegExp(`^${foodName}`) }).first().click();
  await page.getByLabel("Quantità").fill("400");
  await page.getByRole("button", { name: "Aggiungi a pranzo" }).click();
  await page.getByRole("button", { name: "Fatto" }).click();

  const lunch = page.getByRole("region", { name: "Pranzo" });
  await lunch.getByRole("button", { name: "Altre azioni per pranzo" }).click();
  await page.getByRole("menuitem", { name: "Metti da parte…" }).click();
  const drawer = page.getByRole("dialog");
  await drawer.getByLabel("Nome del pasto").fill("Minestrone di verdure");
  await drawer.getByRole("button", { name: "Una porzione in più" }).click();
  await drawer.getByRole("button", { name: "Metti da parte" }).click();
  await expect(page.getByText("«Minestrone di verdure» in frigo")).toBeVisible();

  await page.goto("/food?tab=meals");
  await page.getByRole("link", { name: /Minestrone di verdure/ }).click();
  await page.waitForLoadState("networkidle");
  await expect(page.getByLabel("Nome")).toHaveValue("Minestrone di verdure");
  await expect(page.getByRole("link", { name: "Mangia una porzione" })).toBeVisible();
  await page.getByLabel("Preparato il").fill(isoDay(-5));
  await expect(page.getByText("Da più di 3 giorni in frigo: controlla prima di mangiarlo.")).toBeVisible();
  await page.getByRole("button", { name: "Congelatore", exact: true }).click();
  await expect(page.getByText("Da più di 3 giorni in frigo")).toBeHidden();
  await page.getByRole("button", { name: "Frigo", exact: true }).click();
  await page.getByRole("button", { name: "Salva" }).click();
  await expect(page).toHaveURL(/\/food\?tab=meals$/);
  await expect(page.getByRole("link", { name: /Minestrone di verdure/ })).toContainText("preparato 5 giorni fa");

  await page.getByRole("link", { name: /Minestrone di verdure/ }).click();
  await page.getByRole("button", { name: "Elimina pasto" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Elimina" }).click();
  await expect(page).toHaveURL(/\/food\?tab=meals$/);
  await expect(page.getByRole("link", { name: /Minestrone di verdure/ })).toHaveCount(0);
});
