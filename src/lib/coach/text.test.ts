import { describe, expect, it } from "vitest";
import { cleanCoachText, shortenToLength } from "./text";

describe("cleanCoachText", () => {
  it("recognizes SKIP", () => {
    expect(cleanCoachText("SKIP", "notification")).toEqual({ status: "skip" });
    expect(cleanCoachText(" skip. ", "notification")).toEqual({ status: "skip" });
    expect(cleanCoachText("", "weigh_in")).toEqual({ status: "skip" });
  });

  it("strips quotes and extra whitespace", () => {
    expect(cleanCoachText(" «62 g di proteine alle 18.\n Skyr. Adesso.» ", "notification")).toEqual({
      status: "ok",
      text: "62 g di proteine alle 18. Skyr. Adesso.",
    });
  });

  it("rejects notifications longer than 140 characters but not reports", () => {
    const long = "a".repeat(141);
    expect(cleanCoachText(long, "notification").status).toBe("too-long");
    expect(cleanCoachText(long, "weekly_report").status).toBe("ok");
  });
});

describe("shortenToLength", () => {
  it("cuts on a word boundary with an ellipsis", () => {
    const text = `${"parola ".repeat(30)}fine`;
    const shortened = shortenToLength(text);
    expect(shortened.length).toBeLessThanOrEqual(140);
    expect(shortened.endsWith("parola…")).toBe(true);
    expect(shortenToLength("breve")).toBe("breve");
  });
});
