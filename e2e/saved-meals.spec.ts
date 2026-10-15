import { expect, test } from "@playwright/test";
import { registerUser } from "./helpers";

test("saves a meal from the diary and logs it again in one tap", async ({ page }) => {
  await registerUser(page);
  await page.goto("/add?meal=breakfast");
  for (const [search, name, grams] of [
    ["albicocca cruda", /Albicocca, cruda/, "150"],
    ["pollo petto senza pelle", /Pollo, petto senza pelle, crudo/, "100"],
  ] as const) {
    await page.getByRole("searchbox").fill(search);
    await page.getByRole("button", { name }).first().click();
    await page.getByLabel("Quantità").fill(grams);
    await page.getByRole("button", { name: "Aggiungi a colazione" }).click();
    await expect(page.getByRole("dialog")).toBeHidden();
  }
  await page.getByRole("button", { name: "Fatto" }).click();

  const breakfast = page.getByRole("region", { name: "Colazione" });
  await breakfast.getByRole("button", { name: "Altre azioni per colazione" }).click();
  await page.getByRole("menuitem", { name: "Salva come pasto" }).click();
  await page.getByLabel("Nome del pasto").fill("Colazione proteica");
  await page.getByRole("button", { name: "Salva pasto" }).click();
  await expect(page.getByText("«Colazione proteica» salvato con 2 voci")).toBeVisible();

  await page.goto("/add?meal=dinner");
  await page.getByRole("tab", { name: "Pasti" }).click();
  await page.getByRole("button", { name: /Colazione proteica/ }).click();
  await page.getByRole("button", { name: "Aggiungi tutto a cena" }).click();
  await expect(page.getByText("2 voci aggiunte")).toBeVisible();
  await page.getByRole("button", { name: "Fatto" }).click();
  const dinner = page.getByRole("region", { name: "Cena" });
  await expect(dinner.getByText("179 kcal")).toBeVisible();
});
