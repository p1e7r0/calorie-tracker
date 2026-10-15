export function safeInternalPath(value: unknown, fallback: string) {
  if (typeof value === "string" && value.startsWith("/") && !value.startsWith("//") && !value.includes("\\")) {
    return value;
  }
  return fallback;
}
