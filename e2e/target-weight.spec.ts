import { expect, test } from "@playwright/test";
import { isoDay, registerUser } from "./helpers";

test("sets a target weight and shows the expected date in Progress", async ({ page }) => {
  test.setTimeout(90_000);
  await registerUser(page);
  await page.waitForLoadState("networkidle");
  await page.getByRole("button", { name: "Uomo" }).click();
  await page.getByLabel("Data di nascita").fill("1985-03-12");
  await page.getByLabel("Altezza (cm)").fill("180");
  await page.getByLabel("Peso attuale (kg)").fill("80");
  await expect(page.getByLabel("Peso obiettivo (kg)")).toBeHidden();
  await page.getByRole("button", { name: "Dimagrire" }).click();

  await page.getByLabel("Peso obiettivo (kg)").fill("20");
  await page.getByRole("button", { name: "Salva obiettivo" }).click();
  await expect(page.getByText("Peso obiettivo non valido.")).toBeVisible();

  await page.getByLabel("Peso obiettivo (kg)").fill("75");
  const summary = page.getByRole("region", { name: "Obiettivo giornaliero" });
  await expect(summary.getByText(/al ritmo scelto ci arrivi verso (il |l')/)).toBeVisible();
  await page.getByRole("button", { name: "Salva obiettivo" }).click();
  await expect(page.getByText(/^Obiettivo salvato/).first()).toBeVisible();

  await page.goto("/progress");
  const target = page.getByRole("region", { name: "Peso obiettivo" });
  await expect(target).toHaveText(
    /^Ti mancano 5 kg\. Servono più pesate per conoscere il tuo ritmo reale: al ritmo che hai scelto \(−0,5 kg a settimana\) arriveresti a 75 kg verso (il |l').+\.$/,
  );

  await page.getByRole("button", { name: "Misura" }).click();
  await page.getByLabel("Data").fill(isoDay(-10));
  await page.getByLabel("Peso (kg)").fill("81");
  await page.getByRole("button", { name: "Salva" }).click();
  await expect(page.getByRole("dialog")).toBeHidden();
  await expect(page.locator(".recharts-reference-line")).toBeVisible();
  await expect(page.getByText("Obiettivo 75 kg")).toBeVisible();

  await page.goto("/profile");
  await page.waitForLoadState("networkidle");
  await expect(page.getByLabel("Peso obiettivo (kg)")).toHaveValue("75");
  await page.getByLabel("Peso obiettivo (kg)").fill("");
  await page.getByRole("button", { name: "Salva obiettivo" }).click();
  await expect(page.getByText(/^Obiettivo salvato/).first()).toBeVisible();

  await page.goto("/progress");
  await expect(page.getByText("Storico")).toBeVisible();
  await expect(page.getByRole("region", { name: "Peso obiettivo" })).toBeHidden();
  await expect(page.locator(".recharts-reference-line")).toBeHidden();
});

test("says when the target weight has been reached", async ({ page }) => {
  await registerUser(page);
  await page.waitForLoadState("networkidle");
  await page.getByRole("button", { name: "Donna" }).click();
  await page.getByLabel("Data di nascita").fill("1990-05-10");
  await page.getByLabel("Altezza (cm)").fill("165");
  await page.getByLabel("Peso attuale (kg)").fill("62");
  await page.getByRole("button", { name: "Aumentare" }).click();
  await page.getByLabel("Peso obiettivo (kg)").fill("61,5");
  await page.getByRole("button", { name: "Salva obiettivo" }).click();
  await expect(page.getByText(/^Obiettivo salvato/).first()).toBeVisible();

  await page.goto("/progress");
  await expect(page.getByRole("region", { name: "Peso obiettivo" })).toHaveText(
    "Hai raggiunto il peso obiettivo di 61,5 kg.",
  );
});
