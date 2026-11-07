import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { ElementHandle, Locator, Page, Request } from "@playwright/test";
import { reportDirectory } from "./environment";

export type NoteKind = "hesitation" | "dead-end" | "friction" | "observation";

export type Step = {
  index: number;
  action: string;
  detail: string;
  url: string;
  screen: string;
  screenChanged: boolean;
  overlayOpened: boolean;
  keyboardOpened: boolean;
  settledMs: number;
  networkMs: number;
  renderMs: number;
  requests: number;
  timedOut: boolean;
  screenshot: string;
};

export type Note = { step: number; kind: NoteKind; text: string };

export type ScenarioMetrics = {
  scenario: string;
  title: string;
  startedAt: string;
  taps: number;
  fields: number;
  keyboardOpens: number;
  keystrokes: number;
  screens: number;
  screensVisited: string[];
  backs: number;
  scrolls: number;
  totalMs: number;
  waitingMs: number;
  hesitations: number;
  deadEnds: number;
  steps: Step[];
  notes: Note[];
};

type TrackedRequest = { startedAt: number; endedAt: number | null; resourceType: string };

const quietWindowMs = 300;
const settleTimeoutMs = 15_000;
const trackedResourceTypes = new Set(["document", "fetch", "xhr", "script", "stylesheet", "image", "font"]);

export function slugify(value: string) {
  return (
    value
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 40) || "step"
  );
}


export class UxRecorder {
  readonly directory: string;
  private readonly requests = new Map<Request, TrackedRequest>();
  private readonly steps: Step[] = [];
  private readonly notes: Note[] = [];
  private fills = 0;
  private lastTypedField: string | null = null;
  private touchFocusedField: string | null = null;
  private readonly visited: string[] = [];
  private readonly startedAt = new Date();
  private readonly startedClock = performance.now();
  private taps = 0;
  private keystrokes = 0;
  private keyboardOpens = 0;
  private screens = 0;
  private backs = 0;
  private scrolls = 0;
  private keyboardOpen = false;
  private overlayCount = 0;
  private currentScreen = "";
  private finished: ScenarioMetrics | null = null;

  constructor(
    readonly page: Page,
    readonly scenario: string,
    readonly title = scenario,
    readonly iosKeyboardRule = process.env.UX_IOS_KEYBOARD !== "0",
  ) {
    this.directory = path.join(reportDirectory, scenario);
    rmSync(this.directory, { recursive: true, force: true });
    mkdirSync(this.directory, { recursive: true });
    page.on("request", this.onRequestStarted);
    page.on("requestfinished", this.onRequestEnded);
    page.on("requestfailed", this.onRequestEnded);
  }

  private readonly onRequestStarted = (request: Request) => {
    if (!trackedResourceTypes.has(request.resourceType())) return;
    if (request.url().startsWith("data:")) return;
    this.requests.set(request, { startedAt: performance.now(), endedAt: null, resourceType: request.resourceType() });
  };

  private readonly onRequestEnded = (request: Request) => {
    const tracked = this.requests.get(request);
    if (tracked) tracked.endedAt = performance.now();
  };

  async begin(url = "/") {
    const startedAt = performance.now();
    await this.page.goto(url);
    await this.installObserver();
    this.currentScreen = await this.screenKey();
    this.visited.push(this.currentScreen);
    this.overlayCount = await this.countOverlays();
    return this.record("start", url, startedAt, { countScreen: false });
  }

  private async installObserver() {
    await this.page.evaluate(() => {
      const target = window as unknown as { uxLastMutation?: number; uxObserver?: MutationObserver };
      if (target.uxObserver) return;
      target.uxLastMutation = performance.now();
      target.uxObserver = new MutationObserver(() => {
        target.uxLastMutation = performance.now();
      });
      target.uxObserver.observe(document, { subtree: true, childList: true, attributes: true, characterData: true });
    }).catch(() => undefined);
  }

  private async millisecondsSinceMutation() {
    return this.page
      .evaluate(() => {
        const target = window as unknown as { uxLastMutation?: number };
        return target.uxLastMutation === undefined ? Number.POSITIVE_INFINITY : performance.now() - target.uxLastMutation;
      })
      .catch(() => 0);
  }

  private async settle(actionStartedAt: number) {
    const deadline = actionStartedAt + settleTimeoutMs;
    let settledAt = performance.now();
    let timedOut = false;
    while (true) {
      await this.installObserver();
      const now = performance.now();
      const relevant = [...this.requests.values()].filter((request) => request.startedAt >= actionStartedAt - 5);
      const pending = relevant.filter((request) => request.endedAt === null);
      const lastRequestEnd = Math.max(actionStartedAt, ...relevant.map((request) => request.endedAt ?? now));
      const sinceMutation = await this.millisecondsSinceMutation();
      const lastMutation = Number.isFinite(sinceMutation) ? performance.now() - sinceMutation : actionStartedAt;
      if (pending.length === 0 && now - lastRequestEnd >= quietWindowMs && sinceMutation >= quietWindowMs) {
        settledAt = Math.max(actionStartedAt, lastRequestEnd, lastMutation);
        break;
      }
      if (now > deadline) {
        settledAt = now;
        timedOut = true;
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    const relevant = [...this.requests.values()].filter(
      (request) => request.startedAt >= actionStartedAt - 5 && request.startedAt <= settledAt,
    );
    const dataRequests = relevant.filter((request) => request.resourceType === "fetch" || request.resourceType === "xhr" || request.resourceType === "document");
    const networkEnd = Math.max(actionStartedAt, ...dataRequests.map((request) => request.endedAt ?? settledAt));
    const settledMs = Math.round(settledAt - actionStartedAt);
    const networkMs = Math.round(Math.min(networkEnd, settledAt) - actionStartedAt);
    return { settledMs, networkMs, renderMs: Math.max(0, settledMs - networkMs), requests: relevant.length, timedOut };
  }

  private async screenKey() {
    const pathname = new URL(this.page.url()).pathname;
    const title = await this.page
      .evaluate(() => {
        const headings = [...document.querySelectorAll("h1, h2")].filter((heading) => {
          const box = heading.getBoundingClientRect();
          if (box.width < 2 || box.height < 2 || box.top > 120) return false;
          const hit = document.elementFromPoint(box.left + Math.min(box.width / 2, 20), box.top + box.height / 2);
          return hit !== null && (heading === hit || heading.contains(hit));
        });
        return headings[0]?.textContent?.trim() ?? "";
      })
      .catch(() => "");
    return title ? `${pathname} · ${title}` : pathname;
  }

  private async countOverlays() {
    return this.page
      .locator('[role="dialog"]:visible, [role="alertdialog"]:visible, [role="menu"]:visible, [role="listbox"]:visible')
      .count()
      .catch(() => 0);
  }

  private async focusedEditable() {
    return this.page
      .evaluate(() => {
        const element = document.activeElement as HTMLElement | null;
        if (!element) return null;
        const textTypes = ["text", "search", "email", "number", "tel", "password", "url", ""];
        const editable =
          element.isContentEditable ||
          element.tagName === "TEXTAREA" ||
          (element.tagName === "INPUT" && textTypes.includes((element as HTMLInputElement).type));
        if (!editable) return null;
        return (
          element.getAttribute("aria-label") ||
          element.getAttribute("name") ||
          element.id ||
          element.getAttribute("placeholder") ||
          element.tagName
        );
      })
      .catch(() => null);
  }

  private async record(
    action: string,
    detail: string,
    actionStartedAt: number,
    { countScreen = true, tapTarget }: { countScreen?: boolean; tapTarget?: ElementHandle<Node> | null } = {},
  ) {
    const timing = await this.settle(actionStartedAt);
    const touchedFocus = tapTarget !== undefined && (await this.focusLandedOn(tapTarget));
    const screen = await this.screenKey();
    const screenChanged = countScreen && screen !== this.currentScreen;
    if (screenChanged) {
      this.screens++;
      this.visited.push(screen);
      this.currentScreen = screen;
    }
    const overlays = await this.countOverlays();
    const overlayOpened = countScreen && !screenChanged && overlays > this.overlayCount;
    if (overlayOpened) {
      this.screens++;
      this.visited.push(`${screen} (overlay)`);
    }
    this.overlayCount = overlays;
    const focused = await this.focusedEditable();
    const keyboardOpened = focused !== null && !this.keyboardOpen;
    if (keyboardOpened) this.keyboardOpens++;
    this.keyboardOpen = focused !== null;
    const focusedKey = focused === null ? null : `${this.currentScreen}|${focused}`;
    if (focusedKey === null || touchedFocus) this.touchFocusedField = focusedKey;
    else if (focusedKey !== this.touchFocusedField) this.touchFocusedField = null;
    if (action !== "type") this.lastTypedField = null;

    const index = this.steps.length;
    const screenshot = path.join(this.directory, `${String(index).padStart(2, "0")}-${slugify(`${action} ${detail}`)}.png`);
    await this.page.screenshot({ path: screenshot });
    const step: Step = {
      index,
      action,
      detail,
      url: this.page.url(),
      screen,
      screenChanged,
      overlayOpened,
      keyboardOpened,
      ...timing,
      screenshot: path.relative(reportDirectory, screenshot),
    };
    this.steps.push(step);
    return step;
  }

  private async focusLandedOn(target: ElementHandle<Node> | null) {
    if (!target) return false;
    return target
      .evaluate((node) => {
        const active = document.activeElement;
        if (!active || active === document.body || !node.isConnected) return false;
        const element = node instanceof Element ? node : node.parentElement;
        if (!element) return false;
        const label = element.closest("label");
        return active === element || element.contains(active) || (label !== null && label.control === active);
      })
      .catch(() => false);
  }

  async tapAt(x: number, y: number, label = `${x},${y}`) {
    const target = await this.page
      .evaluateHandle(({ x, y }) => document.elementFromPoint(x, y), { x, y })
      .then((handle) => handle.asElement())
      .catch(() => null);
    this.taps++;
    const startedAt = performance.now();
    await this.page.touchscreen.tap(x, y);
    return this.record("tap", label, startedAt, { tapTarget: target });
  }

  async tapLocator(locator: Locator, label: string) {
    await locator.scrollIntoViewIfNeeded({ timeout: 15_000 });
    const target = await locator.elementHandle({ timeout: 15_000 }).catch(() => null);
    this.taps++;
    const startedAt = performance.now();
    await locator.tap({ timeout: 15_000 });
    return this.record("tap", label, startedAt, { tapTarget: target });
  }

  async findByVisibleText(text: string) {
    const exact = { name: text, exact: true };
    const candidates = [
      this.page.getByRole("button", exact),
      this.page.getByRole("link", exact),
      this.page.getByRole("option", exact),
      this.page.getByRole("menuitem", exact),
      this.page.getByRole("tab", exact),
      this.page.getByRole("radio", exact),
      this.page.getByRole("checkbox", exact),
      this.page.getByRole("switch", exact),
      this.page.getByRole("combobox", exact),
      this.page.getByRole("textbox", exact),
      this.page.getByRole("spinbutton", exact),
      this.page.getByRole("searchbox", exact),
      this.page.getByLabel(text, { exact: true }),
      this.page.getByText(text, { exact: true }),
      this.page.getByRole("button", { name: text }),
      this.page.getByRole("link", { name: text }),
      this.page.getByText(text),
    ];
    for (const candidate of candidates) {
      const visible = candidate.filter({ visible: true });
      const count = await visible.count();
      if (count === 0) continue;
      const onTop: Locator[] = [];
      for (let index = 0; index < count; index++) {
        const element = visible.nth(index);
        if (await this.isOnTop(element)) onTop.push(element);
      }
      if (onTop.length === 1) return onTop[0];
      if (onTop.length > 1) {
        throw new Error(`«${text}» matches ${onTop.length} visible elements: tap by coordinates instead.`);
      }
    }
    throw new Error(`Nothing visible and uncovered matches «${text}».`);
  }

  private async isOnTop(element: Locator) {
    await element.scrollIntoViewIfNeeded().catch(() => undefined);
    return element
      .evaluate((node) => {
        const box = node.getBoundingClientRect();
        if (box.width === 0 || box.height === 0) return false;
        const hit = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2);
        return hit !== null && (node === hit || node.contains(hit) || hit.contains(node));
      })
      .catch(() => false);
  }

  async tapText(text: string) {
    return this.tapLocator(await this.findByVisibleText(text), text);
  }

  async type(text: string, { replace = false }: { replace?: boolean } = {}) {
    const field = await this.focusedEditable();
    if (field === null) throw new Error("No text field has focus: tap a field first.");
    const key = `${this.currentScreen}|${field}`;
    if (this.iosKeyboardRule && this.touchFocusedField !== key) {
      this.taps++;
      this.touchFocusedField = key;
      this.note("observation", `Regola iOS: il campo «${field}» ha il focus ma non da un tocco, quindi su iPhone serve un tocco per aprire la tastiera (contato).`);
    }
    if (key !== this.lastTypedField) this.fills++;
    const startedAt = performance.now();
    if (replace) {
      await this.page.keyboard.press("ControlOrMeta+A");
      await this.page.keyboard.press("Backspace");
    }
    this.keystrokes += text.length;
    await this.page.keyboard.type(text, { delay: 15 });
    const step = await this.record("type", text, startedAt);
    this.lastTypedField = key;
    return step;
  }

  async press(key: string) {
    if (key === "Enter" || key === "Tab") this.taps++;
    const startedAt = performance.now();
    await this.page.keyboard.press(key);
    return this.record("press", key, startedAt);
  }

  async scroll(deltaY: number) {
    this.scrolls++;
    const viewport = this.page.viewportSize() ?? { width: 390, height: 844 };
    await this.page.mouse.move(viewport.width / 2, viewport.height / 2);
    const startedAt = performance.now();
    await this.page.mouse.wheel(0, deltaY);
    return this.record("scroll", String(deltaY), startedAt);
  }

  async back() {
    this.backs++;
    this.taps++;
    const startedAt = performance.now();
    await this.page.goBack();
    return this.record("back", "", startedAt);
  }

  async waitFor(milliseconds: number) {
    const startedAt = performance.now();
    await this.page.waitForTimeout(milliseconds);
    return this.record("wait", String(milliseconds), startedAt, { countScreen: false });
  }

  async shot(label = "screenshot") {
    return this.record("shot", label, performance.now(), { countScreen: false });
  }

  note(kind: NoteKind, text: string) {
    const note = { step: Math.max(0, this.steps.length - 1), kind, text };
    this.notes.push(note);
    return note;
  }

  metrics(): ScenarioMetrics {
    if (this.finished) return this.finished;
    const actionSteps = this.steps.filter((step) => step.action !== "start" && step.action !== "shot");
    return {
      scenario: this.scenario,
      title: this.title,
      startedAt: this.startedAt.toISOString(),
      taps: this.taps,
      fields: this.fills,
      keyboardOpens: this.keyboardOpens,
      keystrokes: this.keystrokes,
      screens: this.screens,
      screensVisited: this.visited,
      backs: this.backs,
      scrolls: this.scrolls,
      totalMs: Math.round(performance.now() - this.startedClock),
      waitingMs: actionSteps.reduce((total, step) => total + step.settledMs, 0),
      hesitations: this.notes.filter((note) => note.kind === "hesitation").length,
      deadEnds: this.notes.filter((note) => note.kind === "dead-end").length,
      steps: this.steps,
      notes: this.notes,
    };
  }

  finish() {
    const metrics = this.metrics();
    this.finished = metrics;
    this.page.off("request", this.onRequestStarted);
    this.page.off("requestfinished", this.onRequestEnded);
    this.page.off("requestfailed", this.onRequestEnded);
    writeFileSync(path.join(this.directory, "metrics.json"), `${JSON.stringify(metrics, null, 2)}\n`);
    return metrics;
  }
}
