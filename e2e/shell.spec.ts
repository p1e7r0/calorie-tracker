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

test("keeps the header still while the content scrolls and puts the search at the bottom", async ({ page }) => {
  await registerUser(page);
  await page.goto("/food");
  const search = page.getByRole("searchbox", { name: "Cerca nel catalogo" });
  await search.fill("pane");
  await expect(page.getByRole("link", { name: /Crea «pane»/ })).toBeVisible();

  const heading = page.getByRole("heading", { name: "Cibo" });
  const headingBefore = await heading.boundingBox();
  const scrollState = await page.evaluate(() => {
    const body = document.querySelector<HTMLElement>('[data-slot="screen-body"]')!;
    body.scrollTop = body.scrollHeight;
    window.scrollTo(0, 10_000);
    return { bodyScrollTop: body.scrollTop, windowScrollY: window.scrollY };
  });
  expect(scrollState.bodyScrollTop).toBeGreaterThan(0);
  expect(scrollState.windowScrollY).toBe(0);
  expect(await heading.boundingBox()).toEqual(headingBefore);

  const searchBox = await search.boundingBox();
  const navigationBox = await page.getByRole("navigation", { name: "Navigazione principale" }).boundingBox();
  expect(searchBox!.y + searchBox!.height).toBeLessThanOrEqual(navigationBox!.y);
  expect(searchBox!.y).toBeGreaterThan(page.viewportSize()!.height / 2);
});
