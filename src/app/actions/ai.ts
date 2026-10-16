"use server";

import { z } from "zod";
import { requireUserId } from "@/lib/auth/session";
import { describeMeal, readNutritionLabel } from "@/server/ai";
import { searchFoods } from "@/server/foods";
import type { LoggableFood } from "@/server/loggable";
import type { NutritionLabel } from "@/lib/ai-schemas";
import type { ActionResult } from "./diary";

const maximumImageBytes = 4 * 1024 * 1024;
const imageTypes = ["image/jpeg", "image/png", "image/webp"] as const;

function failure(error: unknown): { ok: false; error: string } {
  if (error instanceof z.ZodError) return { ok: false, error: error.issues[0]?.message ?? "Controlla i dati." };
  if (error instanceof Error && !("status" in error)) return { ok: false, error: error.message };
  console.error(error);
  return { ok: false, error: "Il servizio AI non risponde. Riprova tra poco." };
}

export async function readLabelFromPhoto(formData: FormData): Promise<ActionResult<NutritionLabel>> {
  try {
    const userId = await requireUserId();
    const photo = formData.get("photo");
    if (!(photo instanceof File) || photo.size === 0) throw new Error("Scegli una foto dell'etichetta.");
    if (photo.size > maximumImageBytes) throw new Error("La foto è troppo grande.");
    const mediaType = imageTypes.find((type) => type === photo.type);
    if (!mediaType) throw new Error("Usa una foto in formato JPEG, PNG o WebP.");
    const data = Buffer.from(await photo.arrayBuffer()).toString("base64");
    const label = await readNutritionLabel(userId, { data, mediaType });
    if (!label.readable || label.per100.kcal === null) {
      throw new Error("Non vedo una tabella nutrizionale leggibile. Riprova con più luce e più vicino.");
    }
    return { ok: true, data: label };
  } catch (error) {
    return failure(error);
  }
}

export type MealSuggestion = {
  description: string;
  grams: number;
  estimatedKcal: number;
  candidates: LoggableFood[];
};

export async function suggestMealItems(text: string): Promise<ActionResult<MealSuggestion[]>> {
  try {
    const userId = await requireUserId();
    const description = z.string().trim().min(3, "Scrivi cosa hai mangiato.").max(500).parse(text);
    const meal = await describeMeal(userId, description);
    const suggestions = await Promise.all(
      meal.items.map(async (item) => {
        let candidates = await searchFoods(userId, item.query, 4);
        if (candidates.length === 0) {
          const shorter = item.query.split(/\s+/).slice(0, 2).join(" ");
          if (shorter !== item.query) candidates = await searchFoods(userId, shorter, 4);
        }
        return { description: item.description, grams: item.grams, estimatedKcal: item.estimatedKcal, candidates };
      }),
    );
    return { ok: true, data: suggestions };
  } catch (error) {
    return failure(error);
  }
}
