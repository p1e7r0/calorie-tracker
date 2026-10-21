export function searchWords(query: string, limit = 6) {
  return query
    .trim()
    .split(/\s+/)
    .filter((word) => word.length > 0)
    .slice(0, limit);
}

export function allowedTypos(word: string) {
  const length = [...word].length;
  if (length < 4) return 0;
  if (length < 6) return 1;
  return 2;
}

function foldText(value: string) {
  return value.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLocaleLowerCase("it-IT");
}

export function nameMatchesQuery(name: string, query: string) {
  const foldedName = foldText(name);
  const words = searchWords(query);
  return words.length > 0 && words.every((word) => foldedName.includes(foldText(word)));
}
