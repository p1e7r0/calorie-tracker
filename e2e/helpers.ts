import { expect, type Page } from "@playwright/test";

export function isoDay(offset: number) {
  const date = new Date();
  date.setDate(date.getDate() + offset);
  return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, "0"), String(date.getDate()).padStart(2, "0")].join("-");
}

export function uniqueEmail() {
  return `test-${Date.now()}-${Math.floor(Math.random() * 10_000)}@example.com`;
}

export async function registerUser(page: Page, email = uniqueEmail(), password = "password-sicura") {
  await page.goto("/register");
  await page.getByLabel("Nome").fill("Tester");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Crea account" }).click();
  await expect(page).toHaveURL(/\/profile/);
  return { email, password };
}
