import { expect, test } from "@playwright/test";
import { registerUser } from "./helpers";

test("logs a food, edits it, deletes it and undoes the deletion", async ({ page }) => {
  await registerUser(page);
  await page.goto("/add?meal=lunch");

  await page.getByRole("searchbox", { name: "Cerca un alimento o una ricetta" }).fill("pollo petto senza pelle");
  await page.getByRole("button", { name: /^Pollo, petto senza pelle, crudo/ }).click();

  const quantity = page.getByLabel("Quantità");
  await quantity.fill("200");
  await expect(page.getByRole("dialog").getByText(/^214\s*kcal$/)).toBeVisible();
  await page.getByRole("button", { name: "Aggiungi a pranzo" }).click();
  await expect(page.getByText("1 voce aggiunta")).toBeVisible();

  await page.getByRole("button", { name: "Fatto" }).click();
  await expect(page).toHaveURL("/");
  const lunch = page.getByRole("region", { name: "Pranzo" });
  await expect(lunch.getByText("Pollo, petto senza pelle, crudo")).toBeVisible();
  await expect(lunch.getByText("200 g")).toBeVisible();
  await expect(page.getByRole("region", { name: "Riepilogo del giorno" }).getByText("214")).toBeVisible();

  await lunch.getByRole("button", { name: /Pollo, petto senza pelle, crudo/ }).click();
  await page.getByLabel("Quantità").fill("100");
  await page.getByRole("button", { name: "Salva" }).click();
  await expect(lunch.getByText("100 g")).toBeVisible();
  await expect(lunch.getByText("107 kcal")).toBeVisible();

  await lunch.getByRole("button", { name: /Pollo, petto senza pelle, crudo/ }).click();
  await page.getByRole("button", { name: "Elimina" }).click();
  await expect(lunch.getByText("Niente ancora.")).toBeVisible();
  await page.locator("[data-sonner-toast]").filter({ hasText: "eliminato" }).getByRole("button", { name: "Annulla" }).click();
  await expect(lunch.getByText("Pollo, petto senza pelle, crudo")).toBeVisible();
});

test("logs quick kcal", async ({ page }) => {
  await registerUser(page);
  await page.goto("/add?meal=snack");
  await page.getByRole("button", { name: "Kcal veloci" }).click();
  await page.getByLabel("Kcal", { exact: true }).fill("350");
  await page.getByLabel("Descrizione").fill("Aperitivo");
  await page.getByRole("button", { name: "Aggiungi a spuntini" }).click();
  await page.getByRole("button", { name: "Fatto" }).click();
  await expect(page.getByRole("region", { name: "Spuntini" }).getByText("Aperitivo")).toBeVisible();
});

test("adds a recent food in one tap with the last quantity and undoes it", async ({ page }) => {
  await registerUser(page);
  await page.goto("/add?meal=breakfast");
  await page.getByRole("searchbox", { name: "Cerca un alimento o una ricetta" }).fill("banana cruda");
  await page.getByRole("button", { name: /^Banana, cruda/ }).click();
  await page.getByLabel("Quantità").fill("120");
  await page.getByRole("button", { name: "Aggiungi a colazione" }).click();
  await expect(page.getByText("1 voce aggiunta")).toBeVisible();

  await page.getByRole("searchbox", { name: "Cerca un alimento o una ricetta" }).fill("");
  await page.getByRole("tab", { name: "Recenti" }).click();
  await expect(page.getByText("Ultima volta 120 g, 114 kcal")).toBeVisible();
  await page.getByRole("button", { name: "Aggiungi 120 g di Banana, cruda" }).click();
  await expect(page.getByText("2 voci aggiunte")).toBeVisible();
  await page.locator("[data-sonner-toast]").first().getByRole("button", { name: "Annulla" }).click();
  await expect(page.getByText("1 voce aggiunta")).toBeVisible();

  await page.getByRole("button", { name: "Fatto" }).click();
  const breakfast = page.getByRole("region", { name: "Colazione" });
  await expect(breakfast.getByText("Banana, cruda")).toHaveCount(1);
});

test("steps the quantity by ten grams", async ({ page }) => {
  await registerUser(page);
  await page.goto("/add?meal=lunch");
  await page.getByRole("searchbox", { name: "Cerca un alimento o una ricetta" }).fill("banana cruda");
  await page.getByRole("button", { name: /^Banana, cruda/ }).click();
  await expect(page.getByLabel("Quantità")).toHaveValue("100");
  await page.getByRole("button", { name: "10 g in più" }).click();
  await page.getByRole("button", { name: "10 g in più" }).click();
  await page.getByRole("button", { name: "10 g in meno" }).click();
  await expect(page.getByLabel("Quantità")).toHaveValue("110");
});
