import { expect, test } from "@playwright/test";
import { isoDay, registerUser } from "./helpers";

test("colors the kcal bars of days above the target", async ({ page }) => {
  test.setTimeout(90_000);
  await registerUser(page);
  await page.getByRole("button", { name: "Uomo" }).click();
  await page.getByLabel("Data di nascita").fill("1985-03-12");
  await page.getByLabel("Altezza (cm)").fill("180");
  await page.getByLabel("Peso attuale (kg)").fill("80");
  await page.getByRole("switch").click();
  await page.getByLabel("Kcal", { exact: true }).fill("2000");
  await page.getByLabel("Proteine g").fill("150");
  await page.getByLabel("Carbo g").fill("200");
  await page.getByLabel("Grassi g").fill("60");
  await page.getByRole("button", { name: "Salva obiettivo" }).click();
  await expect(page.getByText("Obiettivo salvato: 2000 kcal al giorno")).toBeVisible();

  for (const [offset, kcal] of [[-2, "2500"], [-1, "1500"]] as const) {
    await page.goto(`/add?date=${isoDay(offset)}&meal=lunch`);
    await page.waitForLoadState("networkidle");
    await page.getByRole("button", { name: "Kcal veloci" }).click();
    await page.getByLabel("Kcal", { exact: true }).fill(kcal);
    await page.getByRole("button", { name: "Aggiungi a pranzo" }).click();
    await expect(page.getByText("1 voce aggiunta").first()).toBeVisible();
  }

  await page.goto("/progress");
  await page.getByRole("tab", { name: "Alimentazione" }).click();
  const kcalSection = page.getByRole("region", { name: "Kcal al giorno" });
  await expect(kcalSection.getByText(/Obiettivo 2000 \(linea tratteggiata\), in arancione i giorni sopra l'obiettivo/)).toBeVisible();
  const kcalBars = kcalSection.locator(".recharts-bar-rectangle path");
  await expect(kcalBars).toHaveCount(2);
  await expect(kcalSection.locator(".recharts-bar-rectangle path[fill='var(--over)']")).toHaveCount(1);
  await expect(kcalSection.locator(".recharts-bar-rectangle path[fill='var(--color-kcal)']")).toHaveCount(1);
});

test("records body measurements and shows the trend", async ({ page }) => {
  await registerUser(page);
  await page.goto("/progress");

  for (const [day, weight, fat] of [
    ["2026-09-20", "82,4", "26"],
    ["2026-10-10", "81,1", "25,4"],
  ] as const) {
    await page.getByRole("button", { name: "Misura" }).click();
    await page.getByLabel("Data").fill(day);
    await page.getByLabel("Peso (kg)").fill(weight);
    await page.getByRole("button", { name: /^Altre misure/ }).click();
    await page.getByLabel("Massa grassa (%)").fill(fat);
    await page.getByRole("button", { name: "Salva" }).click();
    await expect(page.getByText("Misurazione salvata").first()).toBeVisible();
    await expect(page.getByRole("dialog")).toBeHidden();
  }

  await expect(page.getByText("81,1kg", { exact: true })).toBeVisible();
  await expect(page.getByText("−1,3 kg in 3 settimane, dal 20 set")).toBeVisible();
  await expect(page.locator(".recharts-surface").first()).toBeVisible();

  await page.getByRole("button", { name: "Misura" }).click();
  await expect(page.getByText("L'ultima volta (10 ott): 81,1 kg.")).toBeVisible();
  await expect(page.getByLabel("Peso (kg)")).toHaveAttribute("placeholder", "81,1");
  await expect(page.getByLabel("Massa grassa (%)")).toBeHidden();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toBeHidden();

  await page.getByRole("tab", { name: "Grasso" }).click();
  await expect(page.getByText("25,4%", { exact: true })).toBeVisible();
});
