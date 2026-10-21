import { describe, expect, it } from "vitest";
import { withoutIncompleteDays } from "./incomplete-days";

describe("withoutIncompleteDays", () => {
  it("drops the days marked as incomplete and keeps the order", () => {
    const totals = [
      { day: "2026-10-12", kcal: 2100 },
      { day: "2026-10-13", kcal: 700 },
      { day: "2026-10-14", kcal: 1900 },
    ];
    expect(withoutIncompleteDays(totals, ["2026-10-13", "2026-10-20"])).toEqual([
      { day: "2026-10-12", kcal: 2100 },
      { day: "2026-10-14", kcal: 1900 },
    ]);
    expect(withoutIncompleteDays(totals, [])).toEqual(totals);
  });
});
