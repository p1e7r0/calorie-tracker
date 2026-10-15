import { expect, test } from "@playwright/test";
import { registerUser } from "./helpers";

test("shows the bottom navigation and switches section", async ({ page }) => {
  await registerUser(page);
  await page.goto("/");
  const navigation = page.getByRole("navigation", { name: "Navigazione principale" });
  await expect(navigation).toBeVisible();
  await navigation.getByRole("link", { name: "Cibo", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Cibo" })).toBeVisible();
});
