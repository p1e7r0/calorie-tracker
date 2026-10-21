import { expect, test } from "@playwright/test";

test("rejects Siri shortcut requests without a valid token", async ({ request }) => {
  const forgedToken = `blc_${"a".repeat(43)}`;
  const attempts = [
    request.post("/api/shortcuts/meal", { data: { text: "una mela" } }),
    request.post("/api/shortcuts/meal", {
      headers: { authorization: `Bearer ${forgedToken}` },
      data: { text: "una mela" },
    }),
    request.post("/api/shortcuts/meal", {
      headers: { authorization: "Bearer not-a-token" },
      data: { text: "una mela" },
    }),
    request.delete("/api/shortcuts/meal", { headers: { authorization: `Bearer ${forgedToken}` } }),
  ];
  for (const response of await Promise.all(attempts)) {
    expect(response.status()).toBe(401);
    expect(await response.json()).toMatchObject({ error: "Non autenticato" });
  }
});
