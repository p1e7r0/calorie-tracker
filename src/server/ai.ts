import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { and, count, eq, gte } from "drizzle-orm";
import { database } from "@/db";
import { aiRequest } from "@/db/schema";
import {
  type MealDescription,
  mealDescriptionSchema,
  type NutritionLabel,
  nutritionLabelSchema,
  sanitizeMealDescription,
  sanitizeNutritionLabel,
} from "@/lib/ai-schemas";

export const isAiEnabled = Boolean(process.env.ANTHROPIC_API_KEY);

const model = process.env.ANTHROPIC_MODEL ?? "claude-haiku-5-5";
const dailyRequestLimit = 40;

let client: Anthropic | null = null;

function anthropic() {
  if (!isAiEnabled) throw new Error("Le funzioni AI non sono attive.");
  client ??= new Anthropic();
  return client;
}

async function recordRequest(userId: string, kind: (typeof aiRequest.$inferInsert)["kind"]) {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const [{ total }] = await database
    .select({ total: count() })
    .from(aiRequest)
    .where(and(eq(aiRequest.userId, userId), gte(aiRequest.createdAt, since)));
  if (total >= dailyRequestLimit) {
    throw new Error("Hai usato tutte le richieste AI di oggi. Riprova domani.");
  }
  await database.insert(aiRequest).values({ userId, kind });
}

const labelInstructions = `Leggi la tabella nutrizionale nella foto di un'etichetta alimentare.
Riporta i valori per 100 g (o 100 ml per i liquidi). Se l'etichetta indica solo i valori per porzione, convertili in valori per 100 usando il peso della porzione.
Le kcal sono in kcal, non in kJ: se c'è solo il valore in kJ, dividi per 4,184.
Il sale è in grammi; se c'è solo il sodio, moltiplicalo per 2,5.
Usa null per i valori che non si leggono. Non inventare numeri.
Nome e marca: copiali dalla confezione se si vedono, altrimenti null.
Porzione: se l'etichetta indica una porzione (es. «1 vasetto = 125 g»), riportala con un'etichetta breve in italiano; altrimenti null.
readable è false se la foto non mostra una tabella nutrizionale leggibile.`;

export async function readNutritionLabel(
  userId: string,
  image: { data: string; mediaType: "image/jpeg" | "image/png" | "image/webp" },
): Promise<NutritionLabel> {
  await recordRequest(userId, "nutrition_label");
  const message = await anthropic().messages.parse({
    model,
    max_tokens: 1024,
    messages: [
      {
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: image.mediaType, data: image.data } },
          { type: "text", text: labelInstructions },
        ],
      },
    ],
    output_config: { format: zodOutputFormat(nutritionLabelSchema) },
  });
  if (!message.parsed_output) throw new Error("Non sono riuscito a leggere l'etichetta.");
  return sanitizeNutritionLabel(message.parsed_output);
}

const mealInstructions = `Dividi la descrizione di un pasto in singoli alimenti.
Per ogni alimento:
- description: come l'ha scritto la persona, breve;
- query: il nome da cercare in una banca dati nutrizionale italiana, generico e al singolare (es. «pasta di semola cotta», «parmigiano», «mela cruda», «olio d'oliva»);
- grams: il peso in grammi della parte mangiata; se non è indicato, stima una porzione tipica italiana (un cucchiaio d'olio = 10 g, una mela = 150 g, un piatto di pasta = 80 g da crudo o 200 g da cotta);
- estimatedKcal: una stima delle kcal di quella quantità.
Per un piatto composto (es. pasta al pomodoro) separa gli ingredienti principali se la persona li indica, altrimenti usa il piatto intero.
Ignora tutto ciò che non è cibo o bevanda.`;

export async function describeMeal(userId: string, text: string): Promise<MealDescription> {
  await recordRequest(userId, "meal_description");
  const message = await anthropic().messages.parse({
    model,
    max_tokens: 2048,
    system: mealInstructions,
    messages: [{ role: "user", content: text }],
    output_config: { format: zodOutputFormat(mealDescriptionSchema) },
  });
  if (!message.parsed_output) throw new Error("Non sono riuscito a capire il pasto. Prova a scriverlo diversamente.");
  return sanitizeMealDescription(message.parsed_output);
}
