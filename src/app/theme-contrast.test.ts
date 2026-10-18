import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const stylesheet = readFileSync(fileURLToPath(new URL("./globals.css", import.meta.url)), "utf8");

function themeTokens(selector: string) {
  const start = stylesheet.indexOf(`${selector} {`);
  const block = stylesheet.slice(start, stylesheet.indexOf("}", start));
  const tokens = new Map<string, string>();
  for (const match of block.matchAll(/--([\w-]+):\s*(#[0-9a-fA-F]{6});/g)) {
    tokens.set(match[1], match[2]);
  }
  return tokens;
}

function relativeLuminance(hex: string) {
  const channels = [1, 3, 5].map((offset) => {
    const value = Number.parseInt(hex.slice(offset, offset + 2), 16) / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

function contrastRatio(first: string, second: string) {
  const firstLuminance = relativeLuminance(first);
  const secondLuminance = relativeLuminance(second);
  return (Math.max(firstLuminance, secondLuminance) + 0.05) / (Math.min(firstLuminance, secondLuminance) + 0.05);
}

const themes = [
  { name: "light", tokens: themeTokens(":root") },
  { name: "dark", tokens: themeTokens(".dark") },
];

function token(tokens: Map<string, string>, name: string) {
  const value = tokens.get(name);
  if (!value) throw new Error(`Missing token --${name}`);
  return value;
}

describe.each(themes)("$name theme contrast", ({ tokens }) => {
  it.each(["background", "card", "muted", "popover"])("keeps over text readable on %s", (surface) => {
    expect(contrastRatio(token(tokens, "over-text"), token(tokens, surface))).toBeGreaterThanOrEqual(4.5);
  });

  it.each(["background", "card", "muted"])("keeps the over fill visible on %s", (surface) => {
    expect(contrastRatio(token(tokens, "over"), token(tokens, surface))).toBeGreaterThanOrEqual(3);
  });

  it("keeps the swipe delete label readable", () => {
    expect(contrastRatio("#ffffff", token(tokens, "destructive-strong"))).toBeGreaterThanOrEqual(4.5);
  });

  it("keeps the swipe duplicate label readable", () => {
    expect(
      contrastRatio(token(tokens, "secondary-foreground"), token(tokens, "secondary")),
    ).toBeGreaterThanOrEqual(4.5);
  });
});
