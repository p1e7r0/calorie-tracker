import { defineConfig } from "@playwright/test";
import { baseURL, desktopContext, launchOptions, mobileContext, storageStatePath } from "./environment";

const desktop = process.env.UX_DESKTOP === "1";

export default defineConfig({
  testDir: ".",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 180_000,
  reporter: "list",
  outputDir: "../test-results/ux",
  use: {
    baseURL,
    trace: "off",
    actionTimeout: 15_000,
    launchOptions,
    ...(desktop ? desktopContext : mobileContext),
  },
  projects: [
    { name: "setup", testMatch: /auth\.setup\.ts/ },
    {
      name: "scenarios",
      testMatch: /scenarios\.spec\.ts/,
      dependencies: ["setup"],
      use: { storageState: storageStatePath("full") },
    },
  ],
  webServer: {
    command: process.env.UX_DEV === "1" ? "pnpm dev" : "pnpm build && pnpm start",
    url: baseURL,
    reuseExistingServer: true,
    timeout: 600_000,
  },
});
