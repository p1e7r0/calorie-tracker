import { describe, expect, it } from "vitest";
import { describePortionsLeft, describeStorage, isStorageLocation } from "./prepared-meals";

describe("describeStorage", () => {
  it("counts the days since the meal entered the fridge", () => {
    expect(describeStorage("fridge", "2026-10-22", "2026-10-22")).toEqual({ days: 0, label: "In frigo da oggi", isOld: false });
    expect(describeStorage("fridge", "2026-10-21", "2026-10-22").label).toBe("In frigo da ieri");
    expect(describeStorage("fridge", "2026-10-19", "2026-10-22")).toEqual({
      days: 3,
      label: "In frigo da 3 giorni",
      isOld: false,
    });
  });

  it("flags fridge meals older than three days", () => {
    expect(describeStorage("fridge", "2026-10-18", "2026-10-22").isOld).toBe(true);
  });

  it("uses weeks and months for the freezer and flags meals older than three months", () => {
    expect(describeStorage("freezer", "2026-10-01", "2026-10-22").label).toBe("In congelatore da 3 settimane");
    expect(describeStorage("freezer", "2026-08-01", "2026-10-22")).toEqual({
      days: 82,
      label: "In congelatore da 3 mesi",
      isOld: false,
    });
    expect(describeStorage("freezer", "2026-07-01", "2026-10-22").isOld).toBe(true);
    expect(describeStorage("freezer", "2026-09-10", "2026-10-22").label).toBe("In congelatore da 6 settimane");
  });

  it("never reports a negative age", () => {
    expect(describeStorage("fridge", "2026-10-23", "2026-10-22")).toMatchObject({ days: 0, label: "In frigo da oggi" });
  });
});

describe("describePortionsLeft", () => {
  it("agrees with the number of portions", () => {
    expect(describePortionsLeft(1)).toBe("1 porzione");
    expect(describePortionsLeft(4)).toBe("4 porzioni");
  });
});

describe("isStorageLocation", () => {
  it("accepts only fridge and freezer", () => {
    expect(isStorageLocation("fridge")).toBe(true);
    expect(isStorageLocation("freezer")).toBe(true);
    expect(isStorageLocation("pantry")).toBe(false);
    expect(isStorageLocation(undefined)).toBe(false);
  });
});
