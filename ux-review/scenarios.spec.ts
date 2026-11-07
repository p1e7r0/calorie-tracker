import { expect, type Locator, type Page, test } from "@playwright/test";
import { currentHour } from "../src/lib/nutrition/days";
import { mealLabels, suggestMeal, type MealType } from "../src/lib/nutrition/meals";
import { storageStatePath } from "./environment";
import { UxRecorder } from "./recorder";

test.describe.configure({ mode: "serial" });

const searchLabel = "Cerca un alimento o una ricetta";

async function isFocused(locator: Locator) {
  return locator.evaluate((element) => element === document.activeElement).catch(() => false);
}

function visible(locator: Locator) {
  return locator.filter({ visible: true }).first();
}

async function focusField(recorder: UxRecorder, locator: Locator, label: string) {
  const target = visible(locator);
  if (!(await isFocused(target))) await recorder.tapLocator(target, label);
}

async function selectMeal(recorder: UxRecorder, page: Page, meal: MealType) {
  const tab = page.getByRole("radio", { name: mealLabels[meal], exact: true }).or(
    page.getByRole("tab", { name: mealLabels[meal], exact: true }),
  ).or(page.getByRole("button", { name: mealLabels[meal], exact: true }));
  const target = tab.filter({ visible: true }).first();
  const selected = await target.evaluate(
    (element) =>
      element.getAttribute("aria-checked") === "true" ||
      element.getAttribute("aria-pressed") === "true" ||
      element.getAttribute("aria-selected") === "true" ||
      element.hasAttribute("data-pressed") ||
      element.getAttribute("data-state") === "on",
  );
  if (!selected) await recorder.tapLocator(target, mealLabels[meal]);
}

async function searchAndPick(recorder: UxRecorder, page: Page, query: string, resultName: string | RegExp, searchField?: Locator) {
  const field = searchField ?? page.getByRole("textbox", { name: searchLabel }).or(page.getByRole("searchbox", { name: searchLabel })).filter({ visible: true }).first();
  await focusField(recorder, field, "campo di ricerca");
  await recorder.type(query, { replace: (await visible(field).inputValue()) !== "" });
  const result = page.getByText(resultName, { exact: typeof resultName === "string" }).filter({ visible: true }).first();
  await expect(result).toBeVisible();
  await recorder.tapLocator(result, typeof resultName === "string" ? resultName : query);
}

async function replaceQuantity(recorder: UxRecorder, field: Locator, value: string) {
  await focusField(recorder, field, "quantità");
  await recorder.type(value, { replace: true });
}

async function openFoodTab(recorder: UxRecorder, page: Page, tab: "Alimenti" | "Ricette" | "Pasti") {
  const back = page.getByRole("link", { name: "Indietro" }).filter({ visible: true });
  if (await back.count()) {
    await recorder.tapLocator(back.first(), "Indietro");
  } else {
    await recorder.tapLocator(page.getByRole("link", { name: "Cibo", exact: true }), "Cibo");
  }
  await expect(page).toHaveURL(/\/food/);
  const trigger = page.getByRole("tab", { name: tab });
  if ((await trigger.getAttribute("aria-selected")) !== "true") await recorder.tapLocator(trigger, tab);
}

async function expectToast(page: Page, text: string | RegExp) {
  await expect(page.locator("[data-sonner-toast]").filter({ hasText: text }).first()).toBeVisible();
}

test.describe("utente con dati", () => {
  test.use({ storageState: storageStatePath("full") });

  test("navigazione: tempi dei cambi menu", async ({ page }) => {
    const recorder = new UxRecorder(page, "0-navigazione", "Tempi dei cambi menu");
    await recorder.begin("/");
    for (const round of ["freddo", "caldo"]) {
      for (const tab of ["Cibo", "Progressi", "Profilo", "Oggi"]) {
        await recorder.tapLocator(page.getByRole("link", { name: tab, exact: true }), `${tab} (${round})`);
      }
    }
    await recorder.tapLocator(page.getByRole("link", { name: "Giorno precedente" }), "Giorno precedente");
    await recorder.tapLocator(page.getByRole("link", { name: "Aggiungi cibo" }), "Aggiungi cibo");
    recorder.finish();
  });

  test("1. inserimento veloce: una mela", async ({ page }) => {
    const recorder = new UxRecorder(page, "1-inserimento-veloce", "Inserimento veloce: una mela");
    await recorder.begin("/");
    await recorder.tapLocator(page.getByRole("link", { name: "Aggiungi a spuntini" }), "+ Spuntini");
    const quickAdd = page.getByRole("button", { name: /^Aggiungi .* di Mela, cruda$/ }).filter({ visible: true }).first();
    await expect(quickAdd).toBeVisible();
    await recorder.tapLocator(quickAdd, "+ Mela, cruda");
    await expectToast(page, "Mela, cruda");
    recorder.note("observation", "Salvataggio con il + della riga: quantità dell'ultima volta, nessun drawer.");
    recorder.finish();
  });

  test("2. inserimento ripetuto: pasta, insalata e pane", async ({ page }) => {
    const recorder = new UxRecorder(page, "2-inserimento-ripetuto", "Inserimento ripetuto: pasta, insalata e pane a pranzo");
    await recorder.begin("/");
    await recorder.tapLocator(page.getByRole("link", { name: "Aggiungi a pranzo" }), "+ Pranzo");
    const items: [string, string][] = [
      ["pasta", "Pasta di semola, cruda"],
      ["insalata", "Insalata verde, cruda"],
      ["pane", "Pane bianco"],
    ];
    for (const [query, name] of items) {
      await searchAndPick(recorder, page, query, name);
      const confirm = page.getByRole("button", { name: "Aggiungi a pranzo" }).filter({ visible: true });
      await expect(confirm).toBeVisible();
      await recorder.tapLocator(confirm, `Aggiungi ${name}`);
      await expectToast(page, name);
      const stayed = new URL(page.url()).pathname === "/add";
      const search = page.getByRole("textbox", { name: searchLabel }).or(page.getByRole("searchbox", { name: searchLabel })).first();
      const cleared = (await search.inputValue()) === "";
      const focused = await isFocused(search);
      recorder.note(
        stayed ? "observation" : "friction",
        `Dopo «${name}»: ${stayed ? "resta su Aggiungi" : "torna indietro"}, ricerca ${cleared ? "vuota" : "piena"}, ${focused ? "con" : "senza"} focus.`,
      );
    }
    await recorder.tapLocator(page.getByRole("button", { name: "Fatto" }), "Fatto");
    recorder.finish();
  });

  test("3. correzione: quantità di ieri", async ({ page }) => {
    const recorder = new UxRecorder(page, "3-correzione", "Correzione: quantità di una voce di ieri");
    await recorder.begin("/");
    await recorder.tapLocator(page.getByRole("link", { name: "Giorno precedente" }), "Giorno precedente");
    await recorder.tapLocator(page.getByText("Riso, crudo", { exact: true }).first(), "Riso, crudo");
    await replaceQuantity(recorder, page.getByRole("dialog").getByRole("textbox").first(), "100");
    await recorder.tapLocator(page.getByRole("button", { name: "Salva" }), "Salva");
    await expect(page.getByRole("dialog")).toBeHidden();
    recorder.finish();
  });

  test("4a. pasto ricorrente: copia da ieri", async ({ page }) => {
    const recorder = new UxRecorder(page, "4a-copia-da-ieri", "Pasto ricorrente: copia la colazione di ieri");
    await recorder.begin("/");
    await recorder.tapLocator(page.getByRole("button", { name: "Altre azioni per colazione" }), "… Colazione");
    await recorder.tapText("Copia da ieri");
    await expectToast(page, /copiat|aggiunt/i);
    recorder.finish();
  });

  test("4b. pasto ricorrente: pasto salvato", async ({ page }) => {
    const recorder = new UxRecorder(page, "4b-pasto-salvato", "Pasto ricorrente: pasto salvato «Colazione solita»");
    await recorder.begin("/");
    await recorder.tapLocator(page.getByRole("link", { name: "Aggiungi a colazione" }), "+ Colazione");
    await recorder.tapLocator(page.getByRole("tab", { name: "Pasti" }), "Pasti");
    await recorder.tapLocator(page.getByText("Colazione solita", { exact: true }).first(), "Colazione solita");
    await recorder.tapText("Aggiungi tutto a colazione");
    await expectToast(page, /Colazione solita|aggiunt/i);
    recorder.finish();
  });

  for (const route of ["sezione-pasto", "pulsante-centrale"] as const) {
    test(`5. stesso inserimento da ${route}`, async ({ page }) => {
      const recorder = new UxRecorder(page, `5-${route}`, `Yogurt a spuntini da ${route === "sezione-pasto" ? "+ della sezione Spuntini" : "+ centrale"}`);
      await recorder.begin("/");
      if (route === "sezione-pasto") {
        await recorder.tapLocator(page.getByRole("link", { name: "Aggiungi a spuntini" }), "+ Spuntini");
      } else {
        await recorder.tapLocator(page.getByRole("link", { name: "Aggiungi cibo" }), "+ centrale");
        const suggested = suggestMeal(currentHour());
        recorder.note("observation", `Pasto proposto dal + centrale a quest'ora: ${mealLabels[suggested]}.`);
        await selectMeal(recorder, page, "snack");
      }
      await searchAndPick(recorder, page, "yogurt", "Yogurt naturale intero");
      await recorder.tapText("Aggiungi a spuntini");
      await expectToast(page, "Yogurt naturale intero");
      recorder.finish();
    });
  }

  test("6. catena ricette e frigo", async ({ page }) => {
    test.setTimeout(300_000);
    const recorder = new UxRecorder(page, "6-catena-ricette-frigo", "Catena: due ricette, pasto in frigo, una porzione consumata");
    await recorder.begin("/");

    async function createRecipe(name: string, ingredients: [string, string, string][], cookedWeight: string) {
      await openFoodTab(recorder, page, "Ricette");
      await recorder.tapText("Nuova ricetta");
      const nameField = visible(page.getByLabel("Nome", { exact: true }));
      await expect(nameField).toBeVisible();
      const staleName = await nameField.inputValue();
      if (staleName) {
        recorder.note(
          "friction",
          `«Nuova ricetta» riapre i dati della ricetta precedente («${staleName}»): ingredienti, nome e peso da cotto vanno svuotati a mano.`,
        );
        const removers = page.getByRole("button", { name: /^Rimuovi / }).filter({ visible: true });
        while (await removers.count()) await recorder.tapLocator(removers.first(), "Rimuovi ingrediente");
      }
      await focusField(recorder, nameField, "Nome");
      await recorder.type(name, { replace: staleName !== "" });
      for (const [query, result, grams] of ingredients) {
        await recorder.tapText("Aggiungi ingrediente");
        await searchAndPick(recorder, page, query, result, page.getByRole("textbox", { name: "Cerca un ingrediente" }).or(page.getByRole("searchbox", { name: "Cerca un ingrediente" })).first());
        await replaceQuantity(recorder, page.getByLabel("Quantità a crudo"), grams);
        await recorder.tapText("Aggiungi ingrediente");
      }
      const cookedField = visible(page.getByLabel("Peso da cotto"));
      await focusField(recorder, cookedField, "Peso da cotto");
      await recorder.type(cookedWeight, { replace: (await cookedField.inputValue()) !== "" });
      await recorder.tapText("Crea ricetta");
      await expect(page).toHaveURL(/\/recipes\/[0-9a-f-]{36}/);
    }

    await createRecipe(
      "Lenticchie in padella",
      [
        ["lenticchie", "Lenticchie, secche", "250"],
        ["cipolla", "Cipolla, cruda", "80"],
        ["carota", "Carota, cruda", "100"],
        ["sedano", "Sedano, crudo", "60"],
        ["passata", "Passata di pomodoro", "200"],
        ["olio", "Olio d'oliva extravergine", "20"],
      ],
      "900",
    );
    recorder.note("observation", "Fine ricetta 1.");
    await createRecipe("Patate al vapore", [["patate", "Patata, cruda", "800"]], "760");
    recorder.note("observation", "Fine ricetta 2. Il giorno dopo è simulato nella stessa sessione: la data di preparazione non può essere futura.");

    await openFoodTab(recorder, page, "Pasti");
    await recorder.tapText("Metti da parte un pasto");
    await focusField(recorder, page.getByLabel("Nome", { exact: true }), "Nome");
    await recorder.type("Lenticchie e patate");
    for (let portion = 1; portion < 3; portion++) {
      await recorder.tapLocator(visible(page.getByRole("button", { name: "Una porzione in più" })), "Una porzione in più");
    }
    for (const recipeName of ["Lenticchie in padella", "Patate al vapore"]) {
      await recorder.tapText("Aggiungi alimento o ricetta");
      const picker = page.getByRole("dialog", { name: "Aggiungi al pasto" });
      await searchAndPick(recorder, page, recipeName.split(" ")[0].toLowerCase(), recipeName, picker.getByRole("textbox", { name: searchLabel }).or(picker.getByRole("searchbox", { name: searchLabel })).first());
      await recorder.tapLocator(page.getByRole("button", { name: "Aggiungi al pasto" }).filter({ visible: true }).last(), `Aggiungi ${recipeName}`);
    }
    await recorder.shot("pasto pronto da mettere da parte");
    await recorder.tapText("Metti da parte");
    await expect(page.getByText("Lenticchie e patate").first()).toBeVisible();
    recorder.note("observation", "Fine conservazione in frigo.");

    await recorder.tapLocator(page.getByRole("link", { name: "Oggi", exact: true }), "Oggi");
    await recorder.tapLocator(page.getByRole("link", { name: "Aggiungi a cena" }), "+ Cena");
    await recorder.tapLocator(page.getByRole("tab", { name: "Pasti" }), "Pasti");
    await recorder.tapLocator(page.getByText("Lenticchie e patate", { exact: true }).first(), "Lenticchie e patate");
    await recorder.tapText("Aggiungi una porzione a cena");
    await expectToast(page, /Lenticchie e patate|porzione/i);
    recorder.finish();
  });
});

test.describe("utente vuoto", () => {
  test.use({ storageState: storageStatePath("empty") });

  test("stati vuoti", async ({ page }) => {
    const recorder = new UxRecorder(page, "7-stati-vuoti", "Stati vuoti con un account senza dati");
    await recorder.begin("/");
    await recorder.tapLocator(page.getByRole("link", { name: "Aggiungi cibo" }), "+ centrale");
    for (const tab of ["Preferiti", "Ricette", "Pasti"]) {
      await recorder.tapLocator(page.getByRole("tab", { name: tab }), tab);
    }
    await recorder.back();
    for (const tab of ["Cibo", "Progressi", "Profilo"]) {
      await recorder.tapLocator(page.getByRole("link", { name: tab, exact: true }), tab);
    }
    await recorder.tapLocator(page.getByRole("link", { name: "Cibo", exact: true }), "Cibo");
    for (const tab of ["Ricette", "Pasti"]) {
      await recorder.tapLocator(page.getByRole("tab", { name: tab }), tab);
    }
    recorder.finish();
  });
});
