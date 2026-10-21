import { describe, expect, it } from "vitest";
import { allowedTypos, nameMatchesQuery, searchWords } from "./search";

describe("searchWords", () => {
  it("splits on whitespace and caps the number of words", () => {
    expect(searchWords("  pane   bigio ")).toEqual(["pane", "bigio"]);
    expect(searchWords("a b c d e f g h", 3)).toEqual(["a", "b", "c"]);
    expect(searchWords("   ")).toEqual([]);
  });
});

describe("allowedTypos", () => {
  it("allows no typos in short words", () => {
    expect(allowedTypos("uva")).toBe(0);
  });

  it("allows one typo in medium words", () => {
    expect(allowedTypos("ceci")).toBe(1);
    expect(allowedTypos("latte")).toBe(1);
  });

  it("allows two typos in long words", () => {
    expect(allowedTypos("prosiuto")).toBe(2);
  });

  it("counts accented characters once", () => {
    expect(allowedTypos("caffè")).toBe(1);
  });
});

describe("nameMatchesQuery", () => {
  it("matches every word in any order, ignoring case and accents", () => {
    expect(nameMatchesQuery("Colazione solita", "solita colazione")).toBe(true);
    expect(nameMatchesQuery("Caffè e brioche", "CAFFE")).toBe(true);
    expect(nameMatchesQuery("Colazione solita", "pranzo solito")).toBe(false);
  });

  it("matches nothing with an empty query", () => {
    expect(nameMatchesQuery("Colazione", "  ")).toBe(false);
  });
});
