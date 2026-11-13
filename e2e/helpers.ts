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

const leftOddCodes = ["0001101", "0011001", "0010011", "0111101", "0100011", "0110001", "0101111", "0111011", "0110111", "0001011"];
const parityPatterns = ["LLLLLL", "LLGLGG", "LLGGLG", "LLGGGL", "LGLLGG", "LGGLLG", "LGGGLL", "LGLGLG", "LGLGGL", "LGGLGL"];

function rightCode(digit: number) {
  return [...leftOddCodes[digit]].map((bit) => (bit === "1" ? "0" : "1")).join("");
}

export function ean13WithCheckDigit(twelveDigits: string) {
  const sum = [...twelveDigits].reduce((total, digit, index) => total + Number(digit) * (index % 2 === 0 ? 1 : 3), 0);
  return `${twelveDigits}${(10 - (sum % 10)) % 10}`;
}

function ean13Modules(code: string) {
  const digits = [...code].map(Number);
  const parity = parityPatterns[digits[0]];
  const left = digits
    .slice(1, 7)
    .map((digit, index) => (parity[index] === "L" ? leftOddCodes[digit] : [...rightCode(digit)].reverse().join("")))
    .join("");
  const right = digits.slice(7).map(rightCode).join("");
  return `101${left}01010${right}101`;
}

async function photograph(page: Page, content: string) {
  const studio = await page.context().newPage();
  await studio.setViewportSize({ width: 600, height: 400 });
  await studio.setContent(`<body style="margin:0;background:#fff;display:grid;place-items:center;height:100vh">${content}</body>`);
  const buffer = await studio.screenshot({ type: "png" });
  await studio.close();
  return { name: "photo.png", mimeType: "image/png", buffer };
}

export function photographBarcode(page: Page, code: string) {
  const moduleWidth = 4;
  const bars = [...ean13Modules(code)]
    .map((bit, index) =>
      bit === "1" ? `<rect x="${(index + 11) * moduleWidth}" y="20" width="${moduleWidth}" height="200" fill="#000"/>` : "",
    )
    .join("");
  const width = (95 + 22) * moduleWidth;
  return photograph(page, `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="240">${bars}</svg>`);
}

export function photographNothing(page: Page) {
  return photograph(page, "<p style='font:24px sans-serif'>Nessun codice qui</p>");
}

export async function scanBarcodePhoto(page: Page, photo: Awaited<ReturnType<typeof photograph>>) {
  const fileChooser = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: "Scansiona codice a barre" }).click();
  await (await fileChooser).setFiles(photo);
}

export async function typeBarcodeAfterUnreadablePhoto(page: Page, barcode: string) {
  await scanBarcodePhoto(page, await photographNothing(page));
  const dialog = page.getByRole("dialog", { name: "Codice a barre non trovato" });
  await dialog.getByRole("textbox", { name: "Codice a barre" }).fill(barcode);
  await dialog.getByRole("button", { name: "Cerca", exact: true }).click();
}
