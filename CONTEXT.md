# Bilancia: contesto di progetto

Contesto di prodotto e di progetto per le prossime sessioni. Le istruzioni operative (comandi, pattern, regole) sono in `CLAUDE.md`; la specifica completa è in `docs/spec.md`, l'elenco dei task in `docs/tasks.md`.

## Scopo e pubblico
- Calorie tracker moderno, intuitivo, compatto e mobile-first, usato come PWA installata sul telefono (soprattutto iPhone).
- Utente principale: il proprietario del progetto (un solo utente reale in produzione), ma l'app è multiutente con dati separati per utente.
- Nasce come rifacimento delle vecchie app `../calorie-tracker-frontend` e `../calorie-tracker-backend` (MongoDB): ispirazione, non copia 1:1.
- Requisiti iniziali: tema chiaro/scuro; misure corporee (peso, grasso corporeo, grasso viscerale, ecc.); aggiunta facile di alimenti fuori dal database; alimenti ricorrenti e ricette salvate; ricette calcolate dal peso di tutti gli ingredienti.
- Stack richiesto: React 19 + Next.js 16 + shadcn + Postgres su Neon. Nome dell'app: Bilancia.
- L'utente preferisce che i task vengano portati avanti in autonomia; usa `/grilling` per le decisioni e comunica in italiano.

## Decisioni di prodotto (grilling Q1-Q24)
L'utente ha scelto sempre l'opzione raccomandata.
- Q1 multiutente con Better Auth: email/password + Google (Google attivo solo con le variabili OAuth); dati separati per `userId`.
- Q2 migrazione legacy: tutti gli alimenti (1080 del dataset svizzero come catalogo globale + 261 personali), 5 ricette, 90 alimenti "priority" come preferiti, l'unica misura; pasti storici esclusi.
- Q3 Neon creato con `neonctl`, branch `dev` e `main`; deploy Vercel solo dopo conferma.
- Q4 Drizzle ORM.
- Q5 solo italiano (numeri e date it-IT, fuso `Europe/Rome`).
- Q6 quattro pasti fissi: Colazione, Pranzo, Cena, Spuntini.
- Q7 obiettivi con Mifflin-St Jeor, modificabili a mano.
- Q8 ricette con peso da cotto opzionale e numero di porzioni.
- Q9 Open Food Facts: ricerca e barcode.
- Q10 PWA senza supporto offline.
- Q11 un branch per task, commit locali, merge in `main` (in origine senza push; ora l'utente sincronizza su GitHub da VS Code).
- Q12 catalogo globale in sola lettura + alimenti privati; modificare un alimento globale crea una copia privata (`replacesFoodId`).
- Q13 nessuna condivisione di pasti tra utenti.
- Q14 nutrienti principali come colonne, micronutrienti in `jsonb`.
- Q15 misure: peso obbligatorio, poi grasso %, muscolo %, viscerale, acqua %, massa ossea, vita, fianchi; media mobile a 7 giorni.
- Q16 preferiti, recenti, pasti salvati, copia pasto.
- Q17 "Crea «testo»" dalla ricerca + kcal veloci (etichetta via AI rimandata, poi fatta in T27).
- Q18 unità g/ml + porzioni con nome.
- Q19 bottom nav: Oggi / Cibo / + / Progressi / Profilo.
- Q20 statistiche: kcal a 7/30 giorni, macro settimanali, peso contro kcal.
- Q21 inizialmente fuori scope: acqua, attività, salute, notifiche, digiuno, AI. Poi l'utente ha detto "vai con tutto": AI e promemoria push sono stati implementati.
- Q22 email/password senza verifica dell'email (il reset password è arrivato in T26).
- Q23 UI neutra e compatta, accento lime, colori P/C/G validati per daltonismo e contrasto in entrambi i temi.
- Q24 qualità: Vitest + Playwright + tsc/eslint/build + controllo visivo.

## Funzionalità per schermata
- **Oggi** (`/`): navigatore del giorno con calendario (punti sui giorni registrati, niente giorni futuri), riepilogo giornaliero (kcal, macro, extra: fibre, zuccheri, grassi saturi, sale; arancione se oltre obiettivo), budget settimanale, 4 sezioni pasto con menu "Copia da ieri" e "Salva come pasto"; tocco su una voce apre l'editor; swipe a destra duplica, a sinistra elimina, con «Annulla» nel toast.
- **Aggiungi** (`/add`, senza bottom nav): selettore del pasto, ricerca in basso con tolleranza ai refusi, schede Recenti / Preferiti / Ricette / Pasti; aggiunta in un tocco dai recenti con l'ultima quantità; scheda quantità con porzioni, ultima quantità, ±10 g; "Kcal veloci", "Nuovo alimento", "Descrivi" (AI); scanner barcode; Open Food Facts automatico se il catalogo trova meno di 3 risultati; contatore "N voci aggiunte" + Fatto.
- **Cibo** (`/food`): schede Alimenti / Ricette / Pasti salvati; filtri "Più usati", "Preferiti", "Creati da te", ordinamento per uso; ricerca in basso ("Cerca nel catalogo").
- **Dettaglio alimento** (`/food/[foodId]`): tabella nutrienti, porzioni, micronutrienti, preferito, archivia; modifica (`/edit`) che su un alimento globale salva "la mia copia"; lettura etichetta da foto (AI).
- **Ricette**: vista in sola lettura con porzioni ricalcolabili e "Aggiungi al diario", editor separato (ingredienti, peso da cotto, porzioni), duplica ("(copia)"), archivia.
- **Pasti salvati** (`/meals/[savedMealId]`): modifica, registrazione su un pasto a scelta.
- **Progressi**: scheda Corpo (pesata rapida con "Altre misure" precompilate, grafici con media mobile, variazione del peso come intervallo di tempo) e scheda Alimentazione (kcal 7/30 giorni con linea dell'obiettivo, macro settimanali, peso contro kcal; le medie escludono il giorno in corso).
- **Profilo**: scheda "Dati e obiettivo" (dati personali, obiettivo perdi/mantieni/aumenta, ritmo settimanale, target personalizzati, stima adattiva del fabbisogno su 28 giorni con "Usa … kcal come obiettivo") e scheda Impostazioni (account, promemoria push se configurati, tema, esportazione CSV di diario/misure/alimenti, eliminazione account).
- **Autenticazione**: login, registrazione, password dimenticata e reset (visibili solo se l'email è configurata in produzione), Google se configurato; redirect con `?next=`.
- **Promemoria push**: sera (se manca la cena o non c'è nulla) e pesata settimanale nel giorno scelto; service worker solo per le notifiche.
- **AI**: lettura dell'etichetta nutrizionale da foto e pasto descritto a parole, con limite di 40 richieste al giorno per utente.

## Dati e infrastruttura
- **Neon**: progetto `calorie-tracker` nell'organizzazione personale dell'utente, regione `aws-eu-central-1`, Postgres 18; branch `main` = produzione, branch `dev` = sviluppo ed e2e (id di progetto, branch ed endpoint con `npx neonctl projects list`, `npx neonctl branches list` e `npx neonctl endpoints list`; il repository è pubblico, quindi non scriverli qui);
  - non usare l'organizzazione aziendale Rentobuy né un'organizzazione Neon gestita da Vercel.
- **File env** (mai stamparne i valori): `.env.local` → Neon dev; `.env.production.local` → Neon main (solo URL database); produzione → variabili su Vercel.
- **Vercel**: progetto `bilancia`, scope personale `p1e7r0s-projects` (Hobby, non il team Rentobuy), funzioni in `fra1` vicino a Neon (il primo deploy era finito in `iad1`).
  - produzione: https://bilancia-cyan.vercel.app (alias `bilancia-p1e7r0s-projects.vercel.app`);
  - deploy solo da CLI, non collegato a GitHub; i preview deployment non hanno variabili;
  - variabili impostate: `DATABASE_URL`, `DATABASE_URL_UNPOOLED`, `BETTER_AUTH_SECRET` (diverso dal locale), `BETTER_AUTH_URL`, `BETTER_AUTH_TRUSTED_ORIGINS`, `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`, `CRON_SECRET`;
  - non ancora impostate: `ANTHROPIC_API_KEY`, `RESEND_API_KEY`, `EMAIL_FROM`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`;
  - cron: `/api/cron/evening-reminder` alle 19:00 UTC, `/api/cron/weigh-in-reminder` alle 06:00 UTC (21/8 ora legale, 20/7 ora solare).
- **GitHub**: `origin` https://github.com/p1e7r0/calorie-tracker.git, solo `main` sul remote; i branch di task restano locali.
- **Origine legacy**: MongoDB Atlas delle vecchie app (collezioni `foods`, `meals` con `type: "recipe"`, `measurements`), importato con `scripts/migrate-legacy.ts` (`LEGACY_MONGODB_URI`). Import eseguito per l'account del proprietario su dev e main; lo script è idempotente e richiede che l'account sia già registrato.
- **Docker locale**: Postgres 17 (`calorie-tracker-database`, porta 5433) con vecchi account solo locali; alternativa non più usata di default.
- **Utenti di prova**: su Neon dev `test-*@example.com` (e2e) e `lan-*@example.com` (prove manuali); in produzione solo `smoke-test-*@example.com` che si eliminano a fine test.

## Modello dati in breve
- `food` (catalogo globale `owner_id NULL` con fonte `swiss` o `open_food_facts`, oppure personale; valori per 100 g/ml; micronutrienti `jsonb`; archiviazione soft), `food_portion`.
- `recipe` + `recipe_ingredient` (sempre per utente; peso da cotto e porzioni opzionali).
- `favorite_food`, `favorite_recipe`.
- `diary_entry` (snapshot dei nutrienti, tipi `food` / `recipe` / `quick`).
- `saved_meal` + `saved_meal_item` (esattamente un alimento o una ricetta per riga).
- `measurement`, `profile` (un record per utente, target e promemoria), `ai_request` (limite AI), `push_subscription`.
- Tabelle better-auth: `user`, `session`, `account`, `verification`.
- Migrazioni `0000`-`0007`; quelle custom (0001, 0002, 0004) contengono estensioni, funzioni di ricerca e la FK differita.

## Glossario
- **Catalogo globale**: alimenti condivisi (`owner_id NULL`), dal dataset svizzero legacy o importati da Open Food Facts; nessun utente li modifica.
- **Alimento personale / copia privata**: alimento con `owner_id` dell'utente; la copia privata sostituisce per quell'utente un alimento globale (`replaces_food_id`).
- **Voce del diario**: singola registrazione in un giorno e pasto; conserva i propri valori nutrizionali (snapshot).
- **Kcal veloci**: voce `quick` con sole calorie, etichetta predefinita "Kcal veloci".
- **Pasto salvato**: modello riutilizzabile di più alimenti/ricette, registrabile in blocco.
- **Peso da cotto**: peso finale della ricetta; se assente si usa la somma dei grammi degli ingredienti.
- **Fabbisogno / mantenimento**: kcal stimate con Mifflin-St Jeor × fattore di attività, oppure dalla stima adattiva.
- **Stima adattiva**: fabbisogno ricavato da introito medio e trend del peso negli ultimi 28 giorni (servono 14 giorni registrati con almeno 600 kcal e pesate distanti almeno 14 giorni).
- **Budget settimanale**: obiettivo × 7 da lunedì a domenica, con suggerimento per oggi in base a quanto mangiato nei giorni precedenti.
- **Extra**: fibre, zuccheri, grassi saturi e sale (possono essere ignoti, `null`).
- **Macro**: P/C/G = proteine, carboidrati, grassi.

## Stato attuale
Aggiornato al 2026-10-16. Per lo stato reale usa `git log` e `git status`.
- Tutti i task T01-T31 sono completati, mergiati in `main` e in produzione dal 2026-10-16, più tre fix successivi (budget settimanale con giorni non registrati, status bar iOS standalone, offset dell'header di Oggi).
- Ultimo merge in `main`: `fix/today-header-offset`, poi la documentazione per agenti (`CLAUDE.md`, `CONTEXT.md`).
- Migrazioni fino a `0007_push_reminders` applicate sia a dev sia a main.
- Funzioni AI nascoste in produzione finché manca `ANTHROPIC_API_KEY`; link "Password dimenticata" nascosto finché mancano `RESEND_API_KEY` ed `EMAIL_FROM`; login Google assente senza credenziali OAuth.

## Punti aperti e idee
- Da fornire dall'utente: `ANTHROPIC_API_KEY`; `RESEND_API_KEY` + `EMAIL_FROM` (con dominio mittente verificato); opzionalmente credenziali Google OAuth.
- Da verificare su dispositivo reale: AI con chiave vera, email Resend reale, notifiche push su iPhone (richiede installazione nella schermata Home), gesti di swipe su iOS, correzione della status bar iOS (prima dell'ultimo fix era sfocata solo Oggi; si attende conferma).
- `docs/spec.md` ha decisioni superate: Q11 (ora l'utente fa push su GitHub), Q21 (AI e promemoria implementati), Q22 (reset password arrivato in T26).
- Opzionali: eliminare i vecchi progetti Vercel `calorie-tracker-frontend` e `calorie-tracker-backend` (non toccati); ruotare le credenziali di MongoDB Atlas e rimuovere `LEGACY_MONGODB_URI` da `.env.local` (l'import legacy è concluso); collegare i preview deployment a Neon dev.
- Promemoria a orario personalizzato: con Vercel Hobby i cron girano una volta al giorno; servirebbe il piano Pro (cron orario) o uno scheduler esterno.
- Ricerca: aggiungere un indice trigram su `name || brand` e su `recipe.name` se il catalogo cresce.
- Fuori scope finora: acqua, attività fisica, integrazione con app Salute, digiuno, modalità offline.

## Cronologia
- **2026-10-15, fase 1 (T01-T15)**: grilling Q1-Q24; scaffold Next.js 16 + Tailwind 4 + shadcn + PWA; schema Drizzle e Postgres in Docker; Better Auth e onboarding profilo; logica di dominio con test; migrazione da MongoDB; diario Oggi; catalogo alimenti con copia privata; Open Food Facts e barcode; ricette; pasti salvati; misure corporee; profilo e obiettivi; progressi; passaggio a Neon (dev/main) con migrazione dati; rifinitura con e2e e README.
- **Deploy iniziale**: progetto Vercel `bilancia` creato da CLI; primo deploy fallito ("Output Directory public is empty") risolto con `framework: "nextjs"` in `vercel.json`; regione spostata da `iad1` a `fra1`.
- **2026-10-16, fase 2 (T16-T31)**: bug del grafico e delle medie, cancellazione account con ricette (FK differita, migrazione 0004), toast in basso; aggiunta in un tocco e stepper ±10 g; Open Food Facts automatico; vista ricetta in sola lettura e duplica; calendario; pesata rapida; filtri del catalogo; swipe sulle voci; ritocchi grafici e profilo diviso; obiettivo adattivo; reset password via Resend; AI (etichetta e descrizione pasto); budget settimanale; CSV ed eliminazione account; nutrienti extra nel diario con backfill (0006); promemoria push (0007).
- **2026-10-16, dopo T31**: giorni passati non registrati contati come in linea nel budget settimanale; padding della status bar nella PWA iOS standalone; header di Oggi allineato agli altri.

## Riferimenti
- `docs/spec.md`: stack, tabella decisioni Q1-Q24, regole di dominio (nutrienti per 100 g, ricette con peso da cotto, snapshot nel diario, Mifflin-St Jeor, macro predefinite), infrastruttura.
- `docs/tasks.md`: T01-T31 e i fix successivi.
- `README.md`: setup locale, variabili, comandi database, migrazione legacy, deploy.
- `CLAUDE.md`: istruzioni operative per gli agenti.
