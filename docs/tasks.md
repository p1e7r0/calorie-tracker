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
- [ ] T20 Calendario con i giorni registrati, niente giorni futuri
- [ ] T21 Pesata rapida: solo peso, «Altre misure» precompilate dall'ultima volta
- [ ] T22 Scheda Cibo: filtri e ordinamento per uso
- [ ] T23 Gesti sulle voci del diario: scorri per eliminare o duplicare
- [ ] T24 Grafica: righe del diario compatte, data nell'intestazione, schede allineate a sinistra, variazione del peso chiara, profilo diviso
- [ ] T25 Obiettivo che si adatta: fabbisogno stimato da peso e kcal reali
- [ ] T26 Reset della password via email (attivo con `RESEND_API_KEY`)
- [ ] T27 AI: foto dell'etichetta e pasto descritto a parole (attivo con `ANTHROPIC_API_KEY`)
- [ ] T28 Budget settimanale
- [ ] T29 Esporta i dati in CSV ed elimina l'account
- [ ] T30 Fibre, zuccheri, grassi saturi e sale nel diario
- [ ] T31 Promemoria con notifiche push della PWA
