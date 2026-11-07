import { mkdirSync } from "node:fs";
import { createServer } from "node:http";
import { chromium, type Browser, type BrowserContext, type Page } from "@playwright/test";
import {
  authDirectory,
  baseURL,
  desktopContext,
  driverPort,
  launchOptions,
  logIn,
  mobileContext,
  storageStatePath,
  type UserKey,
  users,
} from "./environment";
import { type NoteKind, UxRecorder } from "./recorder";

type Session = { browser: Browser; context: BrowserContext; page: Page; recorder: UxRecorder | null; user: UserKey };

let session: Session | null = null;

async function openSession(user: UserKey, desktop: boolean): Promise<Session> {
  const browser = await chromium.launch(launchOptions);
  const options = { ...(desktop ? desktopContext : mobileContext), baseURL };
  const statePath = storageStatePath(user);
  let context = await browser.newContext({ ...options, storageState: statePath }).catch(() => null);
  let page = context ? await context.newPage() : null;
  if (context && page) {
    await page.goto("/");
    if (new URL(page.url()).pathname !== "/") {
      await context.close();
      context = null;
    }
  }
  if (!context || !page) {
    context = await browser.newContext(options);
    page = await context.newPage();
    await logIn(page, users[user]);
    mkdirSync(authDirectory, { recursive: true });
    await context.storageState({ path: statePath });
  }
  return { browser, context, page, recorder: null, user };
}

function requireRecorder() {
  if (!session?.recorder) throw new Error("No scenario running: start one with «scenario <slug> [titolo]».");
  return session.recorder;
}

async function run(command: string, args: string[]) {
  if (!session) throw new Error("Driver has no browser session.");
  switch (command) {
    case "scenario": {
      const urlIndex = args.indexOf("--url");
      const url = urlIndex >= 0 ? args[urlIndex + 1] : "/";
      const [slug, ...title] = urlIndex >= 0 ? [...args.slice(0, urlIndex), ...args.slice(urlIndex + 2)] : args;
      if (!slug || !url) throw new Error("Usage: scenario <slug> [titolo] [--url /percorso]");
      if (session.recorder) session.recorder.finish();
      session.recorder = new UxRecorder(session.page, slug, title.join(" ") || slug);
      return session.recorder.begin(url);
    }
    case "tap": {
      const [x, y] = args.map(Number);
      if (Number.isFinite(x) && Number.isFinite(y) && args.length >= 2 && /^\d/.test(args[0])) {
        return requireRecorder().tapAt(x, y, args.slice(2).join(" ") || undefined);
      }
      return requireRecorder().tapText(args.join(" "));
    }
    case "type":
      return requireRecorder().type(args.join(" "));
    case "replace":
      return requireRecorder().type(args.join(" "), { replace: true });
    case "press":
      return requireRecorder().press(args[0] ?? "Enter");
    case "scroll":
      return requireRecorder().scroll(Number(args[0] ?? 400));
    case "back":
      return requireRecorder().back();
    case "wait":
      return requireRecorder().waitFor(Number(args[0] ?? 1000));
    case "shot":
      return requireRecorder().shot(args.join(" ") || undefined);
    case "note": {
      const [kind, ...text] = args;
      const kinds: NoteKind[] = ["hesitation", "dead-end", "friction", "observation"];
      if (!kinds.includes(kind as NoteKind)) throw new Error(`Usage: note <${kinds.join("|")}> <testo>`);
      return requireRecorder().note(kind as NoteKind, text.join(" "));
    }
    case "end": {
      const metrics = requireRecorder().finish();
      session.recorder = null;
      const { steps, notes, ...summary } = metrics;
      return { ...summary, steps: steps.length, notes };
    }
    case "status": {
      const metrics = session.recorder?.metrics();
      if (!metrics) return { user: session.user, url: session.page.url(), scenario: null };
      const { steps, notes, ...summary } = metrics;
      return { user: session.user, url: session.page.url(), ...summary, steps: steps.length, notes: notes.length };
    }
    case "stop": {
      if (session.recorder) session.recorder.finish();
      setTimeout(async () => {
        await session?.browser.close();
        process.exit(0);
      }, 50);
      return { stopped: true };
    }
    default:
      throw new Error(`Unknown command «${command}».`);
  }
}

async function main() {
  const user = (process.env.UX_USER as UserKey | undefined) ?? "full";
  if (!(user in users)) throw new Error(`Unknown user ${user}`);
  session = await openSession(user, process.env.UX_DESKTOP === "1");
  let queue = Promise.resolve();
  const server = createServer((request, response) => {
    if (request.method === "GET" && request.url === "/health") {
      response.writeHead(200, { "content-type": "application/json" });
      response.end(JSON.stringify({ ok: true, user: session?.user }));
      return;
    }
    let body = "";
    request.on("data", (chunk) => (body += chunk));
    request.on("end", () => {
      queue = queue.then(async () => {
        try {
          const { command, args } = JSON.parse(body) as { command: string; args: string[] };
          const result = await run(command, args ?? []);
          response.writeHead(200, { "content-type": "application/json" });
          response.end(JSON.stringify({ ok: true, result }));
        } catch (error) {
          response.writeHead(400, { "content-type": "application/json" });
          response.end(JSON.stringify({ ok: false, error: error instanceof Error ? error.message : String(error) }));
        }
      });
    });
  });
  server.listen(driverPort, "127.0.0.1", () => console.log(`UX driver ready on ${driverPort} as ${user}`));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
