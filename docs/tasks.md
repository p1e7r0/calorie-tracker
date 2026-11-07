# Task

Ogni task ha il suo branch, viene verificato (`tsc`, `eslint`, test, build, controllo nel browser) e poi unito su `main`.

- [x] T01 Scaffold: Next.js 16, Tailwind 4, shadcn, tema chiaro/scuro, layout mobile con barra in basso, PWA manifest, Vitest, Playwright
- [x] T02 Database: schema Drizzle, Postgres locale in Docker, migrazioni
- [x] T03 Autenticazione: Better Auth, login/registrazione, protezione delle pagine, onboarding profilo
- [x] T04 Logica di dominio: nutrienti, ricette, Mifflin-St Jeor, con test
- [x] T05 Migrazione dal vecchio MongoDB: alimenti, ricette, misurazione, preferiti
- [x] T06 Diario "Oggi": giorni, 4 pasti, riepilogo, aggiunta voce (ricerca, grammi/porzioni, recenti, preferiti), kcal veloci, modifica/eliminazione, copia pasto
- [x] T07 Catalogo alimenti: ricerca, creazione rapida, modifica, porzioni, preferiti, copia privata degli alimenti globali
- [x] T08 Open Food Facts: ricerca e barcode
- [x] T09 Ricette: editor, peso da cotto, porzioni, registrazione nel diario
- [x] T10 Pasti salvati
- [x] T11 Misure corporee: inserimento e grafici
- [x] T12 Profilo e obiettivi: calcolo, modifica, tema
- [x] T13 Progressi: statistiche kcal, macro, peso
- [x] T14 Neon: progetto, branch, migrazione dati in cloud
- [x] T15 Rifinitura: e2e smoke, controllo visivo, README

## Seconda fase: migliorie dall'analisi del 16 ottobre

- [x] T16 Bug: linea dell'obiettivo nel grafico kcal, media senza il giorno in corso, cancellazione di un account con ricette, notifiche in basso
- [x] T17 Aggiunta in un tocco dai recenti con l'ultima quantità e «Annulla»; scorciatoie utili nella scheda quantità (ultima, porzioni, ±10 g)
- [x] T18 Open Food Facts automatico quando il catalogo trova pochi risultati
- [x] T19 Ricetta in sola lettura con «Aggiungi al diario», modifica separata, porzioni ricalcolabili, duplica ricetta
- [x] T20 Calendario con i giorni registrati, niente giorni futuri
- [x] T21 Pesata rapida: solo peso, «Altre misure» precompilate dall'ultima volta
- [x] T22 Scheda Cibo: filtri e ordinamento per uso
- [x] T23 Gesti sulle voci del diario: scorri per eliminare o duplicare
- [x] T24 Grafica: righe del diario compatte, data nell'intestazione, schede allineate a sinistra, variazione del peso chiara, profilo diviso
- [x] T25 Obiettivo che si adatta: fabbisogno stimato da peso e kcal reali
- [x] T26 Reset della password via email (attivo con `RESEND_API_KEY`)
- [x] T27 AI: foto dell'etichetta e pasto descritto a parole (attivo con `ANTHROPIC_API_KEY`)
- [x] T28 Budget settimanale
- [x] T29 Esporta i dati in CSV ed elimina l'account
- [x] T30 Fibre, zuccheri, grassi saturi e sale nel diario
- [x] T31 Promemoria con notifiche push della PWA

## Terza fase

- [x] T32 Connettore per Claude: server MCP con OAuth (credenziali dal profilo, consenso, strumenti per cercare alimenti e registrare i pasti)
- [x] T33 Pull-to-refresh in stile Mail di iOS su Oggi e Progressi (`router.refresh()`, nessun reload)
- [x] T34 Nuovo alimento da codice a barre: scanner anche su Cibo e nel form (campo «Codice a barre» visibile e modificabile)
- [x] T35 Connettore per Claude: creare alimenti e ricette, codice a barre, pasti salvati, pesata e progressi; controlli di coerenza dei valori nutrizionali anche nel form
- [x] T36 Siri: `POST /api/shortcuts/meal` registra un pasto dettato (alimenti, ricette, pasti salvati) con due chiamate AI fisse; `DELETE` annulla l'ultimo; token personale con un solo permesso dal profilo
- [x] T37 Connettore per Claude: `copy_meal` copia un pasto da un giorno qualsiasi (ripreso da `feature/claude-connector-tools`, i cui `log_weight` e `get_summary` erano già coperti da T35)
- [x] T38 Connettore per Claude: modifica ed eliminazione di voci, alimenti, ricette, pasti salvati e misure, preferiti, giorno incompleto, profilo e obiettivi (logica di scrittura condivisa con le action in `src/server/*`)
- [x] T39 Pasti messi da parte: pasti in frigo o congelatore composti da alimenti e ricette, a porzioni (ogni registrazione ne toglie una, a zero spariscono), con data di preparazione e avviso oltre 3 giorni in frigo o 90 in congelatore; creazione da zero o dal menu ⋯ di un pasto del diario; registrazione da Aggiungi › Pasti con «Annulla» che restituisce la porzione; strumenti `store_meal`, `update_stored_meal`, `delete_stored_meal` e voce `storedMeal` di `log_meal` nel connettore (migrazione 0015)

## Fix successivi

- [x] `fix/weekly-budget-unlogged-days`: i giorni passati senza voci contano come in linea con l'obiettivo nel budget settimanale
- [x] `fix/standalone-status-bar`: header lontani dalla sfocatura della status bar nella PWA iOS installata
- [x] `fix/today-header-offset`: header di Oggi allineato a quello delle altre schede
- [x] `fix/logging-flow-friction`: il «+» della barra in basso porta il giorno visualizzato e /add mostra «Diario di …» quando non è oggi; Invio registra la quantità (scheda quantità ed editor della voce); ricerca svuotata e rimessa a fuoco dopo un'aggiunta; aree di tocco di almeno 44 px (utility `touch-target`) e schede alte 40 px
- [x] `feature/weekly-check-in`: «Il punto della settimana» su Oggi con aggiornamento dell'obiettivo in un tocco e «Annulla», riepilogo push del lunedì, grafico del fabbisogno stimato in Progressi (migrazione 0010)
- [x] `feature/meal-suggestions`: scheda Suggeriti in /add ordinata per pasto (frequenza e recenza), ricette con ultima quantità e aggiunta in un tocco
- [x] `feature/quick-undo-and-editing`: «Annulla» dopo Kcal veloci, pasto salvato, «Copia da ieri» e «Descrivi»; ±10 g, porzioni dell'alimento e scorciatoie per le porzioni di ricetta nell'editor della voce; «Aggiungi al diario» e conferma all'eliminazione nel dettaglio del pasto salvato; toast con accordo neutro («Aggiunto a pranzo: «Mela»»)
- [x] `chore/spec-decisions`: decisioni superate di `docs/spec.md` aggiornate (deploy per blocco, stima adattiva e check-in, statistiche, connettore per Claude, Open Food Facts automatico, ricerca con parole corte)
- [x] `chore/vercel-git-deploy`: progetto Vercel collegato a GitHub, il push di `main` fa il deploy in produzione; procedura di deploy aggiornata
- [x] `feature/over-target-bars`: barre del grafico kcal in arancione nei giorni sopra l'obiettivo
- [x] `fix/color-contrast`: contrasto di «oltre l'obiettivo» sul testo piccolo e dello swipe «Elimina» in tema scuro, con test dei rapporti
- [x] `fix/accessibility-landmarks`: `h1` su Oggi e in Aggiungi, chip dei filtri come pulsanti con `aria-pressed`
- [x] `fix/skeleton-shapes`: skeleton di Cibo e Progressi con schede, campo di ricerca e blocchi alti come la pagina vera
- [x] `feature/form-actions-in-footer`: «Salva» di alimento e profilo nel footer, con l'errore sopra il pulsante
- [x] `feature/copy-from-any-day`: copia di un pasto da un giorno e pasto qualsiasi, con calendario e anteprima
- [x] `feature/target-weight`: peso obiettivo facoltativo con data prevista in Profilo e Progressi (migrazione 0011)
- [x] `feature/incomplete-day`: giorno segnato come incompleto, escluso da medie, stima adattiva e check-in (migrazione 0012)
- [x] `fix/open-food-facts-not-found`: un codice a barre sconosciuto apre «Nuovo alimento» invece di «Open Food Facts non risponde» (l'API ora risponde 404 ai prodotti mancanti); test e2e allineati ai merge del 2026-10-21
- [x] `chore/deploy-october-merges`: deploy in produzione dei merge del 2026-10-21 (migrazioni 0011-0013 su main, smoke test)
- [x] `fix/connector-incomplete-days`: `get_progress` del connettore esclude dalle medie i giorni segnati come incompleti, li conta in linea nel budget settimanale e li indica con `incomplete: true`, come l'app
- [x] `chore/docs-refresh`: README, CLAUDE.md, CONTEXT.md e spec allineati alle funzionalità di T34-T37 e ai branch del 2026-10-18 (strumenti del connettore, Siri, struttura del repository, modello dati, glossario)
- [x] `fix/keyboard-covers-overlays`: su iOS la tastiera non copre più la quantità nella scheda dell'alimento e della ricetta; drawer, dialog, scanner barcode e selettore degli ingredienti seguono il visual viewport (`--keyboard-inset`)
- [x] `fix/preview-deployments`: i preview di Vercel usano Neon dev e permettono il login (URL base di better-auth da `VERCEL_BRANCH_URL`/`VERCEL_URL` quando manca `BETTER_AUTH_URL`)
- [x] `feature/cookware-tare`: pentole salvate con il peso a vuoto (Profilo › Impostazioni › Pentole, migrazione 0014) e «Pesa con la pentola» nell'editor della ricetta, che toglie la tara dal peso totale
- [x] `fix/cookware-test-format`: Profilo › Impostazioni andava in errore in produzione perché la migrazione 0014 non era mai stata applicata (né a dev né a main); applicata a entrambi. Corretto `e2e/cookware.spec.ts`, che si aspettava «1.250 g» mentre `formatGrams` non raggruppa le 4 cifre («1250 g»)
- [x] `chore/agent-permissions`: CLAUDE.md, spec e CONTEXT.md registrano il permesso permanente di fare push, migrazioni e deploy senza conferma
- [x] `feature/recipe-serving-weight`: peso fisso della porzione nelle ricette («Imposta i grammi» nell'editor, colonna `recipe.serving_grams`, migrazione 0016); una porzione pesa sempre quei grammi e il numero di porzioni si ricava dal peso finale (anche decimale); vista, Aggiungi, Cibo, connettore per Claude (`servingGrams` in `create_recipe`, `update_recipe` e nelle risposte) e Siri usano il peso della porzione
- [x] `fix/stale-viewport-offset`: su iOS la shell non scende più lasciando spazio vuoto sopra l'header e tagliando la bottom nav; `--viewport-offset-top` vale solo con la tastiera aperta e i valori del visual viewport si rileggono dopo chiusura della tastiera e ritorno in primo piano
- [x] `fix/ux-review-contrast-and-touch-targets`: revisione UX/UI su tutte le schermate (chiaro e scuro, 390×844). Stato selezionato dei `ToggleGroup` da `bg-muted` a `bg-foreground` con testo invertito e `font-semibold`: il contrasto contro lo sfondo passa da 1,10:1 a 15,5:1 in chiaro e da 1,30:1 a 15,2:1 in scuro (WCAG 1.4.11 chiede 3:1), e differenzia il selettore del pasto dai tab in `/add`. Aree di tocco portate a 44 px: voci del diario, stato vuoto del pasto, icone di `BackHeader`, stepper delle porzioni nella ricetta, back di Aggiungi, pill di Cibo (con `gap-2`), `TabsList` a `h-12`, `toggleVariants` a `h-11`/`h-10`. «Il punto della settimana» spostato sotto i pasti: il primo pasto di Oggi passa da 649 px a 381 px dall'alto. Kcal residue previste nella scheda della quantità e nell'editor della voce. Riga del budget settimanale su due righe per evitare il ritorno a capo. In Progressi: etichette dei giorni da `weekday: "narrow"` (due «M» indistinguibili) a `short`, selettore del periodo di Alimentazione spostato sotto il grafico come in Corpo, etichette «30 giorni»/«90 giorni» al posto di «30 g»/«90 g» (ambigue con i grammi), didascalia della media riscritta perché il grafico mostra anche oggi mentre la media lo esclude
- [x] `feature/connector-containers`: le pentole di Profilo › Impostazioni diventano i «contenitori» del connettore per Claude (`list_containers`, `create_container`, `update_container`, `delete_container`); `update_recipe` accetta `grossWeightG` + `containerId` al posto di `cookedWeightG` e `log_meal` accetta `grossGrams` + `containerId` al posto di `grams` per alimenti e ricette, con il server che sottrae la tara e rifiuta un netto ≤ 0; la logica di scrittura delle pentole è in `src/server/cookware.ts`, condivisa da action e connettore
- [x] `fix/preview-shared-auth-secret`: i preview non falliscono più dopo il login con «Failed to decrypt private key»: `BETTER_AUTH_SECRET` di Preview coincide con quello locale perché entrambi usano `jwks` di Neon dev (solo variabile su Vercel e documenti, nessuna modifica al codice)
- [x] `fix/nested-fullscreen-overlays`: su iPhone «Aggiungi ingrediente» (ricetta) e «Aggiungi al pasto» (pasto messo da parte) finivano sotto la tastiera: i due picker usavano `app-viewport` dentro la shell, che è già `app-viewport`, e il `transform` esterno raddoppiava `--viewport-offset-top`; ora sono `absolute inset-0` sulla shell. Test di regressione in `e2e/shell.spec.ts` (offset simulato, il picker coincide con la shell)
- [x] `fix/reveal-focused-field-under-keyboard`: su iPhone, al primo tocco su un campo in basso (es. «Peso da cotto»), la tastiera accorciava la shell e il campo restava nascosto dietro `ScreenFooter`; `VisualViewportSync` ora riporta in vista il campo a fuoco quando la tastiera si apre o cambia altezza (`keyboardChangedShape`, testata), con `scroll-margin-block` sui controlli. Test e2e in `shell.spec.ts` (viewport ridotto con il campo a fuoco)
- [x] `feature/ux-review-harness`: banco di prova per lo skill `bilancia-ux-review` (`.claude/skills/bilancia-ux-review/SKILL.md`). `pnpm seed:ux` crea due utenti (uno con due settimane di diario, ricette, giorno incompleto, pasto salvato, frigo e pentole; uno senza dati) e un mini catalogo globale, solo su database locali. `ux-review/recorder.ts` conta tap, compilazioni, aperture della tastiera (con regola iOS opzionale), schermate, ritorni e tempi fino a pagina assestata separando rete e rendering, con uno screenshot per passo. Driver interattivo `pnpm ux` per esplorare guardando gli screenshot, scenari scriptati `pnpm ux:scenarios` (sei dello skill più cambi menu e stati vuoti) e riepilogo `pnpm ux:report`. Il primo giro ha trovato due difetti, non corretti in questo branch: «Nuova ricetta» riapre i dati della ricetta precedente e il limite del peso da cotto risponde con un messaggio zod in inglese
