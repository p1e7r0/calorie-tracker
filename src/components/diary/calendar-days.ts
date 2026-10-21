export function toLocalDate(isoDate: string) {
  return new Date(`${isoDate}T12:00:00`);
}

export function toIsoDate(date: Date) {
  return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, "0"), String(date.getDate()).padStart(2, "0")].join(
    "-",
  );
}

export const loggedDayClassName =
  "relative after:pointer-events-none after:absolute after:bottom-1 after:left-1/2 after:size-1 after:-translate-x-1/2 after:rounded-full after:bg-energy";
