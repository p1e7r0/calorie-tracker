import { expect, test } from "@playwright/test";
import { registerUser } from "./helpers";

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
