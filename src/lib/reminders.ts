import type { MealType } from "./nutrition/meals";

export type PushMessage = { title: string; body: string; url: string };

export const weekdays = [
  { value: 1, label: "Lunedì" },
  { value: 2, label: "Martedì" },
  { value: 3, label: "Mercoledì" },
  { value: 4, label: "Giovedì" },
  { value: 5, label: "Venerdì" },
  { value: 6, label: "Sabato" },
  { value: 7, label: "Domenica" },
] as const;

export function isoWeekday(isoDate: string) {
  const weekday = new Date(`${isoDate}T12:00:00Z`).getUTCDay();
  return weekday === 0 ? 7 : weekday;
}

export function eveningReminder(loggedMeals: readonly MealType[]): PushMessage | null {
  if (loggedMeals.length === 0) {
    return {
      title: "Oggi non hai registrato niente",
      body: "Bastano pochi tocchi: aggiungi quello che hai mangiato oggi.",
      url: "/add",
    };
  }
  if (!loggedMeals.includes("dinner")) {
    return { title: "Manca la cena", body: "Registrala ora, finché te la ricordi.", url: "/add?meal=dinner" };
  }
  return null;
}

export function weighInReminder(weekday: number | null, today: string): PushMessage | null {
  if (weekday === null || isoWeekday(today) !== weekday) return null;
  return {
    title: "È il giorno della pesata",
    body: "Pesati a digiuno, dopo il bagno, e annota il peso.",
    url: "/progress",
  };
}
