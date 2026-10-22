import { expect, test } from "@playwright/test";
import { registerUser } from "./helpers";

test("freezes portions of a food, logs them from Aggiungi and returns them when the entry goes away", async ({ page }) => {
  test.setTimeout(120_000);
  await registerUser(page);
  await page.goto("/food/new?name=Lasagne%20test");
  await page.waitForLoadState("networkidle");
  await page.getByLabel("Kcal", { exact: true }).fill("200");
  await page.getByRole("button", { name: "Crea alimento" }).click();
  await page.waitForURL(/\/food\/[0-9a-f-]{36}$/);

  await page.getByRole("button", { name: "Metti in congelatore" }).click();
  const freezeDrawer = page.getByRole("dialog");
  await freezeDrawer.getByRole("button", { name: "Una porzione in più" }).click();
  await freezeDrawer.getByRole("button", { name: "Una porzione in più" }).click();
  await freezeDrawer.getByLabel("Ogni porzione").fill("250");
  await expect(freezeDrawer.getByText("500")).toBeVisible();
  await freezeDrawer.getByRole("button", { name: "Metti 3 porzioni in congelatore" }).click();
  await expect(page.getByText("Nel congelatore: «Lasagne test», 3 porzioni")).toBeVisible();

  await page.goto("/food?tab=freezer");
  await expect(page.getByRole("button", { name: /Lasagne test 3 porzioni, 500 kcal a porzione/ })).toBeVisible();

  await page.goto("/add?meal=dinner");
  await page.waitForLoadState("networkidle");
  const freezer = page.getByRole("region", { name: "Dal congelatore" });
  await expect(freezer.getByText("250 g, 500 kcal. Ne restano 3, congelato oggi")).toBeVisible();
  await freezer.getByRole("button", { name: "Aggiungi una porzione di Lasagne test dal congelatore" }).click();
  await expect(page.getByText("1 voce aggiunta")).toBeVisible();
  await expect(freezer.getByText(/Ne restano 2/)).toBeVisible();
  await page
    .locator("[data-sonner-toast]")
    .filter({ hasText: "Aggiunto a cena: «Lasagne test»" })
    .getByRole("button", { name: "Annulla" })
    .click();
  await expect(page.getByText("1 voce aggiunta")).toBeHidden();
  await page.reload();
  await expect(page.getByRole("region", { name: "Dal congelatore" }).getByText(/Ne restano 3/)).toBeVisible();

  await page
    .getByRole("region", { name: "Dal congelatore" })
    .getByRole("button", { name: "Aggiungi una porzione di Lasagne test dal congelatore" })
    .click();
  await expect(page.getByText("1 voce aggiunta")).toBeVisible();
  await page.getByRole("button", { name: "Fatto" }).click();
  await expect(page.getByRole("region", { name: "Cena" }).getByText(/^500\s*kcal$/)).toBeVisible();

  const dinner = page.getByRole("region", { name: "Cena" });
  await dinner.getByRole("button", { name: /Lasagne test/ }).click();
  await page.getByRole("button", { name: "Elimina" }).click();
  await expect(dinner.getByText("Niente ancora.")).toBeVisible();
  await page.locator("[data-sonner-toast]").filter({ hasText: "Eliminato" }).getByRole("button", { name: "Annulla" }).click();
  await expect(dinner.getByText(/^500\s*kcal$/)).toBeVisible();
  await page.goto("/food?tab=freezer");
  await expect(page.getByRole("button", { name: /Lasagne test ne restano 2 di 3/ })).toBeVisible();

  await page.goto("/");
  await dinner.getByRole("button", { name: /Lasagne test/ }).click();
  await page.getByRole("button", { name: "Elimina" }).click();
  await expect(dinner.getByText("Niente ancora.")).toBeVisible();
  await page.goto("/food?tab=freezer");
  await page.getByRole("button", { name: /Lasagne test 3 porzioni/ }).click();
  const batchDrawer = page.getByRole("dialog");
  for (let index = 0; index < 3; index++) {
    await batchDrawer.getByRole("button", { name: "Una porzione in meno" }).click();
  }
  await batchDrawer.getByRole("button", { name: "Salva" }).click();
  await expect(page.getByText("Finito: «Lasagne test»")).toBeVisible();
  await expect(page.getByRole("button", { name: /Lasagne test/ })).toHaveCount(0);

  await page.goto("/add?meal=dinner");
  await expect(page.getByRole("region", { name: "Dal congelatore" })).toHaveCount(0);
});
