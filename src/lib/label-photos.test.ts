import { describe, expect, it } from "vitest";
import { labelPhotosProblem, maximumLabelPhotos, maximumLabelPhotosBytes } from "./label-photos";

describe("labelPhotosProblem", () => {
  it("accepts one to three photos within the size budget", () => {
    expect(labelPhotosProblem([400_000])).toBeNull();
    expect(labelPhotosProblem([400_000, 300_000, 500_000])).toBeNull();
  });

  it("asks for a photo when none is given or one is empty", () => {
    expect(labelPhotosProblem([])).toBe("Scegli una foto dell'etichetta.");
    expect(labelPhotosProblem([400_000, 0])).toBe("Scegli una foto dell'etichetta.");
  });

  it("rejects more photos than allowed", () => {
    const sizes = Array.from({ length: maximumLabelPhotos + 1 }, () => 100_000);
    expect(labelPhotosProblem(sizes)).toBe("Puoi usare al massimo 3 foto.");
  });

  it("rejects photos that exceed the total size budget", () => {
    const half = maximumLabelPhotosBytes / 2;
    expect(labelPhotosProblem([half, half])).toBeNull();
    expect(labelPhotosProblem([half, half, 1])).toBe("Le foto sono troppo grandi: togline una.");
  });
});
