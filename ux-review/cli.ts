import { spawn } from "node:child_process";
import { mkdirSync, openSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { parseArgs } from "node:util";
import { driverPort, reportDirectory } from "./environment";
import type { Step } from "./recorder";

const driverUrl = `http://127.0.0.1:${driverPort}`;

const usage = `Usage: pnpm ux <command> [args]
  start [--user full|empty] [--desktop]   open the browser (logs in once, then reuses the session)
  scenario <slug> [titolo] [--url /path]  start measuring a scenario from the home screen
  tap <testo visibile> | tap <x> <y>      tap a control by its visible text or by screenshot coordinates
  type <testo> | replace <testo>          type into the focused field (replace clears it first)
  press <tasto>                           press a key (Enter, Escape, Backspace...)
  scroll <pixel>                          scroll the screen (negative goes up)
  back                                    browser back
  wait <ms> | shot [etichetta]            wait, or take a screenshot without acting
  note <hesitation|dead-end|friction|observation> <testo>
  status | end | stop`;

async function healthy() {
  try {
    const response = await fetch(`${driverUrl}/health`);
    return response.ok;
  } catch {
    return false;
  }
}

async function start(argv: string[]) {
  const { values } = parseArgs({
    args: argv,
    options: { user: { type: "string", default: "full" }, desktop: { type: "boolean", default: false } },
  });
  if (await healthy()) {
    console.log("UX driver already running: «pnpm ux stop» first to change user or viewport.");
    return;
  }
  mkdirSync(reportDirectory, { recursive: true });
  const log = openSync(path.join(reportDirectory, "driver.log"), "a");
  const require = createRequire(__filename);
  const child = spawn(process.execPath, [require.resolve("tsx/cli"), path.join(__dirname, "driver.ts")], {
    detached: true,
    stdio: ["ignore", log, log],
    env: { ...process.env, UX_USER: values.user, UX_DESKTOP: values.desktop ? "1" : "0" },
  });
  child.unref();
  const deadline = Date.now() + 90_000;
  while (Date.now() < deadline) {
    if (await healthy()) {
      console.log(`UX driver ready as ${values.user}${values.desktop ? " (desktop)" : " (mobile 390x844)"}.`);
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`UX driver did not start: see ${path.join(reportDirectory, "driver.log")}`);
}

function isStep(value: unknown): value is Step {
  return typeof value === "object" && value !== null && "screenshot" in value && "settledMs" in value;
}

function describeStep(step: Step) {
  const flags = [
    step.screenChanged && "new screen",
    step.overlayOpened && "overlay",
    step.keyboardOpened && "keyboard",
    step.timedOut && "TIMEOUT",
  ].filter(Boolean);
  return [
    `#${step.index} ${step.action} ${step.detail}`.trim(),
    `screen ${step.screen}${flags.length ? ` [${flags.join(", ")}]` : ""}`,
    `settled ${step.settledMs} ms (network ${step.networkMs}, render ${step.renderMs}, ${step.requests} requests)`,
    `screenshot ${path.join(reportDirectory, step.screenshot)}`,
  ].join("\n");
}

async function main() {
  const [command, ...args] = process.argv.slice(2);
  if (!command || command === "help") {
    console.log(usage);
    return;
  }
  if (command === "start") return start(args);
  if (!(await healthy())) throw new Error("UX driver is not running: «pnpm ux start» first.");
  const response = await fetch(driverUrl, { method: "POST", body: JSON.stringify({ command, args }) });
  const payload = (await response.json()) as { ok: boolean; result?: unknown; error?: string };
  if (!payload.ok) {
    console.error(payload.error);
    process.exitCode = 1;
    return;
  }
  console.log(isStep(payload.result) ? describeStep(payload.result) : JSON.stringify(payload.result, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
