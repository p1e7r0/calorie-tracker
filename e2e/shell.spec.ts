import { expect, type Page, test } from "@playwright/test";
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

test("keeps the primary form actions in the footer above the bottom navigation", async ({ page }) => {
  await registerUser(page);
  const footer = page.locator('[data-slot="screen-footer"]');
  const saveGoal = footer.getByRole("button", { name: "Salva obiettivo" });
  await expect(saveGoal).toBeInViewport();
  const saveGoalBox = await saveGoal.boundingBox();
  const navigationBox = await page.getByRole("navigation", { name: "Navigazione principale" }).boundingBox();
  expect(saveGoalBox!.y + saveGoalBox!.height).toBeLessThanOrEqual(navigationBox!.y);

  await page.getByRole("tab", { name: "Impostazioni" }).click();
  await expect(page.getByRole("heading", { name: "Tema", exact: true })).toBeVisible();
  await expect(saveGoal).toBeHidden();
});

test("submits the food form from the footer button and with Enter", async ({ page }) => {
  test.setTimeout(60_000);
  await registerUser(page);
  await page.goto(`/food/new?name=${encodeURIComponent(`Barretta footer ${Date.now()}`)}`);
  await page.waitForLoadState("networkidle");
  const create = page.locator('[data-slot="screen-footer"]').getByRole("button", { name: "Crea alimento" });
  await expect(create).toBeInViewport();

  const kcal = page.getByLabel("Kcal", { exact: true });
  await kcal.press("Enter");
  await expect(page.locator('[data-slot="screen-footer"]').getByRole("alert")).toHaveText("Inserisci le kcal o i macronutrienti per 100 g.");
  await kcal.fill("380");
  await kcal.press("Enter");
  await page.waitForURL(/\/food\/[0-9a-f-]{36}$/);
  await expect(page.getByText("380", { exact: true })).toBeVisible();

  await page.getByRole("link", { name: "Modifica" }).click();
  const save = page.locator('[data-slot="screen-footer"]').getByRole("button", { name: "Salva", exact: true });
  await expect(save).toBeInViewport();
  await page.getByLabel("Kcal", { exact: true }).fill("390");
  await save.click();
  await page.waitForURL(/\/food\/[0-9a-f-]{36}$/);
  await expect(page.getByText("390", { exact: true })).toBeVisible();
});

async function expectPickerToCoverTheVisualViewport(
  page: Page,
  path: string,
  openLabel: string,
  pickerName: string,
  searchName: string,
) {
  await page.goto(path);
  await page.waitForLoadState("networkidle");
  await page.getByRole("button", { name: openLabel }).click();
  const picker = page.getByRole("dialog", { name: pickerName });
  await expect(picker).toBeVisible();

  await page.evaluate(() => {
    const root = document.documentElement;
    root.style.setProperty("--viewport-offset-top", "180px");
    root.style.setProperty("--viewport-height", "420px");
    root.dataset.keyboardOpen = "";
  });
  const shellBox = await page.locator(".app-viewport").first().boundingBox();
  const pickerBox = await picker.boundingBox();
  expect(pickerBox).toEqual(shellBox);
  expect(shellBox!.y).toBe(180);
  expect(shellBox!.height).toBe(420);
  await expect(page.getByRole("searchbox", { name: searchName })).toBeInViewport();
}

test("keeps the full-screen pickers on the visual viewport while the keyboard is open", async ({ page }) => {
  test.setTimeout(90_000);
  await registerUser(page);
  await expectPickerToCoverTheVisualViewport(
    page,
    "/recipes/new",
    "Aggiungi ingrediente",
    "Aggiungi ingrediente",
    "Cerca un ingrediente",
  );
  await expectPickerToCoverTheVisualViewport(
    page,
    "/stored-meals/new",
    "Aggiungi alimento o ricetta",
    "Aggiungi al pasto",
    "Cerca un alimento o una ricetta",
  );
});

test("keeps the focused field above the footer when the keyboard shrinks the shell", async ({ page }) => {
  test.setTimeout(60_000);
  await registerUser(page);
  await page.goto("/recipes/new");
  await page.waitForLoadState("networkidle");
  const cookedWeight = page.getByLabel("Peso da cotto");
  await cookedWeight.click();
  await expect(cookedWeight).toBeFocused();

  const fieldBefore = await cookedWeight.boundingBox();
  await page.setViewportSize({ width: 412, height: 380 });
  await expect(cookedWeight).toBeInViewport({ ratio: 1 });
  const fieldBox = await cookedWeight.boundingBox();
  const footerBox = await page.locator('[data-slot="screen-footer"]').boundingBox();
  expect(footerBox!.y).toBeLessThan(fieldBefore!.y + fieldBefore!.height);
  expect(fieldBox!.y + fieldBox!.height).toBeLessThanOrEqual(footerBox!.y);
});
