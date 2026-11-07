import { execSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { test as setup } from "@playwright/test";
import { authDirectory, logIn, storageStatePath, users, type UserKey } from "./environment";

setup("seed the database and save the sessions", async ({ browser }) => {
  setup.setTimeout(180_000);
  if (process.env.UX_SKIP_SEED !== "1") {
    execSync("pnpm seed:ux", { cwd: path.resolve(__dirname, ".."), stdio: "inherit" });
  }
  mkdirSync(authDirectory, { recursive: true });
  for (const user of Object.keys(users) as UserKey[]) {
    const context = await browser.newContext();
    const page = await context.newPage();
    await logIn(page, users[user]);
    await context.storageState({ path: storageStatePath(user) });
    await context.close();
  }
});
