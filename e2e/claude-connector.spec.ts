import { createHash, randomBytes } from "node:crypto";
import { type APIRequestContext, type Browser, expect, type Page, test } from "@playwright/test";
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

async function connectClaude(page: Page, browser: Browser, request: APIRequestContext) {
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
  await expect(claudePage.getByText("Creare alimenti e ricette")).toBeVisible();
  await claudePage.waitForLoadState("networkidle");
  const callback = claudePage.waitForRequest(/^https:\/\/claude\.ai\/api\/mcp\/auth_callback/);
  await claudePage.getByRole("button", { name: "Consenti" }).click();
  const callbackUrl = new URL((await callback).url());
  expect(callbackUrl.searchParams.get("state")).toBe("state-123");
  const code = callbackUrl.searchParams.get("code");
  expect(code).toBeTruthy();
  await claudeContext.close();

  const tokenResponse = await request.post("/api/auth/oauth2/token", {
    form: {
      client_id: clientId,
      client_secret: clientSecret,
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
  return { clientId, clientSecret, tokens };
}

test("Claude logs a meal through the MCP connector", async ({ page, browser, request }) => {
  test.setTimeout(120_000);
  const { clientId, clientSecret, tokens } = await connectClaude(page, browser, request);

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
    form: {
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "refresh_token",
      refresh_token: tokens.refresh_token,
      resource: "http://localhost:3100/api/mcp",
    },
  });
  expect(refreshed.status()).toBe(200);

  await page.goto("/profile");
  await page.getByRole("tab", { name: "Impostazioni" }).click();
  await page.getByRole("button", { name: "Scollega" }).click();
  await expect(page.getByText("Claude scollegato")).toBeVisible();
  const revoked = await request.post("/api/auth/oauth2/token", {
    form: {
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "refresh_token",
      refresh_token: (await refreshed.json()).refresh_token,
    },
  });
  expect((await revoked.json()).error).toBe("invalid_client");
});

test("Claude creates foods and recipes, logs weight and reads progress", async ({ page, browser, request }) => {
  test.setTimeout(180_000);
  const { tokens } = await connectClaude(page, browser, request);
  let requestId = 10;
  const callTool = (name: string, toolArguments: object) =>
    callMcp(request, tokens.access_token, "tools/call", { name, arguments: toolArguments }, requestId++);
  const suffix = Date.now();
  const barcode = `29${suffix}`.slice(0, 13);

  const tools = await callMcp(request, tokens.access_token, "tools/list", {}, 2);
  expect(tools.tools.map((tool: { name: string }) => tool.name)).toEqual(
    expect.arrayContaining(["create_food", "create_recipe", "lookup_barcode", "log_weight", "get_progress", "copy_meal"]),
  );

  const oats = toolPayload(
    await callTool("create_food", {
      name: `Fiocchi d'avena ${suffix}`,
      brand: "Mulino",
      barcode,
      kcal: 372,
      protein: 13.5,
      carbs: 58.7,
      sugars: 1,
      fat: 7,
      fiber: 10,
      portions: [{ label: "1 tazza", grams: 40 }],
    }),
  );
  expect(oats).toMatchObject({ created: true, warnings: [], food: { unit: "g", own: true, per100: { kcal: 372 } } });
  expect(oats.food.portions).toEqual([{ label: "1 tazza", grams: 40 }]);

  const sameBarcode = toolPayload(
    await callTool("create_food", { name: "Avena doppia", barcode, kcal: 300, protein: 10, carbs: 50, fat: 5 }),
  );
  expect(sameBarcode).toMatchObject({ created: false, food: { foodId: oats.food.foodId } });
  const scanned = toolPayload(await callTool("lookup_barcode", { barcode }));
  expect(scanned).toMatchObject({ found: true, source: "catalog", food: { foodId: oats.food.foodId } });

  const incoherent = await callTool("create_food", {
    name: "Biscotti incoerenti",
    kcal: 450,
    protein: 6,
    carbs: 60,
    sugars: 70,
    fat: 20,
  });
  expect(incoherent.isError).toBe(true);
  expect(incoherent.content[0].text).toContain("Gli zuccheri non possono superare i carboidrati.");

  const wine = toolPayload(
    await callTool("create_food", { name: `Vino rosso ${suffix}`, unit: "ml", kcal: 85, protein: 0.1, carbs: 2.6, fat: 0 }),
  );
  expect(wine.created).toBe(true);
  expect(wine.warnings).toHaveLength(1);

  const milk = toolPayload(
    await callTool("create_food", {
      name: `Latte parzialmente scremato ${suffix}`,
      unit: "ml",
      kcal: 46,
      protein: 3.3,
      carbs: 4.9,
      fat: 1.6,
    }),
  );

  const porridge = toolPayload(
    await callTool("create_recipe", {
      name: `Porridge ${suffix}`,
      servings: 2,
      cookedWeightG: 600,
      ingredients: [
        { foodId: oats.food.foodId, grams: 80 },
        { foodId: milk.food.foodId, grams: 400 },
      ],
    }),
  );
  expect(porridge).toMatchObject({
    warnings: [],
    recipe: { servings: 2, cookedWeightG: 600, rawWeightG: null, perServing: { kcal: 241 } },
  });

  const rawOnly = toolPayload(
    await callTool("create_recipe", {
      name: `Avena e latte ${suffix}`,
      servings: 1,
      ingredients: [
        { foodId: oats.food.foodId, grams: 40 },
        { foodId: milk.food.foodId, grams: 200 },
      ],
    }),
  );
  expect(rawOnly.recipe).toMatchObject({ cookedWeightG: null, rawWeightG: 240 });
  expect(rawOnly.warnings).toHaveLength(1);

  const found = toolPayload(await callTool("search_foods", { query: `porridge ${suffix}` }));
  expect(found.recipes.map((recipe: { recipeId: string }) => recipe.recipeId)).toContain(porridge.recipe.recipeId);

  const breakfast = toolPayload(
    await callTool("log_meal", {
      meal: "breakfast",
      items: [{ type: "recipe", recipeId: porridge.recipe.recipeId, servings: 1 }],
    }),
  );
  expect(breakfast.logged).toEqual([expect.objectContaining({ label: `Porridge ${suffix}`, kcal: 241 })]);

  await page.goto("/");
  await page.waitForLoadState("networkidle");
  const breakfastSection = page.getByRole("region", { name: "Colazione" });
  await breakfastSection.getByRole("button", { name: "Altre azioni per colazione" }).click();
  await page.getByRole("menuitem", { name: "Salva come pasto" }).click();
  await page.getByLabel("Nome del pasto").fill("Colazione solita");
  await page.getByRole("button", { name: "Salva pasto" }).click();
  await expect(page.getByText("«Colazione solita» salvato con 1 voce")).toBeVisible();

  const usual = toolPayload(await callTool("search_foods", { query: "solita colazione" }));
  expect(usual.savedMeals).toEqual([
    expect.objectContaining({ name: "Colazione solita", meal: "breakfast", kcal: 241 }),
  ]);
  const recent = toolPayload(await callTool("recent_foods", {}));
  expect(recent.savedMeals).toHaveLength(1);
  const again = toolPayload(
    await callTool("log_meal", { items: [{ type: "savedMeal", savedMealId: usual.savedMeals[0].savedMealId }] }),
  );
  expect(again.meal).toBe("breakfast");
  expect(again.summary.meals[0].entries).toHaveLength(2);

  const weight = toolPayload(await callTool("log_weight", { weightKg: 81.5 }));
  expect(weight).toMatchObject({ logged: true, weightKg: 81.5, trend: { latest: { kg: 81.5 } } });
  const repeated = toolPayload(await callTool("log_weight", { weightKg: 81.5 }));
  expect(repeated.logged).toBe(false);
  const future = await callTool("log_weight", { weightKg: 81, day: "2999-01-01" });
  expect(future.isError).toBe(true);

  const progress = toolPayload(await callTool("get_progress", { days: 7 }));
  expect(progress.days).toEqual([expect.objectContaining({ kcal: 482 })]);
  expect(progress.average).toBeNull();
  expect(progress.weight.inPeriod).toHaveLength(1);
  expect(progress.maintenance.status).toBe("insufficient");

  const copied = toolPayload(
    await callTool("copy_meal", { fromDay: again.summary.day, fromMeal: "breakfast", toMeal: "snack" }),
  );
  expect(copied.copied).toHaveLength(2);
  expect(copied.meal).toBe("snack");
  expect(copied.summary.meals[3].entries).toHaveLength(2);
  const sameMeal = await callTool("copy_meal", { fromDay: again.summary.day, fromMeal: "breakfast" });
  expect(sameMeal.isError).toBe(true);

  await page.goto("/food");
  await page.waitForLoadState("networkidle");
  await page.getByRole("searchbox", { name: "Cerca nel catalogo" }).fill(`Fiocchi d'avena ${suffix}`);
  await expect(page.getByRole("link", { name: new RegExp(`^Fiocchi d'avena ${suffix}`) })).toBeVisible();
});
