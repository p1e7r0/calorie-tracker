import { describe, expect, it } from "vitest";
import { generateApiToken, hashApiToken, parseBearerToken } from "./api-token";

describe("generateApiToken", () => {
  it("creates distinct tokens that the parser accepts", () => {
    const first = generateApiToken();
    const second = generateApiToken();
    expect(first).not.toBe(second);
    expect(parseBearerToken(`Bearer ${first}`)).toBe(first);
  });
});

describe("hashApiToken", () => {
  it("returns a stable SHA-256 hex digest", () => {
    expect(hashApiToken("blc_example")).toBe(hashApiToken("blc_example"));
    expect(hashApiToken("blc_example")).toMatch(/^[0-9a-f]{64}$/);
    expect(hashApiToken("blc_example")).not.toBe(hashApiToken("blc_other"));
  });
});

describe("parseBearerToken", () => {
  const token = `blc_${"a".repeat(43)}`;

  it("accepts the bearer scheme in any case", () => {
    expect(parseBearerToken(`bearer ${token}`)).toBe(token);
  });

  it("rejects missing headers, other schemes and malformed tokens", () => {
    expect(parseBearerToken(null)).toBeNull();
    expect(parseBearerToken(token)).toBeNull();
    expect(parseBearerToken(`Basic ${token}`)).toBeNull();
    expect(parseBearerToken(`Bearer ${token}x`)).toBeNull();
    expect(parseBearerToken(`Bearer ${"a".repeat(47)}`)).toBeNull();
  });
});
