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
