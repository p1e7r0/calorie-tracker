import type { ShortcutFoodChoice, ShortcutMeal } from "./ai-schemas";
import { daysBetween, formatLongDay } from "./nutrition/days";
import { formatDecimal, formatGrams, formatKcal } from "./nutrition/format";
import type { MealType } from "./nutrition/meals";

export type ShortcutCandidate = { ref: string; foodId: string; item: number };

export type ShortcutFoodItem =
  | { type: "food"; foodId: string; grams: number; portionLabel: string | null }
  | { type: "quick"; label: string; kcal: number; protein: number; carbs: number; fat: number };

const maximumGrams = 3000;

function clamp(value: number, maximum: number) {
  return Number.isFinite(value) ? Math.max(0, Math.min(maximum, Math.round(value * 10) / 10)) : 0;
}

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export function resolveFoodChoices(
  foods: ShortcutMeal["foods"],
  candidates: readonly ShortcutCandidate[],
  choices: ShortcutFoodChoice["choices"],
): ShortcutFoodItem[] {
  return foods.map((food, index) => {
    const item = index + 1;
    const choice = choices.find((candidate) => candidate.item === item);
    const fallback: ShortcutFoodItem = {
      type: "quick",
      label: capitalize(food.description || food.query).slice(0, 80),
      kcal: food.estimatedKcal,
      protein: 0,
      carbs: 0,
      fat: 0,
    };
    if (!choice) return fallback;

    const candidate = candidates.find((option) => option.ref === choice.food?.trim() && option.item === item);
    if (candidate) {
      const grams =
        Number.isFinite(choice.grams) && choice.grams > 0 && choice.grams <= maximumGrams
          ? Math.round(choice.grams)
          : food.grams;
      return {
        type: "food",
        foodId: candidate.foodId,
        grams,
        portionLabel: choice.portionLabel?.trim().slice(0, 80) || null,
      };
    }

    const quick = choice.quick;
    if (!quick || !Number.isFinite(quick.kcal) || quick.kcal <= 0 || quick.kcal > 5000) return fallback;
    return {
      type: "quick",
      label: capitalize(quick.label.trim()).slice(0, 80) || fallback.label,
      kcal: Math.round(quick.kcal),
      protein: clamp(quick.protein, 500),
      carbs: clamp(quick.carbs, 500),
      fat: clamp(quick.fat, 500),
    };
  });
}

const mealPhrases: Record<MealType, string> = {
  breakfast: "a colazione",
  lunch: "a pranzo",
  dinner: "a cena",
  snack: "tra gli spuntini",
};

function dayPhrase(day: string, today: string) {
  const difference = daysBetween(day, today);
  if (difference === 0) return "";
  if (difference === 1) return "ieri ";
  if (difference === 2) return "l'altro ieri ";
  return `${formatLongDay(day).toLowerCase()} `;
}

export type LoggedShortcutEntry = { label: string; grams: number | null; servings: number | null; kcal: number };

function describeQuantity(entry: LoggedShortcutEntry) {
  if (entry.grams !== null) return `${formatGrams(entry.grams)} g`;
  if (entry.servings !== null) return entry.servings === 1 ? "1 porzione" : `${formatDecimal(entry.servings)} porzioni`;
  return `${formatKcal(entry.kcal)} kcal`;
}

export function describeShortcutLog({
  day,
  today,
  meal,
  entries,
  remainingKcal,
}: {
  day: string;
  today: string;
  meal: MealType;
  entries: readonly LoggedShortcutEntry[];
  remainingKcal: number | null;
}) {
  const items = entries.map((entry) => `${entry.label}, ${describeQuantity(entry)}`).join("; ");
  const total = entries.reduce((sum, entry) => sum + entry.kcal, 0);
  const sentences = [
    `Ho registrato ${dayPhrase(day, today)}${mealPhrases[meal]}: ${items}.`,
    `Totale ${formatKcal(total)} kcal.`,
  ];
  if (day === today && remainingKcal !== null) {
    sentences.push(
      remainingKcal >= 0
        ? `Ti restano ${formatKcal(remainingKcal)} kcal.`
        : `Hai superato l'obiettivo di ${formatKcal(-remainingKcal)} kcal.`,
    );
  }
  return sentences.join(" ");
}

export function describeShortcutUndo(labels: readonly string[]) {
  if (labels.length === 0) return "Non c'è niente da annullare.";
  return `Ho eliminato: ${labels.join("; ")}.`;
}
