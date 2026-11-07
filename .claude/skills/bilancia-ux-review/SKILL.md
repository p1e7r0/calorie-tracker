---
name: bilancia-ux-review
description: Test di usabilità simulato di Bilancia con Playwright. Usala quando si chiede di valutare l'ergonomia dell'immissione dati, trovare frizioni, tap superflui o lentezze nell'interfaccia di Bilancia.
---

# Bilancia UX review

## Obiettivo
Simulare un utente reale che inserisce dati in Bilancia e misurare la frizione. Niente consigli generici: ogni osservazione è legata a un passo misurato e a uno screenshot.

## Riferimento
Il benchmark è il connettore per Claude: una frase, zero tap. Ogni flusso dell'interfaccia si giudica per distanza da questo riferimento.

## Ambiente
1. Database locale, mai Neon main. `pnpm seed:ux` rifiuta un host non locale (con `--allow-remote` accetta un branch dedicato, mai produzione). Nel container cloud: `pg_ctlcluster 16 main start`, poi `pnpm db:migrate`.
2. Il seed azzera e ricrea due utenti con password `UX_PASSWORD` (default `password-sicura`):
   - `ux-full@example.com`: due settimane di diario (oggi vuoto), tre ricette, un giorno incompleto, preferiti, pesate, pasto salvato «Colazione solita», «Minestrone» in frigo, due pentole.
   - `ux-empty@example.com`: profilo compilato e nessun altro dato, per gli stati vuoti.
   Aggiunge anche un mini catalogo globale (31 alimenti, `source_reference` `ux-seed:*`, valori approssimati) così la ricerca non dipende da Open Food Facts.
3. Tempi sempre su build di produzione: `pnpm build && pnpm start`. Con `pnpm dev` la prima apertura di ogni route compila e produce lentezze finte.
4. Viewport mobile 390×844 di default; desktop solo come confronto (`--desktop` o `UX_DESKTOP=1`). Niente mock delle API.

## Strumenti
- `pnpm ux:scenarios`: seed, login (storage state in `ux-review/.auth/`), poi gli scenari scriptati di `ux-review/scenarios.spec.ts`. È la base ripetibile per confrontare versioni.
- `pnpm ux <comando>`: driver interattivo, un passo per comando, con screenshot. Serve a esplorare guardando lo schermo. Comandi: `start [--user empty] [--desktop]`, `scenario <slug> [titolo]`, `tap <testo visibile>` oppure `tap <x> <y>`, `type <testo>`, `replace <testo>`, `press <tasto>`, `scroll <px>`, `back`, `shot`, `note <hesitation|dead-end|friction|observation> <testo>`, `end`, `stop`. Fermalo prima di rilanciare il seed.
- `pnpm ux:report`: aggrega le metriche in `ux-report/summary.md`.
- Output in `ux-report/<scenario>/`: uno screenshot per passo e `metrics.json`.

## Regole di navigazione (driver)
- Dopo ogni comando apri lo screenshot e decidi il passo successivo da lì, come una persona, senza leggere il DOM.
- Tocca per testo visibile o per coordinate dello screenshot (scala 1, coordinate in px CSS).
- Se un elemento è difficile da trovare a vista, registralo con `note friction` anche se raggiungibile.
- Parti sempre da `/`: niente `--url` per saltare passaggi, salvo controlli di stati vuoti.
- Registra con `note hesitation` ogni punto in cui il passo successivo non è ovvio, e con `note dead-end` i vicoli ciechi. Gli scenari scriptati non sanno esitare: quelle colonne valgono solo per il driver.

## Cosa misura il registratore
- Tap (compresi Invio e indietro), compilazioni di campo, aperture della tastiera, battute, schermate attraversate (cambio di percorso o di titolo, overlay), ritorni, scroll.
- Per ogni passo: tempo fino a pagina assestata (nessuna richiesta in corso e DOM fermo da 300 ms), separando rete e rendering.
- Regola iOS, attiva di default (`UX_IOS_KEYBOARD=0` la spegne): scrivere in un campo che ha il focus senza essere stato toccato costa un tocco in più. È un'ipotesi sul comportamento di Safari da verificare su iPhone: nei confronti riporta entrambe le versioni.

## Limiti noti
- Chromium headless non mostra la tastiera e non accorcia il viewport: con la tastiera aperta gli screenshot mostrano più spazio di un iPhone.
- Il «giorno dopo» non si simula: la data di preparazione non può essere futura, quindi lo scenario 6 resta nella stessa sessione.
- Il «+ centrale» propone il pasto in base all'ora: lo scenario 5 dipende dall'orario di esecuzione (annotato nelle note).
- I tempi misurano il server locale, non la rete mobile né Vercel.

## Scenari
1. **Inserimento veloce**: registra una mela partendo da Oggi. Metrica chiave: tempo e tap fino al salvataggio.
2. **Inserimento ripetuto**: pasta, insalata e pane nello stesso pasto. Verifica se dopo ogni voce l'app riporta indietro o svuota la ricerca.
3. **Correzione**: modifica la quantità di una voce di ieri.
4. **Pasto ricorrente**: rifai la colazione abituale con copia da ieri e con il pasto salvato.
5. **Sezione pasto contro + centrale**: stesso inserimento dai due punti. Concludi se uno dei due è ridondante, con i numeri.
6. **Catena ricette e frigo**: crea «Lenticchie in padella» (sei ingredienti, peso cotto, porzioni) e «Patate al vapore», combinale in un pasto messo da parte in frigo, consuma una porzione. Misura il costo di ogni ingrediente (la ricerca riparte da zero?), la chiarezza di peso cotto e porzioni, i passi per combinare e per consumare.
Più due di contorno: tempi dei cambi menu (freddo e caldo) e stati vuoti con l'utente senza dati.

## Output
Scrivi `ux-report/report.md` partendo da `ux-report/summary.md` e dagli screenshot:
1. Tabella per scenario: tap, campi, schermate, tempo, distanza dal connettore.
2. Registro frizioni per gravità (bloccante, alta, media, bassa): scenario, passo, screenshot, descrizione, proposta concreta, passi risparmiati stimati.
3. Tempi dei cambi menu, con i più lenti in evidenza.
4. Verdetto su sezione pasto contro + centrale.
5. Tre interventi a maggior rapporto beneficio/costo.

Segna come ipotesi ogni conclusione che non poggia su una misura.
