import { expect, test } from "@playwright/test";

test("shows the bottom navigation and switches section", async ({ page }) => {
  await page.goto("/");
  const navigation = page.getByRole("navigation", { name: "Navigazione principale" });
  await expect(navigation).toBeVisible();
  await navigation.getByRole("link", { name: "Profilo" }).click();
  await expect(page.getByRole("heading", { name: "Profilo" })).toBeVisible();
});
