import { expect, test } from "@playwright/test";
import { registerUser } from "./helpers";

test.skip(Boolean(process.env.ANTHROPIC_API_KEY), "Checks the screens without an Anthropic key");

test("hides the AI helpers when no Anthropic key is configured", async ({ page }) => {
  await registerUser(page);
  await page.goto("/add?meal=lunch");
  await expect(page.getByRole("button", { name: "Kcal veloci" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Descrivi" })).toHaveCount(0);
  await page.goto("/food/new");
  await expect(page.getByLabel("Nome")).toBeVisible();
  await expect(page.getByRole("button", { name: "Compila da una foto dell'etichetta" })).toHaveCount(0);
});
