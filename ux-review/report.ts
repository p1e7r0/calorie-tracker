import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { reportDirectory } from "./environment";
import type { ScenarioMetrics, Step } from "./recorder";

const noteLabels = {
  "dead-end": "Vicolo cieco",
  friction: "Frizione",
  hesitation: "Esitazione",
  observation: "Osservazione",
} as const;

function readScenarios() {
  if (!existsSync(reportDirectory)) return [];
  return readdirSync(reportDirectory, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && existsSync(path.join(reportDirectory, entry.name, "metrics.json")))
    .map((entry) => JSON.parse(readFileSync(path.join(reportDirectory, entry.name, "metrics.json"), "utf8")) as ScenarioMetrics)
    .sort((first, second) => first.scenario.localeCompare(second.scenario, "it", { numeric: true }));
}

function seconds(milliseconds: number) {
  return (milliseconds / 1000).toLocaleString("it-IT", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

function escapeCell(value: string) {
  return value.replaceAll("|", "\\|").replaceAll("\n", " ");
}

function summaryTable(scenarios: ScenarioMetrics[]) {
  const header = [
    "| Scenario | Tap | Campi | Tastiera | Battute | Schermate | Indietro | Scroll | Attesa app (s) | Durata (s) | Esitazioni | Vicoli ciechi |",
    "| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |",
  ];
  const rows = scenarios.map(
    (scenario) =>
      `| ${escapeCell(scenario.title)} | ${scenario.taps} | ${scenario.fields} | ${scenario.keyboardOpens} | ${scenario.keystrokes} | ${scenario.screens} | ${scenario.backs} | ${scenario.scrolls} | ${seconds(scenario.waitingMs)} | ${seconds(scenario.totalMs)} | ${scenario.hesitations} | ${scenario.deadEnds} |`,
  );
  return [...header, ...rows].join("\n");
}

function navigationTable(scenarios: ScenarioMetrics[], limit = 15) {
  const steps = scenarios.flatMap((scenario) =>
    scenario.steps
      .filter((step) => step.screenChanged || step.overlayOpened)
      .map((step) => ({ scenario: scenario.scenario, step })),
  );
  const sorted = steps.sort((first, second) => second.step.settledMs - first.step.settledMs).slice(0, limit);
  const header = [
    "| Scenario | Passo | Verso | Totale (ms) | Rete (ms) | Rendering (ms) | Richieste | Screenshot |",
    "| --- | --- | --- | ---: | ---: | ---: | ---: | --- |",
  ];
  const rows = sorted.map(
    ({ scenario, step }: { scenario: string; step: Step }) =>
      `| ${scenario} | #${step.index} ${escapeCell(`${step.action} ${step.detail}`.trim())} | ${escapeCell(step.screen)} | ${step.timedOut ? `>${step.settledMs}` : step.settledMs} | ${step.networkMs} | ${step.renderMs} | ${step.requests} | [png](${step.screenshot}) |`,
  );
  return [...header, ...rows].join("\n");
}

function menuTimingSection(scenarios: ScenarioMetrics[]) {
  const navigation = scenarios.filter((scenario) => scenario.scenario.startsWith("0-"));
  if (navigation.length === 0) return "Nessuno scenario di navigazione (slug che inizia con «0-»).\n";
  const header = ["| Passo | Verso | Totale (ms) | Rete (ms) | Rendering (ms) |", "| --- | --- | ---: | ---: | ---: |"];
  const rows = navigation.flatMap((scenario) =>
    scenario.steps
      .filter((step) => step.action !== "start" && step.action !== "shot")
      .map(
        (step) =>
          `| #${step.index} ${escapeCell(step.detail)} | ${escapeCell(step.screen)} | ${step.timedOut ? `>${step.settledMs}` : step.settledMs} | ${step.networkMs} | ${step.renderMs} |`,
      ),
  );
  return [...header, ...rows].join("\n");
}

function notesSection(scenarios: ScenarioMetrics[]) {
  const lines: string[] = [];
  for (const scenario of scenarios) {
    if (scenario.notes.length === 0) continue;
    lines.push(`### ${scenario.title}`, "");
    for (const note of scenario.notes) {
      const step = scenario.steps[note.step];
      const link = step ? ` ([#${step.index}](${step.screenshot}))` : "";
      lines.push(`- **${noteLabels[note.kind]}**${link}: ${note.text}`);
    }
    lines.push("");
  }
  return lines.length ? lines.join("\n") : "Nessuna nota registrata.\n";
}

function main() {
  const scenarios = readScenarios();
  if (scenarios.length === 0) {
    console.error(`No metrics in ${reportDirectory}: run «pnpm ux:scenarios» or the driver first.`);
    process.exitCode = 1;
    return;
  }
  const content = [
    "# Bilancia UX review: misure",
    "",
    `Generato il ${new Date().toLocaleString("it-IT", { timeZone: "Europe/Rome" })} da ${scenarios.length} scenari.`,
    "Riferimento: il connettore per Claude registra con una frase, zero tap e zero schermate.",
    "«Campi» conta le compilazioni (la stessa ricerca usata tre volte vale tre); «Tastiera» conta i passaggi del focus a un campo di testo.",
    "Regola iOS (ipotesi da verificare su iPhone, disattivabile con UX_IOS_KEYBOARD=0): se si scrive in un campo che ha il focus senza essere stato toccato, si conta un tocco in più.",
    "«Attesa app» somma i tempi di assestamento dopo ogni azione; «Durata» include il tempo di chi guida il browser.",
    "",
    "## Riepilogo per scenario",
    "",
    summaryTable(scenarios),
    "",
    "## Cambi menu in ordine",
    "",
    menuTimingSection(scenarios),
    "",
    "## Cambi di schermata più lenti",
    "",
    navigationTable(scenarios),
    "",
    "## Note registrate",
    "",
    notesSection(scenarios),
  ].join("\n");
  const target = path.join(reportDirectory, "summary.md");
  writeFileSync(target, content);
  console.log(`Wrote ${target}`);
}

main();
