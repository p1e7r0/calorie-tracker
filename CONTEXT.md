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
- **Oggi** (`/`): navigatore del giorno con calendario (punti sui giorni registrati, niente giorni futuri), riepilogo giornaliero (kcal, macro, extra: fibre, zuccheri, grassi saturi, sale; arancione se oltre obiettivo), budget settimanale, scheda «Il punto della settimana» (una volta a settimana da lunedì, se la stima adattiva è pronta: medie della settimana scorsa, fabbisogno stimato, «Aggiorna obiettivo» con «Annulla» oppure «Non ora»), 4 sezioni pasto con menu "Copia da ieri", "Copia da un altro giorno" (calendario, pasto di origine e anteprima) e "Salva come pasto"; «Giorno incompleto» per escludere un giorno registrato a metà da medie, stima adattiva e check-in (nel budget settimanale conta come in linea); tocco su una voce apre l'editor; swipe a destra duplica, a sinistra elimina, con «Annulla» nel toast; tirando giù dall'alto si aggiornano i dati (pull-to-refresh).
- **Aggiungi** (`/add`, senza bottom nav): selettore del pasto, riga «Diario di …» se il giorno non è oggi (anche dal «+» della barra in basso, che porta il giorno visualizzato), ricerca in basso (svuotata e rimessa a fuoco dopo ogni aggiunta) con tolleranza ai refusi, schede Suggeriti / Preferiti / Ricette / Pasti; Suggeriti ordina alimenti e ricette per frequenza e recenza nel pasto scelto (ultimi 60 giorni, dimezzamento in 14 giorni, gli altri pasti pesano 0,3) e cambia subito col selettore; aggiunta in un tocco con l'ultima quantità anche per le ricette (porzioni o grammi); scheda quantità con porzioni, ultima quantità, ±10 g, Invio per registrare; "Kcal veloci", "Nuovo alimento", "Descrivi" (AI); scanner barcode; Open Food Facts automatico se il catalogo trova meno di 3 risultati; contatore "N voci aggiunte" + Fatto.
- **Cibo** (`/food`): schede Alimenti / Ricette / Pasti salvati; filtri "Più usati", "Preferiti", "Creati da te", ordinamento per uso; ricerca in basso ("Cerca nel catalogo") con scanner barcode: prodotto già nel catalogo o su Open Food Facts → dettaglio; sconosciuto → "Nuovo alimento" con il codice compilato.
- **Dettaglio alimento** (`/food/[foodId]`): tabella nutrienti, porzioni, micronutrienti, preferito, archivia; modifica (`/edit`) che su un alimento globale salva "la mia copia"; lettura etichetta da foto (AI). Il form "Nuovo alimento"/modifica ha il campo "Codice a barre" con scanner: in creazione, se il codice è già nel catalogo o su Open Food Facts apre quell'alimento invece di crearne un doppione.
- **Ricette**: vista in sola lettura con porzioni ricalcolabili e "Aggiungi al diario", editor separato (ingredienti, peso da cotto, porzioni; «Pesa con la pentola» toglie dal peso totale la tara di una pentola salvata o creata al momento), duplica ("(copia)"), archivia.
- **Pasti salvati** (`/meals/[savedMealId]`): modifica, registrazione su un pasto a scelta.
- **Progressi**: scheda Corpo (pesata rapida con "Altre misure" precompilate, grafici con media mobile, variazione del peso come intervallo di tempo, peso obiettivo con quanto manca, data prevista e linea tratteggiata) e scheda Alimentazione (kcal 7/30 giorni con linea dell'obiettivo, barre arancioni sopra l'obiettivo e sbiadite nei giorni incompleti, macro settimanali, peso contro kcal, fabbisogno stimato ogni lunedì delle ultime 12 settimane più oggi con la linea dell'obiettivo; le medie escludono il giorno in corso); pull-to-refresh.
- **Profilo**: scheda "Dati e obiettivo" (dati personali, obiettivo perdi/mantieni/aumenta, ritmo settimanale, peso obiettivo facoltativo con data prevista al ritmo scelto, target personalizzati, stima adattiva del fabbisogno su 28 giorni con "Usa … kcal come obiettivo") e scheda Impostazioni (account, pentole con il loro peso a vuoto, promemoria push se configurati, tema, esportazione CSV di diario/misure/alimenti, eliminazione account).
- **Autenticazione**: login, registrazione, password dimenticata e reset (visibili solo se l'email è configurata in produzione), Google se configurato; redirect con `?next=`.
- **Promemoria push**: sera (se manca la cena o non c'è nulla), pesata settimanale nel giorno scelto e, il lunedì alle 06:00 UTC, riepilogo della settimana a chi ha almeno un promemoria attivo (stesso cron della pesata; se la pesata cade di lunedì il messaggio è unico e apre Progressi); service worker solo per le notifiche.
- **Connettore per Claude** (`/api/mcp`): server MCP con OAuth 2.1; ogni utente crea Client ID e Client Secret dal profilo, li incolla su claude.ai e consente l'accesso su `/consent`; strumenti `search_foods` e `recent_foods` (anche ricette e pasti salvati), `log_meal` (alimenti, ricette, pasti salvati, kcal veloci), `get_day`, `delete_entry`, `copy_meal` (un pasto di un giorno qualsiasi in un altro pasto o giorno), `lookup_barcode` (catalogo o import da Open Food Facts), `create_food`, `create_recipe`, `log_weight`, `get_progress` (totali giornalieri, medie, budget settimanale, trend del peso, stima adattiva); registrazione dinamica dei client disattivata, CIMD attivo. Le istruzioni del server dicono a Claude di creare alimenti solo con valori forniti dall'utente (numeri, foto dell'etichetta, barcode) e di chiedere il peso da cotto delle ricette.
- **AI**: lettura dell'etichetta nutrizionale da foto e pasto descritto a parole, con limite di 40 richieste al giorno per utente.
- **Siri** (`/api/shortcuts/meal`, visibile solo con l'AI attiva): token personale da Profilo › Impostazioni › Siri; un Comando rapido detta il testo, lo manda in POST con `Authorization: Bearer` e pronuncia il campo `message` della risposta; `DELETE` sullo stesso URL annulla l'ultima registrazione da Siri (entro 24 ore). Ogni pasto usa 2 richieste AI (1 se non servono alimenti del catalogo).

## Dati e infrastruttura
- **Neon**: progetto `calorie-tracker` nell'organizzazione personale dell'utente, regione `aws-eu-central-1`, Postgres 18; branch `main` = produzione, branch `dev` = sviluppo ed e2e (id di progetto, branch ed endpoint con `npx neonctl projects list`, `npx neonctl branches list` e `npx neonctl endpoints list`; il repository è pubblico, quindi non scriverli qui);
  - non usare l'organizzazione aziendale Rentobuy né un'organizzazione Neon gestita da Vercel.
- **File env** (mai stamparne i valori): `.env.local` → Neon dev; `.env.production.local` → Neon main (solo URL database); produzione → variabili su Vercel.
- **Vercel**: progetto `bilancia`, scope personale `p1e7r0s-projects` (Hobby, non il team Rentobuy), funzioni in `fra1` vicino a Neon (il primo deploy era finito in `iad1`).
  - produzione: https://bilancia-cyan.vercel.app (alias `bilancia-p1e7r0s-projects.vercel.app`);
  - collegato al repository GitHub dal 2026-10-21: ogni push di `main` fa il deploy in produzione; la CLI resta come riserva; i preview deployment (push di altri branch) non hanno variabili;
  - variabili impostate: `DATABASE_URL`, `DATABASE_URL_UNPOOLED`, `BETTER_AUTH_SECRET` (diverso dal locale), `BETTER_AUTH_URL`, `BETTER_AUTH_TRUSTED_ORIGINS`, `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`, `CRON_SECRET`;
  - non ancora impostate: `ANTHROPIC_API_KEY`, `RESEND_API_KEY`, `EMAIL_FROM`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`;
  - cron: `/api/cron/evening-reminder` alle 19:00 UTC, `/api/cron/weigh-in-reminder` alle 06:00 UTC (21/8 ora legale, 20/7 ora solare).
- **GitHub**: `origin` https://github.com/p1e7r0/calorie-tracker.git; sul remote c'è `main` (più i branch delle sessioni cloud finché non vengono uniti); i branch di task locali restano locali e si cancellano dopo il merge. Il tag `archive/claude-connector-tools` conserva un branch superato.
- **Origine legacy**: MongoDB Atlas delle vecchie app (collezioni `foods`, `meals` con `type: "recipe"`, `measurements`), importato con `scripts/migrate-legacy.ts` (`LEGACY_MONGODB_URI`). Import eseguito per l'account del proprietario su dev e main; lo script è idempotente e richiede che l'account sia già registrato.
- **Docker locale**: Postgres 17 (`calorie-tracker-database`, porta 5433) con vecchi account solo locali; alternativa non più usata di default.
- **Utenti di prova**: su Neon dev `test-*@example.com` (e2e) e `lan-*@example.com` (prove manuali); in produzione solo `smoke-test-*@example.com` che si eliminano a fine test.

## Modello dati in breve
- `food` (catalogo globale `owner_id NULL` con fonte `swiss` o `open_food_facts`, oppure personale; valori per 100 g/ml; micronutrienti `jsonb`; archiviazione soft), `food_portion`.
- `recipe` + `recipe_ingredient` (sempre per utente; peso da cotto e porzioni opzionali).
- `favorite_food`, `favorite_recipe`.
- `diary_entry` (snapshot dei nutrienti, tipi `food` / `recipe` / `quick`).
- `saved_meal` + `saved_meal_item` (esattamente un alimento o una ricetta per riga).
- `measurement`, `profile` (un record per utente: target, peso obiettivo `target_weight_kg`, ultimo check-in `last_check_in_week`, promemoria), `incomplete_day` (giorni segnati come incompleti), `ai_request` (limite AI), `push_subscription`, `api_token` (token Siri: hash, uno per utente), `cookware` (pentole: nome e peso a vuoto, al massimo 50 per utente).
- `diary_entry.source`: `app`, `connector` (Claude) o `shortcut` (Siri).
- Tabelle better-auth: `user`, `session`, `account`, `verification`.
- Tabelle OAuth del connettore per Claude (better-auth `jwt` + `@better-auth/mcp`): `jwks`, `oauth_client`, `oauth_resource`, `oauth_client_resource`, `oauth_access_token`, `oauth_refresh_token`, `oauth_consent`, `oauth_client_assertion`.
- Migrazioni `0000`-`0014`; quelle custom (0001, 0002, 0004) contengono estensioni, funzioni di ricerca e la FK differita.

## Glossario
- **Catalogo globale**: alimenti condivisi (`owner_id NULL`), dal dataset svizzero legacy o importati da Open Food Facts; nessun utente li modifica.
- **Alimento personale / copia privata**: alimento con `owner_id` dell'utente; la copia privata sostituisce per quell'utente un alimento globale (`replaces_food_id`).
- **Voce del diario**: singola registrazione in un giorno e pasto; conserva i propri valori nutrizionali (snapshot).
- **Kcal veloci**: voce `quick` con sole calorie, etichetta predefinita "Kcal veloci".
- **Pasto salvato**: modello riutilizzabile di più alimenti/ricette, registrabile in blocco.
- **Peso da cotto**: peso finale della ricetta; se assente si usa la somma dei grammi degli ingredienti.
- **Fabbisogno / mantenimento**: kcal stimate con Mifflin-St Jeor × fattore di attività, oppure dalla stima adattiva.
- **Stima adattiva**: fabbisogno ricavato da introito medio e trend del peso negli ultimi 28 giorni (servono 14 giorni registrati con almeno 600 kcal, non segnati come incompleti, e pesate distanti almeno 14 giorni).
- **Giorno incompleto**: giorno segnato dall'utente perché registrato a metà; resta nel diario ma non conta nelle medie, nella stima adattiva e nel check-in, e nel budget settimanale vale come in linea con l'obiettivo.
- **Peso obiettivo**: peso da raggiungere, facoltativo, con data prevista dal ritmo reale delle pesate o, se mancano dati, da quello scelto nel profilo.
- **Budget settimanale**: obiettivo × 7 da lunedì a domenica, con suggerimento per oggi in base a quanto mangiato nei giorni precedenti.
- **Extra**: fibre, zuccheri, grassi saturi e sale (possono essere ignoti, `null`).
- **Macro**: P/C/G = proteine, carboidrati, grassi.

## Stato attuale
Aggiornato al 2026-10-22. Per lo stato reale usa `git log` e `git status`.
- Tutti i task T01-T37 sono completati e in produzione; T01-T32 dal 2026-10-16, più tre fix successivi (budget settimanale con giorni non registrati, status bar iOS standalone, offset dell'header di Oggi).
- Ultimo merge in `main`: `chore/docs-refresh`; prima `fix/connector-incomplete-days` (in produzione dal 2026-10-21). Nessun branch o PR in sospeso.
- T33 (pull-to-refresh su Oggi e Progressi) in produzione dal 2026-10-17.
- `fix/logging-flow-friction`, `feature/meal-suggestions` e `feature/weekly-check-in` (migliorie dall'analisi del 2026-10-17) in produzione dal 2026-10-17, verificati con uno smoke test (ricerca e aggiunta con Invio, suggerimenti con l'ultima quantità, grafico del fabbisogno, impostazioni dei promemoria).
- `feature/quick-undo-and-editing` in produzione dal 2026-10-17, verificato con uno smoke test (annullamento di Kcal veloci e del pasto salvato, ±10 g nell'editor della voce, «Aggiungi al diario» dal dettaglio del pasto salvato, conferma prima di eliminarlo).
- T34-T37, i branch del 2026-10-18 e `fix/open-food-facts-not-found` in produzione dal 2026-10-21 (primo deploy partito dal push di `main`), verificati con uno smoke test (peso obiettivo nel profilo e in Progressi, aggiunta dal catalogo, copia da un altro giorno, giorno incompleto, scanner con codice sconosciuto che apre «Nuovo alimento»). Non provati in produzione: Siri (nascosto senza `ANTHROPIC_API_KEY`) e i nuovi strumenti del connettore.
- Migrazioni fino a `0013_siri_shortcut` applicate sia a dev sia a main (`0013` è nata come `0010_siri_shortcut` sul branch ed è stata rinumerata nel merge).
- `feature/cookware-tare` (pentole e peso da cotto al netto della tara, migrazione `0014_cookware`) pushato su GitHub, non ancora unito a `main`: la migrazione va applicata a dev e a main prima del merge.
- Siri (T36): pipeline provata con un finto server Anthropic (`ANTHROPIC_BASE_URL`), mai con Haiku reale né con un iPhone.
- Connettore per Claude: verificato con claude.ai reale (Claude Desktop, credenziali da Profilo › Impostazioni › Claude); il client usa `client_secret_post` perché claude.ai (SDK MCP Python) invia il segreto nel corpo della richiesta; con `client_secret_basic` lo scambio del token rispondeva 400 `invalid_client`.
- Funzioni AI nascoste in produzione finché manca `ANTHROPIC_API_KEY`; link "Password dimenticata" nascosto finché mancano `RESEND_API_KEY` ed `EMAIL_FROM`; login Google assente senza credenziali OAuth.

## Punti aperti e idee
- Da fornire dall'utente: `ANTHROPIC_API_KEY`; `RESEND_API_KEY` + `EMAIL_FROM` (con dominio mittente verificato); opzionalmente credenziali Google OAuth.
- Da verificare su dispositivo reale: Comando rapido Siri su iPhone (latenza con Haiku reale, timeout di «Ottieni contenuto dell'URL»), AI con chiave vera, email Resend reale, notifiche push su iPhone (richiede installazione nella schermata Home), gesti di swipe e pull-to-refresh su iOS (gli e2e emulano iPhone in Chromium, non WebKit), scanner barcode da Cibo e dal form (fotocamera solo in HTTPS), aree di tocco `touch-target` e riga «Diario di …» in /add (Invio per registrare la quantità funziona su Android e desktop; il tastierino decimale di iPhone non ha il tasto Invio), correzione della status bar iOS (prima dell'ultimo fix era sfocata solo Oggi; si attende conferma).
- Opzionali: eliminare i vecchi progetti Vercel `calorie-tracker-frontend` e `calorie-tracker-backend` (non toccati); ruotare le credenziali di MongoDB Atlas e rimuovere `LEGACY_MONGODB_URI` da `.env.local` (l'import legacy è concluso); collegare i preview deployment a Neon dev.
- Promemoria a orario personalizzato: con Vercel Hobby i cron girano una volta al giorno; servirebbe il piano Pro (cron orario) o uno scheduler esterno.
- Connettore per Claude: provare i nuovi strumenti con claude.ai reale (creazione da foto dell'etichetta, ricetta con peso da cotto); non ci sono ancora `update_food`, `update_recipe` e `get_recipe` (gli errori di creazione si correggono dall'app); gli alimenti creati da Claude hanno fonte `user` e non si distinguono da quelli inseriti a mano.
- Pentole: la tara si usa solo nell'editor della ricetta; non c'è ancora nel connettore per Claude (`create_recipe` chiede il peso da cotto già netto) né per aggiornare il peso da cotto dalla vista della ricetta senza aprire l'editor.
- Ricerca: aggiungere un indice trigram su `name || brand` e su `recipe.name` se il catalogo cresce.
- Fuori scope finora: acqua, attività fisica, integrazione con app Salute, digiuno, modalità offline.

## Cronologia
- **2026-10-15, fase 1 (T01-T15)**: grilling Q1-Q24; scaffold Next.js 16 + Tailwind 4 + shadcn + PWA; schema Drizzle e Postgres in Docker; Better Auth e onboarding profilo; logica di dominio con test; migrazione da MongoDB; diario Oggi; catalogo alimenti con copia privata; Open Food Facts e barcode; ricette; pasti salvati; misure corporee; profilo e obiettivi; progressi; passaggio a Neon (dev/main) con migrazione dati; rifinitura con e2e e README.
- **Deploy iniziale**: progetto Vercel `bilancia` creato da CLI; primo deploy fallito ("Output Directory public is empty") risolto con `framework: "nextjs"` in `vercel.json`; regione spostata da `iad1` a `fra1`.
- **2026-10-16, fase 2 (T16-T31)**: bug del grafico e delle medie, cancellazione account con ricette (FK differita, migrazione 0004), toast in basso; aggiunta in un tocco e stepper ±10 g; Open Food Facts automatico; vista ricetta in sola lettura e duplica; calendario; pesata rapida; filtri del catalogo; swipe sulle voci; ritocchi grafici e profilo diviso; obiettivo adattivo; reset password via Resend; AI (etichetta e descrizione pasto); budget settimanale; CSV ed eliminazione account; nutrienti extra nel diario con backfill (0006); promemoria push (0007).
- **2026-10-16, dopo T31**: giorni passati non registrati contati come in linea nel budget settimanale; padding della status bar nella PWA iOS standalone; header di Oggi allineato agli altri.
- **2026-10-17, T33**: pull-to-refresh in stile Mail su Oggi e Progressi (le uniche schermate con dati che cambiano anche da fuori, ad esempio dal connettore Claude); Cibo, Profilo, schermate focus e autenticazione esclusi.
- **2026-10-17, fix del flusso di registrazione**: il «+» della barra in basso porta il giorno visualizzato, riga «Diario di …» in /add, Invio per registrare la quantità, ricerca svuotata dopo l'aggiunta, utility `touch-target` per aree di tocco da 44 px, schede alte 40 px; schede di /add controllate per evitare l'avviso di Base UI quando cambiano i recenti.
- **2026-10-17, check-in settimanale**: scheda «Il punto della settimana» su Oggi, «Aggiorna obiettivo» con «Annulla» (`restoreTargets`) anche nella card del profilo, «Non ora» fino alla settimana dopo (`profile.last_check_in_week`, migrazione 0010); riepilogo push del lunedì nel cron della pesata; grafico del fabbisogno stimato in Progressi; logica pura in `src/lib/nutrition/check-in.ts`.
- **2026-10-17, suggerimenti per pasto**: la scheda Recenti di /add diventa Suggeriti, con classifica per pasto calcolata sul server per tutti e quattro i pasti (`mealSuggestions`, logica pura in `src/lib/nutrition/meal-suggestions.ts`); ricette con ultima quantità e aggiunta in un tocco; le voci di un alimento globale e della sua copia personale contano insieme nella classifica, e l'ultima quantità della copia considera anche le voci dell'alimento sostituito (in tutte le liste, compresi i recenti del connettore Claude).

- **2026-10-17, annullamento e modifica rapida**: «Annulla» in tutti i toast che aggiungono voci (`deleteDiaryEntries` elimina in blocco le voci create; `copyMeal` e `logSavedMeal` restituiscono gli id; helper `toastWithUndo`); l'editor della voce ha ±10 g, le porzioni dell'alimento (`DiaryEntryView` porta unità e porzioni) e le scorciatoie ½-2 per le ricette, e salva l'etichetta della porzione; il dettaglio del pasto salvato ha le azioni in `ScreenFooter`, «Aggiungi al diario» (`/add?savedMeal=…`, con scelta del pasto nel drawer) e la conferma prima di eliminare; toast con accordo neutro.
- **2026-10-20, T34**: lo scanner barcode non è più solo in Aggiungi (dove registra nel diario): anche su Cibo e nel form dell'alimento, per creare un alimento dal codice senza registrarlo; il codice a barre ora è visibile e modificabile nel form, con validazione in italiano.
- **2026-10-20, T36**: endpoint per Siri con token personale (tabella `api_token`, colonna `diary_entry.source`, migrazione 0013, nata come 0010 sul branch); due chiamate AI fisse con riferimenti brevi (R…, M…, F…) per ricette, pasti salvati e candidati; annullamento dell'ultima registrazione; il connettore Claude ora marca le sue voci come `connector`.
- **2026-10-21, T35**: il connettore per Claude crea alimenti e ricette, trova prodotti per codice a barre, registra pasti salvati e pesate e legge i progressi; la logica di scrittura di alimenti e ricette è passata dalle action a `src/server/food-writes.ts` e `src/server/recipe-writes.ts`; nuovi controlli di coerenza (`src/lib/nutrition/food-checks.ts`: macro oltre 100 g su 100 g, zuccheri oltre i carboidrati, saturi oltre i grassi) validi anche per il form; le kcal lontane da 4/4/9 sono solo un avviso per Claude (alcol e polioli); `search_foods` ora distingue peso da cotto e peso da crudo delle ricette.
- **2026-10-21, deploy da GitHub**: il progetto Vercel è collegato al repository; il push di `main` fa il deploy in produzione, le migrazioni vanno applicate a main prima del push.
- **2026-10-21, Open Food Facts 404**: l'API dei prodotti ora risponde 404 (non più 200 con `status: 0`) ai codici sconosciuti; `fetchOpenFoodFactsProduct` lo tratta come «non trovato», così lo scanner apre «Nuovo alimento» e `lookup_barcode` del connettore non dà errore.
- **2026-10-21, merge dei branch del 2026-10-18**: barre kcal arancioni sopra l'obiettivo, contrasto di `--over` (token `--over-text`) e dello swipe «Elimina», `h1` nascosti e chip con `aria-pressed`, skeleton di /food e /progress con la forma delle pagine, azioni dei form di alimento e profilo nel `ScreenFooter`, copia da un giorno qualsiasi (`copyMealEntries`), peso obiettivo (migrazione 0011, `src/lib/nutrition/target-weight.ts`), giorno incompleto (tabella `incomplete_day`, migrazione 0012; la soglia dei 600 kcal ora si chiama `partialDayKcal`). Siri rinumerato da T34 a T36 e la sua migrazione da 0010 a 0013.
- **2026-10-21, deploy**: primo deploy automatico dal push di `main`; le migrazioni 0011-0013 sono state applicate a main mentre il deploy era in build, quindi per circa un minuto il codice nuovo poteva trovare lo schema vecchio. Smoke test superato.
- **2026-10-21, giorni incompleti nel connettore**: `get_progress` non conosceva i giorni segnati come incompleti e dava a Claude medie e budget settimanale diversi da quelli dell'app; ora li legge da `incomplete_day`. `feature/claude-connector-tools` archiviato con il tag `archive/claude-connector-tools` (il suo `get_summary` accettava anche un giorno passato, `get_progress` parte sempre da oggi).
- **2026-10-22, pentole**: tabella `cookware` (migrazione 0014) con gestione in Profilo › Impostazioni › Pentole; nell'editor della ricetta «Pesa con la pentola» apre un drawer che sottrae la tara dal peso totale e ricorda l'ultima pentola usata nel browser; i pesi accettano il punto delle migliaia («1.250», `parseWeightGrams` in `src/lib/nutrition/cookware.ts`).

## Riferimenti
- `docs/spec.md`: stack, tabella decisioni Q1-Q24, regole di dominio (nutrienti per 100 g, ricette con peso da cotto, snapshot nel diario, Mifflin-St Jeor, macro predefinite), infrastruttura.
- `docs/tasks.md`: T01-T37 e i fix successivi.
- `README.md`: funzionalità, setup locale, variabili, comandi database, migrazione legacy, connettore per Claude, Siri, deploy.
- `CLAUDE.md`: istruzioni operative per gli agenti.
