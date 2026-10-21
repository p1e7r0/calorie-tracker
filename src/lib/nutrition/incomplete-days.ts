export function withoutIncompleteDays<Item extends { day: string }>(
  items: readonly Item[],
  incompleteDays: readonly string[],
) {
  const excluded = new Set(incompleteDays);
  return items.filter((item) => !excluded.has(item.day));
}
