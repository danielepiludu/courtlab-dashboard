# Basket Monitor

PWA Android installabile e offline per allenatori di basket: gestisce **più squadre** (una per stagione) e monitora minuti giocati e carico di fatica (INT) dei giocatori durante la partita. Interfaccia in italiano.

React + TypeScript + Vite · Tailwind · Zustand · Dexie (IndexedDB) · vite-plugin-pwa · Wake Lock API. Nessun backend: i dati restano sul dispositivo (con backup JSON esportabile).

## Multi-squadra e tema dinamico

- Sempre **una squadra attiva** (salvata e ripristinata all'avvio): giocatori, calendario e resoconti sono separati per squadra.
- Al primo avvio esiste già **Pallacanestro Don Bosco Livorno** (logo incluso, navy `#002855` + rosso `#EE3239`).
- Header della Home → selettore squadre → **Gestisci squadre**: crea, modifica, archivia/riattiva, elimina (conferma forte), duplica per nuova stagione.
- Le squadre archiviate restano consultabili in **sola lettura**.
- I colori sono **variabili CSS** generate a runtime dai due colori della squadra (`src/theme/palette.ts`): sfondi sempre scuri, contrasto testo ≥ 4.5:1, correzione automatica dei colori troppo chiari o troppo simili. Le regole sono verificate da test automatici su centinaia di combinazioni.
- Caricando un logo, i due colori dominanti vengono proposti in automatico (`src/theme/extract.ts`).

## Schermata partita

- Mezzo campo FIBA **verticale** (canestro in alto) su **parquet**: il bordo campo ha il colore della squadra e, ai lati, il **logo della squadra attiva**; quando c'è spazio in altezza (tablet) compare anche il cerchio di centrocampo col logo. Pitturato nel colore della squadra con bordo d'accento.
- 5 in campo: 2 lunghi nel pitturato (sotto al ferro, che resta visibile), 3 esterni fuori dall'arco (punta e ali). Le posizioni sono verificate da test (mai sovrapposte).
- **Panchina** a sinistra, stretta, con schede su 2 colonne: minuti giocati e tempo reale in panchina, che scorre anche a cronometro fermo.
- Timer a timestamp: tutto fermo fino al primo Start; Q1-Q4 da 10:00, OT da 5:00; a fine periodo si ferma a 00:00 e Start avvia il successivo.
- Pulsanti **±5 secondi** accanto al cronometro: correggono il tempo di gioco e di conseguenza i minuti dei giocatori in campo e i tempi in panchina.
- Cambi: selezione multipla, "Conferma cambio" solo con numeri uguali (1-1, 2-2…), animazione, funziona anche a cronometro fermo.
- Punteggio con **animazioni** accanto al numero quando si segna (+1/+2/+3, scintille sul +3) o si annulla.
- Lo stato si salva a ogni azione: chiudendo l'app per sbaglio la partita riprende esattamente da dove era. Il tasto Indietro apre il menu invece di uscire.

## Motore INT (Fase 3)

L'INT misura il **carico di fatica dello stint** su scala **0–1**: non solo quanto un giocatore resta in campo, ma quanto quel tempo gli costa e quanto recupera. Funzioni pure in `src/engine/int.ts`, parametri e spiegazione in `src/engine/intConfig.ts`, test in `src/engine/int.test.ts`.

Basi dalla letteratura (le stesse citate da 5in.app):
- **Stojanović et al., 2018** — il basket è intermittente: il carico cresce col tempo di gioco *effettivo*, non con i tempi morti.
- **Pérez-Chao et al., 2021** — i minuti accumulati riducono i picchi di prestazione: chi ha giocato molto si affatica prima e recupera più lentamente.
- **Gómez et al., 2016** — le sostituzioni servono a recuperare.

Modello (carico acuto A + residuo R):
- **a) in gioco** (cronometro in corso): `dA/dt = 0,07 · (1 + 0,08·min consecutivi) · (1 + 0,015·min totali) · (1 − A)` (soluzione esatta). I minuti consecutivi ripartono da 0 a ogni ingresso e dopo ogni intervallo.
- **b) interruzioni in campo** (cronometro fermo): nei primi **20 s** nessun recupero (fallo, rimessa, tiri liberi), poi `A · exp(−t / 10′)` (timeout, interruzioni lunghe).
- **c) panchina**: `A_uscita · exp(−t / τ)`, con `τ = 5′ · (1 + 0,02·min totali)`: più minuti giocati, recupero più lento.
- **d) intervalli tra i periodi**: tutti recuperano come in panchina (anche chi chiude il periodo in campo).
- **residuo** `R = min(0,3; 0,005·min totali)`: fatica che non si smaltisce durante la partita.
- **INT = R + (1 − R) · A**, sempre tra 0 e 1.

Scenari verificati dai test (`liveModel.test.ts`, "scenari di partita"):

| Situazione | INT |
|---|---|
| 3′ / 5′ / 8′ / 10′ di gioco continuo da riposato | 0,23 / 0,37 / 0,56 / 0,67 |
| 10′ di gioco con fermate di 30 s ogni 30 s | 0,62 |
| timeout di 1′ dopo 5′ | 0,37 → 0,35 |
| intervallo di 2′ dopo 10′ in campo | 0,67 → 0,49 |
| intervallo di metà gara (15′) | 0,67 → 0,10 (resta il residuo) |
| 5′ in campo, poi 2′ / 4′ in panchina | 0,37 → 0,26 / 0,19 |

Grafica: numero INT grande (font Teko) colorato **bianco → giallo → arancio → rosso** con barra dritta a gradiente sotto, freccia di tendenza (sale / cala piano / recupera), livello (Fresco, Attivo, Affaticato, Da cambiare); sopra 0,80 il bordo della card pulsa di rosso.

Lo stato salvato contiene carico, minuti e istanti di ingresso/uscita: dopo una chiusura l'INT si ricostruisce esattamente. Ogni 30 s viene registrato un campione per il grafico del resoconto. **Vista debug nascosta**: tieni premuto il cronometro per circa 1 secondo.

## Resoconto finale e PDF (Fase 4)

- **Termina partita** → conferma "Sei sicuro di voler concludere la partita?" → si apre il **resoconto**: punteggio ed esito, periodi e durata, migliori della partita (più minuti, INT di picco, più ingressi) e, per ogni convocato, minuti giocati, ingressi, **INT medio**, **INT di picco** e **mini-grafico dell'INT nel tempo** (fasce = in campo, linee tratteggiate = inizio periodo). Ordinabile per minuti, picco, medio o numero.
- **Esporta PDF**: A4 pulito su sfondo bianco, intestazione nel colore primario della squadra con il logo, dettagli nel secondario, punteggio, data e avversario, migliori, tabella dei convocati con mini-grafico INT disegnato nel PDF, legenda. Sui telefoni che lo supportano c'è anche **Condividi** (WhatsApp, Drive, email…).
- Chiudendo il resoconto si torna al primo substrato. La partita risulta conclusa nel calendario e il resoconto si riapre in qualsiasi momento dalla tab **Resoconti** (o toccando la partita nella Home).
- I resoconti sono salvati nella tabella `reports` con un'istantanea dei convocati: modificare o eliminare un giocatore dopo non cambia il resoconto. Sono inclusi nel backup.

## Comandi

```bash
npm install          # dipendenze
npm run dev          # sviluppo su http://localhost:5173 (raggiungibile dal telefono sulla stessa Wi-Fi)
npm test             # test automatici (vitest): tema, timer, INT, campo, resoconto, PDF
npm run build        # typecheck + build di produzione in dist/
npm run preview      # serve la build (con service worker) su http://localhost:4173
npm run icons        # rigenera logo e icone da assets/logo-source.png (Python 3 + Pillow)
```

## Deploy su GitHub Pages

1. Una tantum, nel repository GitHub: **Settings → Pages → Build and deployment → Source: GitHub Actions**.
2. Ogni push su `main` esegue `.github/workflows/deploy.yml`: `npm ci` → `npm test` → `npm run build` con `VITE_BASE=/<nome-repo>/` → pubblicazione.
3. L'app è su `https://<utente>.github.io/<nome-repo>/` (qui: `https://danielepiludu.github.io/minuti-basket-pro/`).

Il **base path** si imposta con la variabile `VITE_BASE` (vedi `vite.config.ts`): `/` in locale, `/<nome-repo>/` su GitHub Pages, `./` per Capacitor. Manifest, service worker, icone e logo usano tutti il base path.

## Installazione su Android (PWA)

1. Apri l'indirizzo di GitHub Pages in **Chrome**.
2. Menu **⋮ → Installa app** (o "Aggiungi a schermata Home").
3. Si apre a schermo intero, funziona **offline** (anche il PDF), tiene lo schermo acceso durante la partita. Gli aggiornamenti arrivano da soli: chiudi e riapri l'app.
4. I dati restano sul telefono: usa **⚙ → Esporta backup** prima di cambiare telefono e **Importa backup** su quello nuovo.

## APK con Capacitor (opzionale)

Richiede Android Studio (con SDK) sul computer.

```bash
npm install @capacitor/core @capacitor/cli @capacitor/android
npx cap init "Basket Monitor" it.basketmonitor.app --web-dir dist
VITE_BASE=./ npm run build
npx cap add android
npx cap sync android
npx cap open android      # Android Studio → Build → Build Bundle(s) / APK(s) → Build APK(s)
```

Dopo ogni modifica: `VITE_BASE=./ npm run build && npx cap sync android`. Il codice non usa API che richiedono un server: timer a timestamp, dati in IndexedDB, vibrazione e wake lock con fallback (sostituibili con i plugin Capacitor `Haptics` e `KeepAwake` in `src/lib/haptics.ts` e `src/lib/device.ts`).

## Struttura

```
├── assets/logo-source.png           logo originale della squadra predefinita (non distribuito)
├── public/
│   ├── logo.png                     logo Don Bosco ritagliato, sfondo trasparente
│   └── icons/                       icone PWA 192/512, maskable, apple-touch, favicon
├── scripts/make-icons.py            genera logo e icone
├── index.html                       applica subito il tema dell'ultima squadra (nessun lampo di colori)
├── vite.config.ts                   base path, PWA (manifest + service worker offline), test
├── src/
│   ├── main.tsx · App.tsx           avvio, splash, ripristino partita in corso, substrati
│   ├── index.css                    variabili tema (@property, transizioni), animazioni
│   ├── config.ts                    nome app, squadra predefinita, stagioni, durata periodi
│   ├── engine/
│   │   ├── intConfig.ts             parametri e spiegazione del modello INT
│   │   ├── int.ts                   motore INT (funzioni pure)
│   │   └── int.test.ts
│   ├── theme/
│   │   ├── color.ts                 conversioni, luminanza e contrasto WCAG
│   │   ├── palette.ts (+ test)      palette scura dai due colori della squadra
│   │   ├── extract.ts               colori dominanti dal logo
│   │   ├── apply.ts                 variabili CSS, logo, istantanea per l'avvio
│   │   └── ThemeController.tsx      applica il tema della squadra attiva
│   ├── db/
│   │   ├── types.ts                 Team, Player, Game, GameReport
│   │   ├── db.ts                    schema Dexie v3 (migrazioni dalle versioni precedenti)
│   │   ├── hooks.ts                 query reattive filtrate per squadra attiva
│   │   └── repo.ts                  CRUD, squadre (duplica/archivia/elimina), backup, dati di esempio
│   ├── store/
│   │   ├── ui.ts                    squadra attiva, tab, substrato, bozze convocazioni, resoconto aperto
│   │   ├── live.ts                  partita in corso (salvataggio continuo) e chiusura
│   │   └── feedback.ts              toast e dialog di conferma
│   ├── lib/                         date, vibrazione, immagini, tasto Indietro, fullscreen/wake lock, useNow
│   ├── components/                  UI condivisa (Button, Sheet, Num…), TeamLogo, TabBar, Splash, PhotoCropper
│   └── features/
│       ├── teams/                   selettore, schermata Squadre, form squadra con anteprima tema
│       ├── home/                    calendario, prossima partita, form partita
│       ├── players/                 lista con filtri, scheda giocatore
│       ├── match/                   selettore partita, convocati, quintetto, partita in corso
│       ├── live/                    schermata partita: liveModel (+ test), campo SVG, geometria (+ test),
│       │                            card campo/panchina, debug INT
│       ├── report/                  riepilogo (+ test), schermata resoconto, grafico INT, PDF (+ test)
│       └── reports/                 tab Resoconti
└── .github/workflows/deploy.yml     test + build + GitHub Pages
```

## Stato delle fasi

- [x] **Fase 1** — scaffolding, multi-squadra con tema dinamico, primo substrato (Home, Giocatori, Partita, Resoconti), persistenza, backup
- [x] **Fase 2** — schermata partita: campo verticale in parquet con logo della squadra, card, panchina, timer con ±5 s, cambi con conferma, animazioni punteggio
- [x] **Fase 3** — motore INT 0–1 con test automatici e vista debug
- [x] **Fase 4** — resoconto finale, grafici INT, export PDF, tab Resoconti completa
