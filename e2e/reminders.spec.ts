import { expect, test } from "@playwright/test";
import { registerUser } from "./helpers";

test("protects the reminder jobs with the cron secret", async ({ request }) => {
  process.loadEnvFile(".env.local");
  for (const path of ["/api/cron/evening-reminder", "/api/cron/weigh-in-reminder"]) {
    const anonymous = await request.get(path);
    expect(anonymous.status()).toBe(401);
    const authorized = await request.get(path, { headers: { authorization: `Bearer ${process.env.CRON_SECRET}` } });
    expect(authorized.status()).toBe(200);
    expect(await authorized.json()).toMatchObject({ sent: expect.any(Number) });
  }
});

test("shows the reminder settings in the profile", async ({ page }) => {
  await registerUser(page);
  await page.getByRole("tab", { name: "Impostazioni" }).click();
  await expect(page.getByText("La sera, se mancano dei pasti")).toBeVisible();
  await expect(page.getByLabel("Giorno della pesata")).toHaveValue("");
});
