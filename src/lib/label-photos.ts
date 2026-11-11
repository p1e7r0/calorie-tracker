export const maximumLabelPhotos = 3;
export const maximumLabelPhotosBytes = 3.5 * 1024 * 1024;

export function labelPhotosProblem(sizes: readonly number[]): string | null {
  if (sizes.length === 0 || sizes.some((size) => size === 0)) return "Scegli una foto dell'etichetta.";
  if (sizes.length > maximumLabelPhotos) return `Puoi usare al massimo ${maximumLabelPhotos} foto.`;
  const total = sizes.reduce((sum, size) => sum + size, 0);
  if (total > maximumLabelPhotosBytes) return "Le foto sono troppo grandi: togline una.";
  return null;
}
