# Calorie tracker: specifiche

Applicazione per misurare le calorie nel modo più semplice e diretto possibile. Ispirata (non replica) ai vecchi `calorie-tracker-frontend` e `calorie-tracker-backend`.

## Stack

- Next.js 16 (App Router, Turbopack), React 19, TypeScript
- Tailwind CSS 4 + shadcn/ui, `next-themes` per tema chiaro/scuro/sistema
- Lakebase Postgres su Neon, Drizzle ORM con `node-postgres` (`pg`) e `attachDatabasePool` di `@vercel/functions`, come raccomandato da Neon per Vercel Fluid compute. `DATABASE_URL` (pooled) per l'app, `DATABASE_URL_UNPOOLED` (diretta) per le migrazioni. In locale funziona anche con Postgres in Docker
- Better Auth: email/password; Google attivo solo se `GOOGLE_CLIENT_ID` e `GOOGLE_CLIENT_SECRET` sono presenti
- Vitest per la logica, Playwright per lo smoke e2e
- PWA installabile (manifest, icone), senza offline
- Interfaccia solo in italiano, numeri e date `it-IT`, fuso `Europe/Rome`

## Decisioni

| # | Tema | Decisione |
|---|------|-----------|
| Q1 | Utenti | Multi-utente, dati separati per utente |
| Q2 | Migrazione | Alimenti (1341), 5 ricette, l'unica misurazione; preferiti dai 90 `priority`. Pasti storici esclusi |
| Q3 | Neon | Progetto creato con `neonctl`, branch `dev` e `main`. Deploy Vercel solo alla fine, dopo conferma |
| Q4 | ORM | Drizzle |
| Q5 | Lingua | Solo italiano |
| Q6 | Giornata | 4 pasti fissi: colazione, pranzo, cena, spuntini |
| Q7 | Obiettivi | Calcolati con Mifflin-St Jeor (sesso, età, altezza, attività, obiettivo, ultimo peso), sovrascrivibili |
| Q8 | Ricette | Ingredienti crudi in grammi + peso da cotto facoltativo + numero di porzioni. Si registra in grammi di cotto o in porzioni |
| Q9 | Open Food Facts | Ricerca per nome e barcode con fotocamera; il prodotto usato viene salvato nel catalogo globale |
| Q10 | PWA | Sì, senza offline |
| Q11 | Git | Un branch per task, commit locali, merge su `main`; aggiornato: l'utente sincronizza `main` su GitHub da VS Code, i branch di task restano locali |
| Q12 | Catalogo | Globale in sola lettura (banca dati svizzera + Open Food Facts) + privato per utente. Modificare un alimento globale crea una copia privata che lo sostituisce |
| Q13 | Pasti condivisi | No: ognuno registra la propria porzione (ricetta + peso da cotto) |
| Q14 | Nutrienti | Colonne: kcal, proteine, carboidrati, zuccheri, grassi, saturi, fibre, sale (per 100 g/ml). Vitamine e minerali in `jsonb` |
| Q15 | Misure | Peso obbligatorio; facoltativi % grasso, % muscolo, grasso viscerale, % acqua, massa ossea, vita, fianchi. Grafici con media mobile 7 giorni |
| Q16 | Ricorrenti | Preferiti, recenti/frequenti, pasti salvati, copia pasto da un altro giorno |
| Q17 | Nuovo alimento | "Crea «testo»" dalla ricerca vuota, modulo compatto; più "kcal veloci" senza alimento |
| Q18 | Unità | Grammi/ml più porzioni con nome per alimento |
| Q19 | Navigazione | Barra in basso: Oggi, Cibo, "+", Progressi, Profilo |
| Q20 | Statistiche | Kcal 7/30 giorni con obiettivo, media macro settimanale, peso vs kcal medie |
| Q21 | Fuori scope | Acqua, attività, integrazioni salute, digiuno; aggiornato: AI (T27) e promemoria push (T31) implementati su richiesta dell'utente |
| Q22 | Account | Email/password senza verifica; Google pronto ma attivo con le variabili; reset password via email implementato in T26 (attivo con Resend) |
| Q23 | Stile | Neutro e compatto, un accento lime per le kcal, colori distinti per P/C/G, numeri tabellari |
| Q24 | Qualità | Vitest sulla logica, Playwright smoke, `tsc`/`eslint`/`next build` puliti, controllo visivo mobile chiaro/scuro |

## Regole di dominio

- Valori nutrizionali sempre per 100 g (o 100 ml). Nutriente di una voce = `valore * grammi / 100`.
- Ricetta: totale = somma degli ingredienti. Base per 100 g = peso da cotto se presente, altrimenti somma dei grammi crudi. Porzione = totale / numero di porzioni.
- Le voci del diario salvano una copia dei nutrienti calcolati al momento dell'inserimento (la storia non cambia se l'alimento viene corretto); vengono ricalcolate quando la voce viene modificata.
- Il giorno del diario è una data (`date`) nel fuso dell'utente, non un timestamp.
- Mifflin-St Jeor: BMR = 10·kg + 6,25·cm − 5·età + 5 (uomo) / −161 (donna); TDEE = BMR · fattore attività; obiettivo dimagrimento/aumento ± kcal. Macro di default: proteine 1,8 g/kg, grassi 25% kcal, resto carboidrati.

## Infrastruttura

- Neon: progetto `calorie-tracker` nell'organizzazione personale del proprietario (id con `npx neonctl projects list`), regione `aws-eu-central-1`, Postgres 18. Branch `main` (produzione) e `dev` (sviluppo). Schema e catalogo comune (1080 alimenti) già presenti su entrambi.
- Vercel: progetto `bilancia` nello spazio personale `p1e7r0s-projects` (Hobby), produzione su https://bilancia-cyan.vercel.app. Funzioni in `fra1` (Francoforte), accanto al database. Variabili di produzione: `DATABASE_URL`, `DATABASE_URL_UNPOOLED` (branch `main`), `BETTER_AUTH_SECRET` (diverso da quello locale), `BETTER_AUTH_URL`, `BETTER_AUTH_TRUSTED_ORIGINS` (alias `bilancia-p1e7r0s-projects.vercel.app`). Deploy dalla CLI, senza collegamento a GitHub; `.vercelignore` esclude i file `.env*`.
- Strumenti per gli agenti: skill Neon (`neon`, `neon-postgres`, `neon-postgres-branches`) in `.claude/skills/`, server MCP Neon con OAuth in `.mcp.json`.
- Sviluppo locale alternativo: Postgres 17 in Docker (`docker-compose.yml`, porta 5433).

## Scelte fatte durante lo sviluppo

- Nome dell'app: «Bilancia».
- Driver `pg` (TCP) invece di `@neondatabase/serverless`: è la raccomandazione Neon per Vercel Fluid compute e funziona anche con Postgres locale.
- La schermata «Aggiungi» e le schermate di dettaglio non mostrano la barra in basso, per lasciare spazio all'inserimento.
- La ricerca su Open Food Facts parte solo su richiesta (limite di 10 ricerche al minuto); il codice a barre invece è immediato.
- Ricerca tollerante agli errori di battitura: ogni parola deve comparire nel nome oppure differire da una sua parola di al massimo 1 lettera (parole di 4–5 lettere) o 2 lettere (6 o più); accenti e maiuscole sono ignorati e i risultati esatti vengono prima.
- Intestazioni, tab e barra in basso restano fisse e scorre solo il contenuto; il campo di ricerca sta in basso, sopra la tastiera, come in Safari.
- Colori dei grafici e dei macronutrienti validati per daltonismo e contrasto in entrambi i temi.
- Siri (T34): endpoint dedicato invece del server MCP, perché Comandi rapidi non gestisce OAuth. Autenticazione con un token personale (`blc_` + 32 byte casuali, salvato solo come hash SHA-256, uno per utente, mostrato una volta) valido solo per registrare e annullare pasti da Siri; revocato al reset della password. Interpretazione in due chiamate fisse a Haiku (testo → voci con ricette e pasti salvati per codice; candidati del catalogo → scelta e grammi), non un ciclo libero di strumenti, per avere latenza e costo prevedibili. Le voci create portano `source = 'shortcut'`.
