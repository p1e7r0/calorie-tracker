# Bilancia

Conta le calorie in pochi tocchi. App mobile first, tema chiaro e scuro, installabile come PWA.

- Diario giornaliero con 4 pasti, riepilogo kcal, macronutrienti ed extra (fibre, zuccheri, saturi, sale) rispetto all'obiettivo, budget settimanale
- Aggiunta in un tocco: suggerimenti per pasto, preferiti, ultima quantità, «Annulla» dopo ogni aggiunta, swipe per duplicare o eliminare
- Ricerca istantanea e tollerante ai refusi nel catalogo (banca dati svizzera dei valori nutritivi + alimenti tuoi)
- Open Food Facts: ricerca automatica e codice a barre, anche per creare un alimento nuovo dal codice
- Nuovi alimenti in pochi secondi, con porzioni («1 vasetto = 125 g») e kcal calcolate dai macro
- Ricette: ingredienti pesati a crudo, peso da cotto, porzioni; si registrano in grammi di cotto o in porzioni
- Pasti salvati, copia di un pasto da qualsiasi giorno, kcal veloci, giorni segnati come incompleti
- Misure corporee (peso, massa grassa e muscolare, grasso viscerale, acqua, massa ossea, vita, fianchi) con media mobile a 7 giorni
- Obiettivo con Mifflin-St Jeor, personalizzabile, peso obiettivo con data prevista; stima adattiva del fabbisogno e check-in settimanale
- Statistiche: kcal giornaliere, media dei macronutrienti, kcal medie e peso per settimana, fabbisogno stimato
- Facoltativi: AI (etichetta da foto, pasto descritto a parole, Siri), promemoria push, esportazione CSV, connettore per Claude

Specifiche e decisioni: [`docs/spec.md`](docs/spec.md). Avanzamento: [`docs/tasks.md`](docs/tasks.md).

## Stack

Next.js 16 (App Router, Cache Components) · React 19 · Tailwind CSS 4 · shadcn/ui (Base UI) · Drizzle ORM con `pg` · Lakebase Postgres su Neon · Better Auth · Vitest · Playwright.

## Avvio in locale

```bash
pnpm install
cp .env.example .env.local   # poi compila i valori
pnpm db:migrate
pnpm dev                      # http://localhost:3100
```

Il database può essere il branch `dev` di Neon oppure Postgres in Docker:

```bash
docker compose up -d          # postgres://calorie:calorie@localhost:5433/calorie_tracker
```

### Variabili d'ambiente

| Variabile | Descrizione |
|---|---|
| `DATABASE_URL` | Connessione pooled (su Neon: host con `-pooler`), usata dall'app |
| `DATABASE_URL_UNPOOLED` | Connessione diretta, usata per le migrazioni |
| `BETTER_AUTH_SECRET` | `openssl rand -base64 32` |
| `BETTER_AUTH_URL` | URL pubblico dell'app |
| `BETTER_AUTH_TRUSTED_ORIGINS` | Facoltativa, separata da virgole: altre origini da cui accedere (per esempio il dev server sulla LAN) |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Facoltative: attivano «Continua con Google» |
| `ANTHROPIC_API_KEY` | Facoltativa: attiva la foto dell'etichetta, «Descrivi il pasto» e Siri (massimo 40 richieste al giorno per utente). `ANTHROPIC_MODEL` cambia il modello, di default `claude-haiku-5-5` |
| `RESEND_API_KEY`, `EMAIL_FROM` | Facoltative: email per il reset della password. In sviluppo, senza, il link compare nel log del server |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` | Facoltative: promemoria con notifiche push (`npx web-push generate-vapid-keys`) |
| `CRON_SECRET` | Protegge i job `/api/cron/*` dei promemoria, lanciati da Vercel Cron alle 19 e alle 6 UTC |
| `LEGACY_MONGODB_URI` | Solo per lo script di migrazione dal vecchio MongoDB |

`.env.local` punta al branch `dev`, `.env.production.local` al branch `main`. Entrambi sono esclusi da git.

## Database

| Comando | Cosa fa |
|---|---|
| `pnpm db:generate` | Genera una migrazione dallo schema in `src/db/schema.ts` |
| `pnpm db:migrate` | Applica le migrazioni al database di `.env.local` |
| `pnpm db:migrate:production` | Applica le migrazioni al branch `main` (`.env.production.local`) |
| `pnpm db:studio` | Apre Drizzle Studio |

### Migrazione dal vecchio MongoDB

Lo script è idempotente e legge il vecchio database in sola lettura.

```bash
pnpm migrate:legacy --global-only                    # solo il catalogo comune (già fatto su dev e main)
pnpm migrate:legacy --owner-email tu@example.com --dry-run
pnpm migrate:legacy --owner-email tu@example.com      # alimenti personali, ricette, preferiti, misure
pnpm migrate:legacy:production --owner-email tu@example.com
```

L'account indicato deve esistere: registrati prima dall'app.

## Qualità

```bash
pnpm lint
pnpm typecheck
pnpm test        # Vitest: logica di dominio e mappature
pnpm build
pnpm test:e2e    # Playwright su viewport mobile, avvia il dev server sulla porta 3100 e usa il database di .env.local
```

## Struttura

```
src/
  app/            route (gruppi: (app) con barra in basso, (focus) per le schermate dedicate, (auth))
  app/actions/    Server Actions, ognuna verifica la sessione
  app/api/        route handler: auth, ricerca, CSV, cron, connettore MCP, Siri
  components/     UI per funzionalità (add, diary, food, recipes, saved-meals, progress, profile, check-in)
  db/             schema Drizzle e client
  lib/            logica pura e testata (ricerca, CSV, connettore, Siri, promemoria)
  lib/nutrition/  logica di dominio: nutrienti, ricette, obiettivi, stima adattiva, budget, peso obiettivo
  server/         query e servizi server-only
scripts/          migrazione dal vecchio MongoDB
drizzle/          migrazioni SQL
e2e/              test Playwright
```

## Connettore per Claude

Bilancia espone un server MCP su `/api/mcp`, protetto da OAuth 2.1 con il plugin MCP di better-auth (`@better-auth/mcp`, token JWT legati alla risorsa, metadata su `/.well-known/oauth-protected-resource/api/mcp` e `/.well-known/oauth-authorization-server/api/auth`).

La registrazione dinamica dei client è disattivata. Per collegare Claude:

1. In Bilancia apri Profilo › Impostazioni › Claude e premi «Crea credenziali».
2. Su claude.ai apri Impostazioni › Connettori › Aggiungi connettore personalizzato, incolla l'URL del server e, nelle impostazioni avanzate, Client ID e Client Secret.
3. Premi «Connetti», accedi a Bilancia e consenti l'accesso.

«Rigenera» e «Scollega» cancellano il client e revocano i token già emessi. Sono attivi anche i Client ID Metadata Document (`@better-auth/cimd`).

| Strumento | Cosa fa |
|---|---|
| `search_foods`, `recent_foods` | Cerca alimenti, ricette e pasti salvati; elenca quelli usati di recente con l'ultima quantità |
| `log_meal` | Registra alimenti, ricette, pasti salvati o kcal veloci in un pasto |
| `get_day`, `delete_entry` | Legge il diario di un giorno ed elimina una voce |
| `copy_meal` | Copia un pasto da un giorno qualsiasi in un altro pasto o giorno |
| `lookup_barcode` | Trova un prodotto per codice a barre nel catalogo o lo importa da Open Food Facts |
| `create_food`, `create_recipe` | Crea alimenti (solo con valori forniti dall'utente) e ricette |
| `log_weight` | Registra una pesata |
| `get_progress` | Totali giornalieri, medie, budget settimanale, trend del peso e stima del fabbisogno |

## Siri

Con `ANTHROPIC_API_KEY` impostata, Profilo › Impostazioni › Siri crea un token personale (mostrato una volta, salvato solo come hash). Un Comando rapido detta il pasto e lo invia a `/api/shortcuts/meal`:

- `POST` con `Authorization: Bearer <token>` e corpo JSON `{ "text": "..." }`: registra il pasto e risponde con un campo `message` da pronunciare;
- `DELETE` sullo stesso URL: annulla l'ultima registrazione fatta da Siri nelle ultime 24 ore.

Ogni pasto usa al massimo 2 delle 40 richieste AI giornaliere.

## Deploy su Vercel

Produzione: https://bilancia-cyan.vercel.app (progetto `bilancia`, funzioni in `fra1` accanto al database Neon).

Il progetto Vercel è collegato al repository GitHub: ogni push di `main` fa il deploy in produzione. Se ci sono nuove migrazioni, applicale al database di produzione prima del push:

```bash
pnpm db:migrate:production
git push origin main
```

In alternativa, dalla cartella locale: `npx vercel@64.3.1 deploy --prod`.

Le variabili d'ambiente di produzione sono già impostate su Vercel e puntano al branch Neon `main`. `.vercelignore` impedisce di caricare i file `.env*` locali.
