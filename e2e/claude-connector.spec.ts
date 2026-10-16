import { createHash, randomBytes } from "node:crypto";
import { type APIRequestContext, expect, type Page, test } from "@playwright/test";
import { registerUser } from "./helpers";

const redirectUri = "https://claude.ai/api/mcp/auth_callback";

async function readCredential(page: Page, label: string) {
  const field = page.locator("div.flex-col", { has: page.getByText(label, { exact: true }) }).last();
  return (await field.locator("code").textContent())?.trim() ?? "";
}

async function callMcp(request: APIRequestContext, accessToken: string, method: string, params: object, id: number) {
  const response = await request.post("/api/mcp", {
    headers: {
      authorization: `Bearer ${accessToken}`,
      accept: "application/json, text/event-stream",
      "content-type": "application/json",
      "mcp-protocol-version": "2025-06-18",
    },
    data: { jsonrpc: "2.0", id, method, params },
  });
  expect(response.status()).toBe(200);
  const body = await response.text();
  const json = body.startsWith("{")
    ? body
    : body
        .split("\n")
        .filter((line) => line.startsWith("data:"))
        .map((line) => line.slice(5).trim())
        .at(-1)!;
  return JSON.parse(json).result;
}

function toolPayload(result: { content: { text: string }[]; isError?: boolean }) {
  expect(result.isError ?? false).toBe(false);
  return JSON.parse(result.content[0].text);
}

test("Claude logs a meal through the MCP connector", async ({ page, browser, request }) => {
  test.setTimeout(120_000);
  const { email, password } = await registerUser(page);

  await page.goto("/profile");
  await page.waitForLoadState("networkidle");
  await page.getByRole("tab", { name: "Impostazioni" }).click();
  await expect(page.getByText("http://localhost:3100/api/mcp")).toBeVisible();
  await page.getByRole("button", { name: "Crea credenziali" }).click();
  await expect(page.getByText("Client Secret", { exact: true })).toBeVisible();
  const clientId = await readCredential(page, "Client ID");
  const clientSecret = await readCredential(page, "Client Secret");
  expect(clientId).not.toBe("");
  expect(clientSecret).not.toBe("");

  const verifier = randomBytes(32).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  const authorizeUrl = new URL("http://localhost:3100/api/auth/oauth2/authorize");
  authorizeUrl.search = new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: "offline_access",
    state: "state-123",
    code_challenge: challenge,
    code_challenge_method: "S256",
    resource: "http://localhost:3100/api/mcp",
  }).toString();

  const claudeContext = await browser.newContext();
  await claudeContext.route("https://claude.ai/**", (route) => route.fulfill({ status: 200, body: "ok" }));
  const claudePage = await claudeContext.newPage();
  await claudePage.goto(authorizeUrl.toString());
  await expect(claudePage).toHaveURL(/\/login\?/);
  await claudePage.waitForLoadState("networkidle");
  await claudePage.getByLabel("Email").fill(email);
  await claudePage.getByLabel("Password", { exact: true }).fill(password);
  await claudePage.getByRole("button", { name: "Accedi" }).click();
  await expect(claudePage).toHaveURL(/\/consent\?/);
  await expect(claudePage.getByRole("heading", { name: "Collega Claude" })).toBeVisible();
  const callback = claudePage.waitForRequest(/^https:\/\/claude\.ai\/api\/mcp\/auth_callback/);
  await claudePage.getByRole("button", { name: "Consenti" }).click();
  const callbackUrl = new URL((await callback).url());
  expect(callbackUrl.searchParams.get("state")).toBe("state-123");
  const code = callbackUrl.searchParams.get("code");
  expect(code).toBeTruthy();
  await claudeContext.close();

  const tokenResponse = await request.post("/api/auth/oauth2/token", {
    headers: { authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}` },
    form: {
      grant_type: "authorization_code",
      code: code!,
      redirect_uri: redirectUri,
      code_verifier: verifier,
      resource: "http://localhost:3100/api/mcp",
    },
  });
  expect(tokenResponse.status()).toBe(200);
  const tokens = await tokenResponse.json();
  expect(tokens.refresh_token).toBeTruthy();

  const initialized = await callMcp(
    request,
    tokens.access_token,
    "initialize",
    { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "e2e", version: "1.0.0" } },
    1,
  );
  expect(initialized.serverInfo.name).toBe("bilancia");

  const tools = await callMcp(request, tokens.access_token, "tools/list", {}, 2);
  expect(tools.tools.map((tool: { name: string }) => tool.name)).toEqual(
    expect.arrayContaining(["search_foods", "log_meal", "get_day", "delete_entry", "recent_foods"]),
  );

  const search = toolPayload(
    await callMcp(request, tokens.access_token, "tools/call", { name: "search_foods", arguments: { query: "banana" } }, 3),
  );
  const banana = search.foods.find((food: { name: string }) => food.name.startsWith("Banana, cruda"));
  expect(banana).toBeTruthy();

  const logged = toolPayload(
    await callMcp(
      request,
      tokens.access_token,
      "tools/call",
      {
        name: "log_meal",
        arguments: {
          meal: "breakfast",
          items: [
            { type: "food", foodId: banana.foodId, grams: 120 },
            { type: "quick", label: "Cornetto al bar", kcal: 300, carbs: 40, fat: 13, protein: 5 },
          ],
        },
      },
      4,
    ),
  );
  expect(logged.logged).toHaveLength(2);
  expect(logged.summary.meals[0].entries).toHaveLength(2);

  await page.goto("/");
  await expect(page.getByText("Cornetto al bar")).toBeVisible();
  await expect(page.getByText(/^Banana, cruda/)).toBeVisible();

  const refreshed = await request.post("/api/auth/oauth2/token", {
    headers: { authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}` },
    form: { grant_type: "refresh_token", refresh_token: tokens.refresh_token, resource: "http://localhost:3100/api/mcp" },
  });
  expect(refreshed.status()).toBe(200);

  await page.goto("/profile");
  await page.getByRole("tab", { name: "Impostazioni" }).click();
  await page.getByRole("button", { name: "Scollega" }).click();
  await expect(page.getByText("Claude scollegato")).toBeVisible();
  const revoked = await request.post("/api/auth/oauth2/token", {
    headers: { authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}` },
    form: { grant_type: "refresh_token", refresh_token: (await refreshed.json()).refresh_token },
  });
  expect(revoked.status()).toBe(401);
});
