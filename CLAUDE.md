@AGENTS.md

# Bilancia: istruzioni operative

Bilancia è un calorie tracker mobile-first, multiutente, solo in italiano (Next.js 16 + Postgres su Neon, deploy su Vercel). Contesto di prodotto, decisioni, infrastruttura e stato attuale sono in `CONTEXT.md`; specifica in `docs/spec.md`, storico dei task in `docs/tasks.md`.

## Stack
Versioni esatte in `package.json`.
- Next.js 16 (App Router, `cacheComponents: true`, `partialPrefetching: true`, Turbopack), React 19, TypeScript strict
- Tailwind CSS 4 (`@tailwindcss/turbopack`), shadcn 4 con stile `base-nova` su Base UI (`@base-ui/react`), non Radix; lucide-react, sonner, next-themes, recharts 3, react-day-picker 10, date-fns 4
- Drizzle ORM 0.45 + drizzle-kit 0.31 con `pg` (node-postgres) e `@vercel/functions` (`attachDatabasePool`)
- better-auth 1.7 (email/password, Google opzionale), zod 4
- `@anthropic-ai/sdk` (AI), `web-push` (promemoria), Resend via REST (email)
- Vitest 5, Playwright 1; pnpm 10, Node 24

## Comandi
- `pnpm dev`: dev server su porta **3100** (non 3000; Playwright e `BETTER_AUTH_URL` dipendono da questo)
- `pnpm build` / `pnpm start` (porta 3100)
- `pnpm typecheck`: `next typegen && tsc --noEmit` (serve typegen per `PageProps`, `LayoutProps`, `RouteContext`)
- `pnpm lint`: ESLint flat config (next core-web-vitals + typescript)
- `pnpm test`: Vitest (`src/**/*.test.ts`, `scripts/**/*.test.ts`)
- `pnpm test:e2e`: Playwright; singolo spec: `pnpm exec playwright test e2e/diary.spec.ts`
- `pnpm db:generate`: genera migrazione da `src/db/schema.ts` (può fare domande interattive, vedi "Database e migrazioni")
- `pnpm drizzle-kit generate --custom --name <nome>`: migrazione SQL scritta a mano
- `pnpm db:migrate`: applica a Neon **dev** (`.env.local`)
- `pnpm db:migrate:production`: applica a Neon **main** (`NODE_ENV=production`, carica `.env.production.local`)
- `pnpm db:studio`
- `pnpm migrate:legacy --owner-email <email> [--dry-run]` oppure `pnpm migrate:legacy --global-only`; `pnpm migrate:legacy:production --owner-email <email>`. Non mettere `--` prima delle opzioni: pnpm 10 lo passa allo script e `parseArgs` (strict, senza argomenti posizionali) fallisce.
- Deploy: `npx vercel@64.3.1 deploy --prod --yes` (Vercel CLI non installato globalmente)
- Opzionale: `docker compose up -d database` (Postgres 17 locale su porta **5433**, non più usato di default)

## Struttura del repository
- `src/app/(app)`: schermate con bottom nav: `/` (Oggi), `/food`, `/progress`, `/profile`
- `src/app/(focus)`: schermate senza bottom nav: `/add`, `/food/new`, `/food/[foodId]`, `/food/[foodId]/edit`, `/meals/[savedMealId]`, `/recipes/new`, `/recipes/[recipeId]`, `/recipes/[recipeId]/edit`
- `src/app/(auth)`: login, register, forgot-password, reset-password (layout scrollabile normale)
- `src/app/actions/*.ts`: server actions (`"use server"`) per dominio: diary, foods, recipes, measurements, profile, saved-meals, reminders, open-food-facts, ai
- `src/app/api`: `auth/[...all]`, `foods/search`, `open-food-facts/search`, `export/[kind]` (CSV), `cron/evening-reminder`, `cron/weigh-in-reminder`
- `src/app/manifest.ts`, `src/app/icons/*`, `src/app/apple-icon.tsx`, `public/sw.js` (PWA, solo push)
- `src/proxy.ts`: equivalente Next 16 del middleware (export `proxy`)
- `src/server/*.ts`: moduli dati `server-only` (query Drizzle, AI, push, cron, Open Food Facts); eccezione `loggable.ts`, che contiene solo i tipi `LoggableFood`/`LoggableRecipe`/`LoggableItem` importati anche dai client component con `import type`
- `src/lib/nutrition/*`: logica di dominio pura e testata (nutrienti, ricette, obiettivi, stima adattiva, budget settimanale, trend, giorni, formattazione)
- `src/lib/*`: `search`, `csv`, `ai-schemas`, `reminders`, `open-food-facts`, `safe-path`, `resize-image` (solo browser), `email`, `auth/*`
- `src/components/<feature>/`: componenti per feature; `src/components/ui/`: shadcn; `src/components/app-shell/`: shell fissa
- `src/db/schema.ts` (+ `auth-schema.ts` riesportato), `src/db/index.ts` (client)
- `drizzle/`: migrazioni SQL + `meta/` (journal e snapshot)
- `scripts/`: import legacy da MongoDB (`migrate-legacy.ts`, `legacy-mapping.ts` + test)
- `e2e/`: spec Playwright + `helpers.ts`
- `docs/spec.md`, `docs/tasks.md`

## Architettura e pattern

### Shell fissa
- Dentro `(app)` e `(focus)` la finestra non scrolla mai: `.app-viewport` è `position: fixed` con altezza `var(--viewport-height)`; scrolla solo `ScreenBody`.
- Una pagina restituisce un fragment: header (`PageHeader`, `BackHeader` o `<header className="... h-14 shrink-0">`) + `ScreenBody` + `ScreenFooter` opzionale (`src/components/app-shell/screen.tsx`).
- Ogni elemento ad altezza fissa è `shrink-0`; ogni wrapper flex tra `main` e `ScreenBody` (es. `Tabs`) richiede `min-h-0 flex-1`, altrimenti `ScreenBody` non scrolla.
- Le azioni primarie e i campi di ricerca stanno in `ScreenFooter` (in basso, stile Safari). `coversSafeArea={false}` solo quando sotto c'è la bottom nav (`FoodBrowser` su `/food`).
- I fallback di `Suspense` devono avere la stessa forma della shell (`ScreenBody` con skeleton, eventuale `ScreenFooter`).
- `VisualViewportSync` (nel root layout) scrive `--viewport-height`, `--viewport-offset-top`, `--status-bar-fallback` e `data-keyboard-open` su `<html>`; usare la variante Tailwind `in-data-keyboard-open:` o `:root[data-keyboard-open]`, non stato React.
- Utility in `globals.css`: `pt-safe`, `pb-safe`, `pb-safe-or-3`, `app-viewport`.
- I drawer vivono in un portal fuori dalla shell: `DrawerFooter` vuole `className="pb-[max(1rem,env(safe-area-inset-bottom))]"`. Pattern: montaggio condizionale, sempre `open`, `onOpenChange` che azzera lo stato del genitore.
- `e2e/shell.spec.ts` verifica la shell: lanciarlo dopo modifiche al layout.

### Componenti e stato client
- Base UI, non Radix: si compone con la prop `render` (non `asChild`); link con aspetto di bottone tramite `buttonVariants()` su `next/link`, avvolto in `cn`.
- `src/components/ui/*` importano `cn` dal pacchetto npm `cn`; il codice applicativo da `@/lib/utils`.
- `DrawerHeader` è stato modificato localmente (allineato a sinistra): rieseguire `shadcn add drawer` lo sovrascrive.
- `cacheComponents` mantiene vive le route nascoste in `<Activity>`: per resettare un form su navigazione nuova si usa `key={bfcacheId}` da `useRouter()` (`FoodForm`, `AddScreen`); i drawer aperti si chiudono nel cleanup di un `useLayoutEffect` (`MealSection`).
- Nei server component chiamare `getCurrentUser()` (accesso dinamico) prima di `new Date()`.
- Le pagine restano sincrone e avvolgono in `<Suspense>` un componente async interno.
- Valori condivisi tra client e server stanno in moduli semplici (es. `food-form-values.ts`), mai esportati da un modulo `"use client"`.

### Server actions e accesso ai dati
- Ogni action: `try/catch`, `const userId = await requireUserId()`, validazione zod (id con `z.uuid()`), ritorno `ActionResult<T>` = `{ ok: true; data } | { ok: false; error }`. Il tipo è definito in `src/app/actions/diary.ts` e importato da `./diary`.
- Le mutazioni riuscite chiamano `refresh()` da `next/cache` (non `revalidatePath`).
- Quasi ogni file di action ha il suo `failure()` (`profile.ts` gestisce l'errore inline): `diary.ts` e `reminders.ts` nascondono i messaggi zod, gli altri mostrano il primo messaggio zod, quindi i messaggi di `refine`/`min` vanno scritti in italiano. `ai.ts` e `open-food-facts.ts` trasformano gli errori esterni in un messaggio generico ("... non risponde. Riprova tra poco.").
- I moduli `src/server/*` ricevono `userId` come parametro e si fidano: mai passare un `userId` arrivato dal client.
- Pagine: `getCurrentUser()` (redirect a `/login`); action: `requireUserId()`; route handler: `auth.api.getSession({ headers: await headers() })` con 401 `{ error: "Non autenticato" }`.
- `src/proxy.ts` controlla solo la presenza del cookie di sessione e il matcher esclude `/api`: l'autenticazione vera va fatta in ogni handler e action. Nuove route pubbliche vanno in `publicPaths` o nelle esclusioni del matcher.

### Catalogo globale e cibi privati
- `food.owner_id IS NULL` = catalogo globale (fonte `swiss` o `open_food_facts`), sola lettura per gli utenti; `owner_id` valorizzato = cibo personale (fonte `user`).
- Modificare un cibo globale crea una copia personale con `replacesFoodId` (copy-on-write, `updateFood`), sposta il preferito; l'id restituito può differire da quello in ingresso.
- Ogni lettura di cibi per un utente passa da `visibleFoodCondition(userId)` (`src/server/foods.ts`): esclude archiviati e globali sostituiti dall'utente.
- Cibi e ricette si archiviano (`archived_at`), non si cancellano.
- Ricette, diario, misure, pasti salvati, push subscription sono strettamente per utente.

### Diario
- `diary_entry` salva uno snapshot dei nutrienti (kcal, proteine, carboidrati, grassi + extra fibre, zuccheri, grassi saturi, sale) calcolato da `resolveEntryValues`; `food_id`/`recipe_id` sono `ON DELETE SET NULL`. Non ricalcolare lo storico dai valori attuali.
- Tipi di voce: `food`, `recipe`, `quick` ("Kcal veloci"). Porzione ricetta in grammi (peso cotto) oppure in porzioni.
- Valori nutrizionali dei cibi per 100 g/ml.
- Giorni come stringhe ISO `yyyy-mm-dd`, fuso fisso `Europe/Rome` (`todayIsoDate()` in `src/lib/nutrition/days.ts`).

### Feature attivate da env
I flag sono costanti booleane calcolate all'avvio, non funzioni.
- AI: `isAiEnabled` (`src/server/ai.ts`) = `ANTHROPIC_API_KEY` presente (modello `ANTHROPIC_MODEL`, default `claude-haiku-5-5`; 40 richieste per utente nelle 24 h mobili, tabella `ai_request`, la riga si inserisce prima della chiamata).
- Foto etichetta: il client ridimensiona a 1600 px JPEG qualità 0.85 (`src/lib/resize-image.ts`). Il limite reale è `bodySizeLimit: "3mb"` in `next.config.ts`, non i 4 MB controllati in `actions/ai.ts`: se cambi uno dei due, allinea l'altro.
- Push: `isPushEnabled` (`src/server/push.ts`) = `NEXT_PUBLIC_VAPID_PUBLIC_KEY` + `VAPID_PRIVATE_KEY` + `VAPID_SUBJECT`.
- Google: `isGoogleSignInEnabled` (`src/lib/auth/providers.ts`) = `GOOGLE_CLIENT_ID` + `GOOGLE_CLIENT_SECRET`.
- Reset password: `isPasswordResetEnabled` (`src/lib/auth/providers.ts`) = `isEmailDeliveryConfigured` (`src/lib/email.ts`: `RESEND_API_KEY` + `EMAIL_FROM`), oppure sempre in sviluppo (il link viene stampato in console).
- Cron: `CRON_SECRET` obbligatorio (Bearer); senza, le route cron rispondono 401.
- Quando una feature è disattivata la UI la nasconde: non mostrare pulsanti che falliscono.

## Database e migrazioni
- Client: `import { database } from "@/db"`, tabelle da `@/db/schema`. `src/db/index.ts` è `server-only`: gli script tsx creano il proprio `Pool` + drizzle con `casing: "snake_case"`.
- Tabelle app: proprietà camelCase mappate in snake_case da `casing`, PK uuid, `timestamptz`. Tabelle better-auth: nomi colonna espliciti, `timestamp` senza fuso, `user.id` è `text`.
- Flusso: modifica `schema.ts` → `pnpm db:generate` → rileggi l'SQL → `pnpm db:migrate` (dev) → test → `pnpm db:migrate:production` (main) prima del deploy → verifica (query o smoke test).
- `pnpm db:generate` chiede in modo interattivo se una colonna o tabella è stata rinominata, e senza TTY fallisce ("Interactive prompts require a TTY terminal"): in una shell non interattiva evita le rinomine nello stesso passo (aggiungi la nuova colonna, migra i dati, rimuovi la vecchia) oppure scrivi l'SQL a mano con `--custom`.
- SQL non esprimibile in Drizzle: `pnpm drizzle-kit generate --custom --name <nome>` (mantiene coerenti journal e snapshot). I backfill di dati si possono accodare a una migrazione generata con separatori `--> statement-breakpoint` (vedi 0006).
- Migrazioni custom da non perdere: 0001 (`pg_trgm`, `unaccent`, funzione `search_text`, indice GIN `food_name_search_index`), 0002 (`fuzzystrmatch`, `fuzzy_word_match`), 0004 (FK `recipe_ingredient_food_id_food_id_fk` `DEFERRABLE INITIALLY DEFERRED`, serve alla cancellazione account con ricette). Gli snapshot Drizzle non le conoscono: se Drizzle rigenera quella FK, riaggiungere il `DEFERRABLE` in una migrazione custom.
- `drizzle-kit migrate` può uscire con codice 1 senza mostrare l'errore SQL: eseguire l'SQL con `pg` dentro una transazione con rollback per leggerlo.
- In `UPDATE ... FROM` una subquery `LATERAL` non può riferirsi alla tabella aggiornata.
- Le migrazioni usano `DATABASE_URL_UNPOOLED ?? DATABASE_URL` (connessione diretta); il runtime usa `DATABASE_URL` (pooled).
- `.env.production.local` deve definire **entrambe** `DATABASE_URL` e `DATABASE_URL_UNPOOLED`: in produzione vengono caricati anche i valori di `.env.local` (`loadEnvConfig` di `@next/env` in `drizzle.config.ts`; `migrate:legacy:production` passa `--env-file=.env.local` prima di quello di produzione). Se manca un URL di main, `db:migrate:production` e `migrate:legacy:production` finiscono sul branch dev. Prima di una migrazione in produzione confronta l'host dell'endpoint con `npx neonctl endpoints list --project-id <id>` senza stampare la stringa di connessione intera.
- Il pool `pg` resta su `globalThis` in sviluppo: cambiando `DATABASE_URL` riavviare il dev server.
- Strumenti Neon: skill `neon`, `neon-postgres`, `neon-postgres-branches` in `.claude/skills`, MCP `neon` in `.mcp.json`; `neonctl` solo via `npx` (l'installazione globale è bloccata). Id del progetto con `npx neonctl projects list`, poi `npx neonctl branches list --project-id <id>`; verificare che l'organizzazione sia quella personale, mai Rentobuy o quella gestita da Vercel.
- `measurement` non ha vincolo unico per giorno (solo l'indice `measurement_user_day_index`): più misure nello stesso giorno sono possibili; salvare il profilo con un peso diverso dall'ultimo crea una misura.

## Variabili d'ambiente
- Nomi in `.env.example`. Mai stampare, copiare o committare valori.
- `.env.local` → Neon branch **dev** (più `BETTER_AUTH_*`, `LEGACY_MONGODB_URI`, `VERCEL_OIDC_TOKEN`, VAPID di sviluppo, `CRON_SECRET`).
- `.env.production.local` → solo `DATABASE_URL` e `DATABASE_URL_UNPOOLED` del branch **main**.
- Produzione: variabili impostate su Vercel (progetto `bilancia`).
- Le connection string contengono `&`: non fare `source` dei file env; usare `node --env-file=.env.local` o `process.loadEnvFile()`. Per vedere i nomi: `cut -d= -f1 .env.local`.

## Test
- Unit (Vitest, ambiente node): test affiancati al sorgente in `src/lib/**` e `scripts/`. Ogni nuova logica pura va in `src/lib` con test.
- E2E (Playwright): progetto unico `mobile` (Pixel 7), test sequenziali dentro ogni file (`fullyParallel: false`) ma file eseguiti in parallelo su più worker (nessun `workers` impostato: metà dei core); per un'esecuzione seriale `pnpm test:e2e --workers=1`. Girano contro il dev server su 3100 e il **database Neon dev reale**; ogni test registra un utente nuovo `test-*@example.com` (nessuna pulizia: gli utenti si accumulano, è normale; non cancellarli in massa senza filtrare per email). Gli spec Open Food Facts usano la rete reale.
- Insidie e2e:
  - sonner mette il toast più recente **per primo** nel DOM: `.first()` o `.filter({ hasText })`;
  - route compilate al primo accesso: `page.waitForLoadState("networkidle")` prima di compilare i form; la prima compilazione può superare 30 s, usare `test.setTimeout`;
  - `getByLabel` fa match per sottostringa (anche su aria-label): `{ exact: true }` per "Kcal" e "Password" in login; regex ancorate (`/^Banana, cruda/`) perché ogni riga ha un secondo pulsante ("Aggiungi 120 g di X", "Scegli quanto di X");
  - stella preferiti: `expect(async () => ...).toPass()` per la race di idratazione;
  - formati italiani: `14.000`, `81,1kg`, `4,2 g`; `formatKcal` non raggruppa a 4 cifre (`5690`) ma sì da 5 (`13.500`); spazi variabili (`/^214\s*kcal$/`); segno meno U+2212 nei trend;
  - gli helper data degli e2e usano il fuso della macchina, l'app `Europe/Rome`;
  - Chromium headless non supporta la Push API: verificare il push lato server;
  - lo spec `ai` si salta se `ANTHROPIC_API_KEY` è impostata;
  - i test che si aspettano "nessun risultato locale" devono usare query non ancora importate da Open Food Facts nel catalogo globale.
- Verifica di un task: `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build`, e2e pertinenti, controllo visivo nel browser (anche tema scuro e larghezza mobile).

## Git
- Un branch per task: `feature/<kebab>`, `fix/<kebab>`, `chore/<kebab>`; merge in `main` con `git merge --no-ff` (messaggio di default "Merge branch '<nome>'").
- Messaggi di commit in inglese, imperativo, sentence case, senza prefisso; corpo a ~80 colonne che spiega il perché. È il formato di questo progetto: prevale su quello della skill `commit-message`.
- **Mai** trailer `Co-Authored-By` (nemmeno nei merge) né attribuzioni AI nei commit o nelle PR: l'utente lo vieta.
- Remote `origin` su GitHub (repository **pubblico**: niente segreti, email o identificativi di infrastruttura nei file committati). L'utente fa push/sync da VS Code: non fare `git push`; i branch di task restano locali. Il push non fa deploy.
- `AGENTS.md` contiene solo il blocco gestito da `next dev` (tra i marker `BEGIN/END:nextjs-agent-rules`): non modificarlo a mano. Se `next dev` lo riscrive, committa la modifica invece di annullarla. Le istruzioni di progetto vanno in questo file.

## Fine task
- Aggiungere la voce in `docs/tasks.md` (anche per i fix), aggiornare "Stato attuale", "Punti aperti e idee" e "Cronologia" in `CONTEXT.md`, e `docs/spec.md` se cambia una decisione. Committare nello stesso branch prima del merge.

## Deploy
- Dettagli del progetto (URL, regione, cron, variabili impostate) in `CONTEXT.md` › "Dati e infrastruttura". Scope sempre personale `p1e7r0s-projects`, mai il team Rentobuy.
- Deploy in produzione solo dopo conferma dell'utente (decisione Q3); se in dubbio, chiedi.
- Procedura: merge in `main` → se ci sono migrazioni `pnpm db:migrate:production` → `npx vercel@64.3.1 deploy --prod --yes` → smoke test su https://bilancia-cyan.vercel.app.
- Il CLI carica la cartella locale, non un commit: fare deploy solo da `main` con `git status` pulito, dopo il merge.
- Se manca `.vercel/project.json` (è in `.gitignore`): `npx vercel@64.3.1 link --scope p1e7r0s-projects --project bilancia`.
- Non eseguire `vercel env pull` su `.env.local`: sovrascriverebbe la configurazione del branch dev con quella di produzione.
- Smoke test in produzione con utenti `smoke-test-*@example.com` che si cancellano alla fine (Profilo › Impostazioni › Elimina l'account). In produzione c'è un solo utente reale: non toccare i suoi dati.
- Nuove variabili: impostarle su Vercel per nome (`npx vercel env add <NOME> production`); i preview deployment non hanno variabili.
- `.vercelignore` esclude i file `.env*` (tranne `.env.example`).

## Problemi noti e soluzioni
- CSS/HMR di Turbopack non aggiornato: riavviare il dev server (`rm -rf .next/dev`).
- Dopo aver lanciato un processo in background con `&` nella shell, le sostituzioni di comando successive si rompono: usare script node per i controlli HTTP.
- Accesso da LAN: `http://<ip-lan>:3100` funziona grazie a `allowedDevOrigins` e `BETTER_AUTH_TRUSTED_ORIGINS`; se cambia l'IP LAN aggiornare `BETTER_AUTH_TRUSTED_ORIGINS` in `.env.local`. La fotocamera (barcode) richiede HTTPS (`pnpm dev --experimental-https` o produzione).
- Push: il service worker `/sw.js` si registra solo quando si attivano i promemoria in Profilo › Impostazioni (`reminder-settings.tsx`); serve un contesto sicuro (localhost o HTTPS, non l'IP LAN in HTTP); su iPhone solo dalla PWA installata nella schermata Home, quindi in pratica in produzione.
- Cron in locale: script node che legge `CRON_SECRET` con `process.loadEnvFile(".env.local")` e chiama `GET /api/cron/evening-reminder` (o `weigh-in-reminder`) con header `Authorization: Bearer …` (come `e2e/reminders.spec.ts`). Non usare curl dopo `source` del file env.
- iOS 26 PWA standalone: il Liquid Glass sfoca la fascia sotto la status bar. `pt-safe` (sul `main` dei layout `(app)` e `(focus)`) aggiunge 0.75rem in `display-mode: standalone` e usa `--status-bar-fallback` (54px, impostato da `VisualViewportSync` solo in standalone a schermo intero) quando `env(safe-area-inset-top)` vale 0 (bug WebKit 301994). Gli header delle tab (`PageHeader` `h-14` centrato; header di Oggi con `pt-2 pb-2` e `DayNavigator`) devono avere il titolo alla stessa altezza: se si cambia un header, confrontarlo con gli altri nella PWA installata. Non è verificabile con Playwright né in Safari normale; la correzione di Oggi attende ancora conferma su iPhone.
- iOS Safari: `input[type=date]` ha `appearance: none` e `min-width: 0` per non uscire dalla colonna; il pulsante nativo di cancellazione di `type=search` è nascosto.
- Recharts `ReferenceLine` richiede `ifOverflow="extendDomain"` per restare visibile.
- `devIndicators: false` perché l'indicatore copriva i pulsanti.
- Budget settimanale: i giorni passati senza voci contano come "in linea con l'obiettivo".
- Stima adattiva: esclude l'introito di oggi ma include la pesata di oggi; ignora i giorni sotto 600 kcal.
- Cron su Vercel Hobby: una esecuzione al giorno, orari fissi in UTC.

## Ricerca
- Dipende dalle migrazioni 0001/0002; il filtro usa `search_text(name || ' ' || brand)` che non sfrutta l'indice GIN su `search_text(name)`.
- Tolleranza (`src/lib/search.ts` + funzione SQL `fuzzy_word_match`): parole <4 lettere solo sottostringa esatta, 4-5 lettere 1 refuso, ≥6 lettere 2 refusi; confronto fuzzy sul prefisso solo per parole ≥5 lettere; massimo 6 parole. Vale per alimenti e ricette.
- Ordine degli alimenti (`searchFoods` in `src/server/foods.ts`): corrispondenze esatte, preferiti, uso dell'utente, prefisso del nome, similarità trigram, nome più corto.
- `/api/foods/search`: query troncata a 80 caratteri, minimo 2 caratteri (altrimenti risultati vuoti).
- Importare da Open Food Facts aggiunge righe globali permanenti (`owner_id NULL`, `source open_food_facts`, `onConflictDoNothing` sull'indice `food_global_source_unique`): le query nei test cambiano esito dopo il primo import.

## Convenzioni
- Interfaccia solo in italiano, con accenti corretti, in sentence case ("Nuovo alimento", "Pasti salvati"); seconda persona singolare, tono breve; testo citato tra «».
- Tutti i messaggi per l'utente (errori, toast, aria-label, titoli, stati vuoti, email, push) in italiano.
- Numeri e date con `src/lib/nutrition/format.ts` e `days.ts` (it-IT); `parseDecimal` accetta la virgola.
- Codice, identificatori, commit in inglese; identificatori **mai abbreviati** (`value`, `index`, `button`, non `val`, `idx`, `btn`).
- Nessun commento nel codice se non richiesto; se presenti, in inglese.
- Titoli in sentence case anche nei documenti.
- Icone lucide con suffisso `Icon`; colori di dominio tramite token (`energy`, `protein`, `carbs`, `fat`, `over`, `chart-energy`) definiti in `globals.css` per entrambi i temi.
- Rispondere all'utente sempre in italiano, con accenti corretti (è, à, ù, perché), anche se la conversazione contiene testo inglese.
