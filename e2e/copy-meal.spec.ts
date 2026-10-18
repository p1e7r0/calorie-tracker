import { expect, type Page, test } from "@playwright/test";
import { isoDay, registerUser } from "./helpers";

function localDate(offset: number) {
  const date = new Date();
  date.setDate(date.getDate() + offset);
  return date;
}

function calendarDayName(offset: number) {
  return new Intl.DateTimeFormat("it-IT", { weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(
    localDate(offset),
  );
}

function sourceDayInDefaultMonth() {
  return localDate(-2).getMonth() === localDate(-1).getMonth() ? -2 : -1;
}

async function logQuickKcal(page: Page, day: string, meal: string, mealLabel: string, label: string, kcal: string) {
  await page.goto(`/add?date=${day}&meal=${meal}`);
  await page.waitForLoadState("networkidle");
  await page.getByRole("button", { name: "Kcal veloci" }).click();
  await page.getByLabel("Kcal", { exact: true }).fill(kcal);
  await page.getByLabel("Descrizione").fill(label);
  await page.getByRole("button", { name: `Aggiungi a ${mealLabel}` }).click();
  await expect(
    page.locator("[data-sonner-toast]").filter({ hasText: `Aggiunte ${kcal} kcal a ${mealLabel}` }),
  ).toBeVisible();
}

test("copies a meal from any past day into another meal and undoes it", async ({ page }) => {
  test.setTimeout(90_000);
  const sourceOffset = sourceDayInDefaultMonth();
  await registerUser(page);
  await logQuickKcal(page, isoDay(sourceOffset), "breakfast", "colazione", "Porridge", "350");
  await logQuickKcal(page, isoDay(sourceOffset), "breakfast", "colazione", "Spremuta", "90");

  await page.goto("/");
  await page.waitForLoadState("networkidle");
  const lunch = page.getByRole("region", { name: "Pranzo" });
  await lunch.getByRole("button", { name: "Altre azioni per pranzo" }).click();
  await page.getByRole("menuitem", { name: "Copia da un altro giorno…" }).click();

  const drawer = page.getByRole("dialog");
  await expect(drawer.getByRole("heading", { name: "Copia da un altro giorno" })).toBeVisible();
  await expect(drawer.getByText("Niente registrato qui.", { exact: false })).toBeVisible();
  await expect(drawer.getByRole("button", { name: "Copia", exact: true })).toBeDisabled();

  await drawer.getByRole("button", { name: new RegExp(calendarDayName(sourceOffset)) }).click();
  await drawer.getByRole("button", { name: "Colazione", exact: true }).click();
  const preview = drawer.getByRole("region", { name: "Voci da copiare" });
  await expect(preview.getByText("Porridge")).toBeVisible();
  await expect(preview.getByText(/^350\s*kcal$/)).toBeVisible();
  await expect(preview.getByText(/^440\s*kcal$/)).toBeVisible();

  await drawer.getByRole("button", { name: "Copia 2 voci" }).click();
  await expect(drawer).toBeHidden();
  const toast = page.locator("[data-sonner-toast]").filter({ hasText: "2 voci copiate in pranzo" });
  await expect(toast).toBeVisible();
  await expect(lunch.getByText("Porridge")).toBeVisible();
  await expect(lunch.getByText("Spremuta")).toBeVisible();

  await toast.getByRole("button", { name: "Annulla" }).click();
  await expect(lunch.getByText("Niente ancora.")).toBeVisible();
});

test("copies the same meal from yesterday with the shortcut and undoes it", async ({ page }) => {
  test.setTimeout(90_000);
  await registerUser(page);
  await logQuickKcal(page, isoDay(-1), "dinner", "cena", "Pizza margherita", "800");

  await page.goto("/");
  await page.waitForLoadState("networkidle");
  const dinner = page.getByRole("region", { name: "Cena" });
  await dinner.getByRole("button", { name: "Altre azioni per cena" }).click();
  await page.getByRole("menuitem", { name: "Copia da ieri" }).click();
  const toast = page.locator("[data-sonner-toast]").filter({ hasText: "1 voce copiata da ieri" });
  await expect(toast).toBeVisible();
  await expect(dinner.getByText("Pizza margherita")).toBeVisible();

  await toast.getByRole("button", { name: "Annulla" }).click();
  await expect(dinner.getByText("Niente ancora.")).toBeVisible();
});
