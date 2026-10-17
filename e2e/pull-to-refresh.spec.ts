import { type CDPSession, devices, expect, type Page, test } from "@playwright/test";
import { registerUser } from "./helpers";

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const { defaultBrowserType, ...iPhone } = devices["iPhone 15"];
test.use(iPhone);

type Point = { x: number; y: number };

async function touch(cdp: CDPSession, type: "touchStart" | "touchMove" | "touchEnd", point?: Point) {
  await cdp.send("Input.dispatchTouchEvent", { type, touchPoints: point ? [point] : [] });
}

async function drag(cdp: CDPSession, from: Point, to: Point, steps = 16) {
  await touch(cdp, "touchStart", from);
  for (let step = 1; step <= steps; step += 1) {
    await touch(cdp, "touchMove", {
      x: from.x + ((to.x - from.x) * step) / steps,
      y: from.y + ((to.y - from.y) * step) / steps,
    });
  }
}

function contentOffset(page: Page) {
  return page
    .locator('[data-slot="pull-to-refresh-content"]')
    .evaluate((element) => new DOMMatrix(getComputedStyle(element).transform).m42);
}

async function openToday(page: Page) {
  await registerUser(page);
  await page.goto("/");
  await page.waitForLoadState("networkidle");
  const addLink = page.getByRole("link", { name: "Aggiungi a colazione" });
  const box = (await addLink.boundingBox())!;
  const cdp = await page.context().newCDPSession(page);
  const loads = { count: 0 };
  page.on("load", () => (loads.count += 1));
  const refreshRequests = { count: 0 };
  page.on("request", (request) => {
    if (request.headers()["rsc"] === "1") refreshRequests.count += 1;
  });
  await page.evaluate(() => Object.assign(window, { pullToRefreshMarker: true }));
  return { cdp, start: { x: box.x + box.width / 2, y: box.y + box.height / 2 }, loads, refreshRequests };
}

test("a short pull springs back without refreshing or tapping", async ({ page }) => {
  test.setTimeout(60_000);
  const { cdp, start, loads, refreshRequests } = await openToday(page);

  await drag(cdp, start, { x: start.x, y: start.y + 80 });
  const pulled = await contentOffset(page);
  expect(pulled).toBeGreaterThan(20);
  expect(pulled).toBeLessThan(70);
  await touch(cdp, "touchEnd");

  await expect.poll(() => contentOffset(page)).toBe(0);
  await page.waitForTimeout(500);
  expect(refreshRequests.count).toBe(0);
  await expect(page.getByRole("status").filter({ hasText: /aggiorna/i })).toHaveCount(0);
  await expect(page).toHaveURL(/\/$/);
  expect(loads.count).toBe(0);
});

test("a horizontal swipe does not pull", async ({ page }) => {
  test.setTimeout(60_000);
  const { cdp, start } = await openToday(page);

  await drag(cdp, start, { x: start.x - 120, y: start.y + 40 });
  expect(await contentOffset(page)).toBe(0);
  await touch(cdp, "touchEnd");
});

test("a long pull refreshes the server data in place and holds the content at 56 px", async ({ page, context }) => {
  test.setTimeout(90_000);
  const { cdp, start, loads, refreshRequests } = await openToday(page);
  const status = page.getByRole("status").filter({ hasText: /aggiorna/i });

  const otherPage = await context.newPage();
  await otherPage.goto("/add?meal=snack");
  await otherPage.waitForLoadState("networkidle");
  await otherPage.getByRole("button", { name: "Kcal veloci" }).click();
  await otherPage.getByLabel("Kcal", { exact: true }).fill("350");
  await otherPage.getByLabel("Descrizione").fill("Aperitivo dal telefono");
  await otherPage.getByRole("button", { name: "Aggiungi a spuntini" }).click();
  await expect(otherPage.getByText("1 voce aggiunta")).toBeVisible();
  await otherPage.close();

  const snacks = page.getByRole("region", { name: "Spuntini" });
  await expect(snacks.getByText("Aperitivo dal telefono")).toHaveCount(0);

  await page.route("**/*", async (route) => {
    if (route.request().headers()["rsc"] === "1") await new Promise((resolve) => setTimeout(resolve, 1500));
    await route.fallback();
  });

  await drag(cdp, start, { x: start.x + 10, y: start.y + 260 });
  expect(await contentOffset(page)).toBeGreaterThan(70);
  await expect(status).toHaveText("Aggiornamento in corso");
  await touch(cdp, "touchEnd");

  await expect.poll(() => contentOffset(page)).toBeCloseTo(56, 0);
  await expect(status).toHaveText("Aggiornamento in corso");
  await expect(snacks.getByText("Aperitivo dal telefono")).toBeVisible({ timeout: 15_000 });
  await expect(status).toHaveText("Contenuto aggiornato");
  await expect.poll(() => contentOffset(page)).toBe(0);

  expect(refreshRequests.count).toBeGreaterThan(0);
  expect(loads.count).toBe(0);
  expect(await page.evaluate(() => "pullToRefreshMarker" in window)).toBe(true);
  await expect(page).toHaveURL(/\/$/);
});
