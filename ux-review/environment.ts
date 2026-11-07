import { existsSync } from "node:fs";
import path from "node:path";
import type { BrowserContextOptions, LaunchOptions, Page } from "@playwright/test";

export const baseURL = process.env.UX_BASE_URL ?? "http://localhost:3100";
export const reviewDirectory = path.resolve(__dirname);
export const reportDirectory = path.resolve(__dirname, "..", "ux-report");
export const authDirectory = path.join(reviewDirectory, ".auth");
export const driverPort = Number(process.env.UX_DRIVER_PORT ?? 3199);
export const password = process.env.UX_PASSWORD ?? "password-sicura";

export const users = {
  full: process.env.UX_EMAIL ?? "ux-full@example.com",
  empty: process.env.UX_EMPTY_EMAIL ?? "ux-empty@example.com",
} as const;

export type UserKey = keyof typeof users;

export function storageStatePath(user: UserKey) {
  return path.join(authDirectory, `${user}.json`);
}

const preinstalledChromium = "/opt/pw-browsers/chromium";

export const launchOptions: LaunchOptions = existsSync(preinstalledChromium) ? { executablePath: preinstalledChromium } : {};

export const mobileContext: BrowserContextOptions = {
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: Number(process.env.UX_SCALE ?? 1),
  isMobile: true,
  hasTouch: true,
  userAgent:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1",
  locale: "it-IT",
  timezoneId: "Europe/Rome",
};

export const desktopContext: BrowserContextOptions = {
  viewport: { width: 1280, height: 800 },
  deviceScaleFactor: 1,
  locale: "it-IT",
  timezoneId: "Europe/Rome",
};

export async function logIn(page: Page, email: string) {
  await page.goto(`${baseURL}/login`);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Accedi" }).click();
  await page.waitForURL((url) => url.pathname === "/", { timeout: 60_000 });
}
