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

test("swipes an entry right to duplicate it and left to delete it", async ({ page }) => {
  await registerUser(page);
  await page.goto("/add?meal=dinner");
  await page.getByRole("searchbox", { name: "Cerca un alimento o una ricetta" }).fill("mela cruda");
  await page.getByRole("button", { name: /^Mela, cruda/ }).first().click();
  await page.getByRole("button", { name: "Aggiungi a cena" }).click();
  await page.getByRole("button", { name: "Fatto" }).click();

  const dinner = page.getByRole("region", { name: "Cena" });
  const entries = dinner.getByRole("button", { name: /^Mela, cruda/ });
  await expect(entries).toHaveCount(1);

  async function swipe(index: number, distance: number) {
    const box = (await entries.nth(index).boundingBox())!;
    const startX = box.x + box.width / 2;
    const y = box.y + box.height / 2;
    await page.mouse.move(startX, y);
    await page.mouse.down();
    for (let step = 1; step <= 8; step += 1) {
      await page.mouse.move(startX + (distance * step) / 8, y);
    }
    await page.mouse.up();
  }

  await swipe(0, 160);
  await expect(entries).toHaveCount(2);
  await expect(page.getByText("Mela, cruda duplicato")).toBeVisible();

  await swipe(0, -160);
  await expect(entries).toHaveCount(1);
  await page.locator("[data-sonner-toast]").filter({ hasText: "eliminato" }).getByRole("button", { name: "Annulla" }).click();
  await expect(entries).toHaveCount(2);

  await entries.first().click();
  await expect(page.getByRole("dialog")).toBeVisible();
});

test("shows fiber, sugars, saturated fat and salt for the day", async ({ page }) => {
  await registerUser(page);
  await page.goto("/add?meal=snack");
  await page.getByRole("searchbox", { name: "Cerca un alimento o una ricetta" }).fill("mela cruda");
  await page.getByRole("button", { name: /^Mela, cruda/ }).first().click();
  await page.getByLabel("Quantità").fill("200");
  await page.getByRole("button", { name: "Aggiungi a spuntini" }).click();
  await page.getByRole("button", { name: "Fatto" }).click();

  const summary = page.getByRole("region", { name: "Riepilogo del giorno" });
  await summary.getByText("Fibre, zuccheri, saturi e sale").click();
  await expect(summary.getByText("almeno 25 g")).toBeVisible();
  await expect(summary.locator("dd").filter({ hasText: "almeno 25 g" })).toContainText("4,2 g");
});

test("adds to the viewed day from the bottom bar, with Enter and a cleared search", async ({ page }) => {
  await registerUser(page);
  const date = new Date();
  date.setDate(date.getDate() - 3);
  const day = [date.getFullYear(), String(date.getMonth() + 1).padStart(2, "0"), String(date.getDate()).padStart(2, "0")].join(
    "-",
  );
  await page.goto(`/?date=${day}`);
  await page.waitForLoadState("networkidle");
  await page.getByRole("link", { name: "Aggiungi cibo" }).click();
  await expect(page).toHaveURL(`/add?date=${day}`);
  await expect(page.getByText(/^Diario di /)).toBeVisible();

  await page.getByRole("button", { name: "Pranzo", exact: true }).click();
  const search = page.getByRole("searchbox", { name: "Cerca un alimento o una ricetta" });
  await search.fill("banana cruda");
  await page.getByRole("button", { name: /^Banana, cruda/ }).click();
  await page.getByLabel("Quantità").fill("150");
  await page.getByLabel("Quantità").press("Enter");
  await expect(page.getByText("1 voce aggiunta")).toBeVisible();
  await expect(search).toHaveValue("");
  await expect(search).toBeFocused();

  await page.getByRole("button", { name: "Fatto" }).click();
  await expect(page).toHaveURL(`/?date=${day}`);
  const lunch = page.getByRole("region", { name: "Pranzo" });
  await expect(lunch.getByText("150 g")).toBeVisible();

  await lunch.getByRole("button", { name: /Banana, cruda/ }).click();
  await page.getByLabel("Quantità").fill("90");
  await page.getByLabel("Quantità").press("Enter");
  await expect(lunch.getByText("90 g")).toBeVisible();
});
