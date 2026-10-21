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
  sanitizeShortcutMeal,
  type ShortcutFoodChoice,
  shortcutFoodChoiceSchema,
  type ShortcutMeal,
  shortcutMealSchema,
} from "@/lib/ai-schemas";

export const isAiEnabled = Boolean(process.env.ANTHROPIC_API_KEY);

export class AiError extends Error {}

const model = process.env.ANTHROPIC_MODEL ?? "claude-haiku-5-5";
const dailyRequestLimit = 40;

let client: Anthropic | null = null;

function anthropic() {
  if (!isAiEnabled) throw new AiError("Le funzioni AI non sono attive.");
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
    throw new AiError("Hai usato tutte le richieste AI di oggi. Riprova domani.");
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
  if (!message.parsed_output) throw new AiError("Non sono riuscito a leggere l'etichetta.");
  return sanitizeNutritionLabel(message.parsed_output);
}

const foodItemInstructions = `- description: come l'ha scritto la persona, breve;
- query: il nome da cercare in una banca dati nutrizionale italiana, generico e al singolare (es. «pasta di semola cotta», «parmigiano», «mela cruda», «olio d'oliva»);
- grams: il peso in grammi della parte mangiata; se non è indicato, stima una porzione tipica italiana (un cucchiaio d'olio = 10 g, una mela = 150 g, un piatto di pasta = 80 g da crudo o 200 g da cotta);
- estimatedKcal: una stima delle kcal di quella quantità.
Per un piatto composto (es. pasta al pomodoro) separa gli ingredienti principali se la persona li indica, altrimenti usa il piatto intero.`;

const mealInstructions = `Dividi la descrizione di un pasto in singoli alimenti.
Per ogni alimento:
${foodItemInstructions}
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
  if (!message.parsed_output) throw new AiError("Non sono riuscito a capire il pasto. Prova a scriverlo diversamente.");
  return sanitizeMealDescription(message.parsed_output);
}

const shortcutMealInstructions = `Interpreta il messaggio che una persona ha dettato a Siri per registrare un pasto nel suo diario alimentare.
- daysAgo: 0 se il pasto è di oggi, 1 se è di ieri e così via, al massimo 7;
- meal: breakfast, lunch, dinner o snack se la persona lo dice o si capisce dal testo (es. «a cena», «a merenda»), altrimenti null;
- savedMeals: i codici (M…) dei pasti salvati che la persona nomina;
- recipes: le ricette della persona (R…) che nomina, con grams (peso cotto mangiato) oppure servings (porzioni) se li indica, altrimenti entrambi null;
- foods: tutti gli altri alimenti, uno per voce, con:
${foodItemInstructions}
Metti un alimento in recipes o savedMeals solo se corrisponde chiaramente a una voce dell'elenco; altrimenti va in foods.
Ignora tutto ciò che non è cibo o bevanda. Se il messaggio non descrive cibo, restituisci elenchi vuoti.`;

export type ShortcutMealContext = {
  text: string;
  todayLabel: string;
  hour: number;
  recipes: { ref: string; name: string; servings: number; cookedWeightG: number }[];
  savedMeals: { ref: string; name: string }[];
};

export async function interpretShortcutMeal(userId: string, context: ShortcutMealContext): Promise<ShortcutMeal> {
  await recordRequest(userId, "shortcut_meal");
  const lines = [
    `Oggi è ${context.todayLabel}, sono le ${context.hour}:00.`,
    "Ricette della persona:",
    ...(context.recipes.length > 0
      ? context.recipes.map(
          (recipe) => `${recipe.ref}: ${recipe.name} (${recipe.servings} porzioni, ${recipe.cookedWeightG} g da cotta)`,
        )
      : ["nessuna"]),
    "Pasti salvati:",
    ...(context.savedMeals.length > 0 ? context.savedMeals.map((meal) => `${meal.ref}: ${meal.name}`) : ["nessuno"]),
    `Messaggio: «${context.text}»`,
  ];
  const message = await anthropic().messages.parse({
    model,
    max_tokens: 4096,
    system: shortcutMealInstructions,
    messages: [{ role: "user", content: lines.join("\n") }],
    output_config: { effort: "low", format: zodOutputFormat(shortcutMealSchema) },
  });
  if (!message.parsed_output) throw new AiError("Non sono riuscito a capire il pasto. Prova a dirlo diversamente.");
  return sanitizeShortcutMeal(message.parsed_output);
}

const shortcutChoiceInstructions = `Per ogni alimento descritto da una persona scegli la voce migliore tra i candidati del suo catalogo e la quantità in grammi.
- Preferisci gli alimenti creati dalla persona (own), i preferiti (favorite) e quelli con lastGrams.
- Attento a crudo e cotto: pasta, riso e carne in un piatto sono cotti, a meno che la persona indichi il peso da crudo.
- grams: la quantità detta dalla persona; se ha nominato una porzione (es. «un vasetto»), usa i grammi della porzione del candidato e riportane il nome in portionLabel; altrimenti lastGrams del candidato o la stima in grams.
- food è il codice (F…) del candidato scelto, solo tra i candidati di quell'alimento.
- Se nessun candidato corrisponde, food è null e quick contiene un'etichetta breve in italiano e una stima di kcal, proteine, carboidrati e grassi (in grammi) per quella quantità.
Restituisci una scelta per ogni alimento, con item uguale al suo numero.`;

export type ShortcutChoiceItem = {
  item: number;
  description: string;
  grams: number;
  estimatedKcal: number;
  candidates: Record<string, unknown>[];
};

export async function chooseShortcutFoods(
  userId: string,
  items: ShortcutChoiceItem[],
): Promise<ShortcutFoodChoice["choices"]> {
  await recordRequest(userId, "shortcut_meal");
  const message = await anthropic().messages.parse({
    model,
    max_tokens: 4096,
    system: shortcutChoiceInstructions,
    messages: [{ role: "user", content: JSON.stringify({ foods: items }) }],
    output_config: { effort: "low", format: zodOutputFormat(shortcutFoodChoiceSchema) },
  });
  if (!message.parsed_output) throw new AiError("Non sono riuscito a scegliere gli alimenti. Riprova tra poco.");
  return message.parsed_output.choices;
}
