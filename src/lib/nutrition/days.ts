export const timeZone = "Europe/Rome";

const isoDatePattern = /^\d{4}-\d{2}-\d{2}$/;

export function isIsoDate(value: unknown): value is string {
  if (typeof value !== "string" || !isoDatePattern.test(value)) return false;
  const date = new Date(`${value}T12:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value);
}

export function todayIsoDate(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export function currentHour(now = new Date()) {
  return Number(
    new Intl.DateTimeFormat("en-GB", { timeZone, hour: "2-digit", hourCycle: "h23" }).format(now),
  );
}

export function addDays(isoDate: string, amount: number) {
  const date = new Date(`${isoDate}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + amount);
  return date.toISOString().slice(0, 10);
}

export function daysBetween(fromIsoDate: string, toIsoDate: string) {
  const from = new Date(`${fromIsoDate}T12:00:00Z`).getTime();
  const to = new Date(`${toIsoDate}T12:00:00Z`).getTime();
  return Math.round((to - from) / 86_400_000);
}

const dayFormatter = new Intl.DateTimeFormat("it-IT", {
  weekday: "short",
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});

const shortDayFormatter = new Intl.DateTimeFormat("it-IT", {
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});

export function formatDayLabel(isoDate: string, today: string) {
  const difference = daysBetween(today, isoDate);
  if (difference === 0) return "Oggi";
  if (difference === -1) return "Ieri";
  if (difference === 1) return "Domani";
  return dayFormatter.format(new Date(`${isoDate}T12:00:00Z`));
}

const longDayFormatter = new Intl.DateTimeFormat("it-IT", {
  weekday: "long",
  day: "numeric",
  month: "long",
  timeZone: "UTC",
});

export function formatLongDay(isoDate: string) {
  const label = longDayFormatter.format(new Date(`${isoDate}T12:00:00Z`));
  return label.charAt(0).toUpperCase() + label.slice(1);
}

export function formatShortDay(isoDate: string) {
  return shortDayFormatter.format(new Date(`${isoDate}T12:00:00Z`));
}
