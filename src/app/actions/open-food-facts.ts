"use server";

import { z } from "zod";
import { requireUserId } from "@/lib/auth/session";
import { normalizeBarcode } from "@/lib/open-food-facts";
import { getLoggableFood } from "@/server/foods";
import type { LoggableFood } from "@/server/loggable";
import {
  fetchOpenFoodFactsProduct,
  findVisibleFoodByBarcode,
  importOpenFoodFactsCandidate,
} from "@/server/open-food-facts";
import type { ActionResult } from "./diary";

const barcodeSchema = z.string().transform((value, context) => {
  const barcode = normalizeBarcode(value);
  if (!barcode) {
    context.addIssue({ code: "custom", message: "Codice a barre non valido." });
    return z.NEVER;
  }
  return barcode;
});

function failure(error: unknown): { ok: false; error: string } {
  if (error instanceof z.ZodError) return { ok: false, error: error.issues[0]?.message ?? "Codice non valido." };
  if (error instanceof Error && error.message === "Alimento non trovato.") return { ok: false, error: error.message };
  console.error(error);
  return { ok: false, error: "Open Food Facts non risponde. Riprova tra poco." };
}

async function loggable(userId: string, foodId: string) {
  const item = await getLoggableFood(userId, foodId);
  if (!item) throw new Error("Alimento non trovato.");
  return item;
}

export async function importOpenFoodFactsFood(code: string): Promise<ActionResult<{ item: LoggableFood }>> {
  try {
    const userId = await requireUserId();
    const barcode = barcodeSchema.parse(code);
    const existing = await findVisibleFoodByBarcode(userId, barcode);
    if (existing) return { ok: true, data: { item: await loggable(userId, existing) } };
    const candidate = await fetchOpenFoodFactsProduct(barcode);
    if (!candidate) return { ok: false, error: "Prodotto senza valori nutrizionali su Open Food Facts." };
    return { ok: true, data: { item: await loggable(userId, await importOpenFoodFactsCandidate(candidate)) } };
  } catch (error) {
    return failure(error);
  }
}

export async function lookupBarcode(
  code: string,
): Promise<ActionResult<{ item: LoggableFood | null; barcode: string }>> {
  try {
    const userId = await requireUserId();
    const barcode = barcodeSchema.parse(code);
    const existing = await findVisibleFoodByBarcode(userId, barcode);
    if (existing) return { ok: true, data: { item: await loggable(userId, existing), barcode } };
    const candidate = await fetchOpenFoodFactsProduct(barcode);
    if (!candidate) return { ok: true, data: { item: null, barcode } };
    return { ok: true, data: { item: await loggable(userId, await importOpenFoodFactsCandidate(candidate)), barcode } };
  } catch (error) {
    return failure(error);
  }
}
