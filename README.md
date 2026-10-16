# Bilancia

Conta le calorie in pochi tocchi. App mobile first, tema chiaro e scuro, installabile come PWA.

- Diario giornaliero con 4 pasti, riepilogo kcal e macronutrienti rispetto all'obiettivo
- Ricerca istantanea nel catalogo (banca dati svizzera dei valori nutritivi + alimenti tuoi), recenti e preferiti
- Open Food Facts: ricerca e scansione del codice a barre
- Nuovi alimenti in pochi secondi, con porzioni («1 vasetto = 125 g») e kcal calcolate dai macro
- Ricette: ingredienti pesati a crudo, peso da cotto, porzioni; si registrano in grammi di cotto o in porzioni
- Pasti salvati, copia di un pasto da ieri, kcal veloci
- Misure corporee (peso, massa grassa e muscolare, grasso viscerale, acqua, massa ossea, vita, fianchi) con media mobile a 7 giorni
- Obiettivo giornaliero calcolato con Mifflin-St Jeor, personalizzabile
- Statistiche: kcal giornaliere, media dei macronutrienti, kcal medie e peso per settimana

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
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Facoltative: attivano «Continua con Google» |
| `RESEND_API_KEY`, `EMAIL_FROM` | Facoltative: email per il reset della password. In sviluppo, senza, il link compare nel log del server |
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
pnpm test:e2e    # Playwright su viewport mobile, avvia il dev server sulla porta 3100
```

## Struttura

```
src/
  app/            route (gruppi: (app) con barra in basso, (focus) per le schermate dedicate, (auth))
  app/actions/    Server Actions, ognuna verifica la sessione
  components/     UI per funzionalità (add, diary, food, recipes, saved-meals, progress, profile)
  db/             schema Drizzle e client
  lib/nutrition/  logica pura: nutrienti, ricette, obiettivi, date, tendenze
  server/         query server-only
scripts/          migrazione dal vecchio MongoDB
drizzle/          migrazioni SQL
e2e/              test Playwright
```

## Deploy su Vercel

Produzione: https://bilancia-cyan.vercel.app (progetto `bilancia`, funzioni in `fra1` accanto al database Neon).

```bash
pnpm db:migrate:production       # prima, se ci sono nuove migrazioni
npx vercel deploy --prod
```

Le variabili d'ambiente di produzione sono già impostate su Vercel e puntano al branch Neon `main`. `.vercelignore` impedisce di caricare i file `.env*` locali.
