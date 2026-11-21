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
- **a) in campo, cronometro in corso**: `dA/dt = 0,07 · (1 + 0,08·min consecutivi) · (1 + 0,015·min totali) · (1 − A)` (soluzione esatta).
- **b) in campo, cronometro fermo**: `A · exp(−t / 15′)` (tempo reale).
- **c) in panchina**: `A_uscita · exp(−t / τ)`, con `τ = 5′ · (1 + 0,02·min totali)`: più minuti giocati, recupero più lento.
- **residuo** `R = min(0,3; 0,005·min totali)`: fatica che non si smaltisce durante la partita.
- **INT = R + (1 − R) · A**, sempre tra 0 e 1. Da riposato: **0,37 dopo 5′, 0,67 dopo 10′, 0,86 dopo 15′** di gioco consecutivo; non arriva mai a 1.

Grafica: anello attorno alla foto e barra a gradiente **bianco → giallo → arancio → rosso** (soglie 0,35 · 0,65 · 0,80), freccia di tendenza (sale / cala piano / recupera), livello (Fresco, Attivo, Affaticato, Da cambiare); sopra 0,80 l'anello pulsa.

Lo stato salvato contiene carico, minuti e istanti di ingresso/uscita: dopo una chiusura l'INT si ricostruisce esattamente. Ogni 30 s viene registrato un campione per il grafico del resoconto. **Vista debug nascosta**: tieni premuto il cronometro per circa 1 secondo.

## Comandi

```bash
npm install          # dipendenze
npm run dev          # sviluppo su http://localhost:5173 (raggiungibile dal telefono sulla stessa Wi-Fi)
npm test             # test automatici (vitest)
npm run build        # typecheck + build di produzione in dist/
npm run preview      # serve la build con service worker su http://localhost:4173
npm run icons        # rigenera logo e icone da assets/logo-source.png (Python 3 + Pillow)
```

## Deploy su GitHub Pages

Il workflow `.github/workflows/deploy.yml` pubblica a ogni push su `main`, compilando con
`VITE_BASE=/<nome-repo>/` (base path corretto per `https://<utente>.github.io/<nome-repo>/`).
Una tantum: *Settings → Pages → Source: GitHub Actions*.

## Installazione su Android (PWA)

1. Apri l'indirizzo di GitHub Pages in **Chrome**.
2. Menu **⋮ → Installa app** (o "Aggiungi a schermata Home").
3. L'app si apre a schermo intero e funziona offline. Gli aggiornamenti arrivano da soli alla riapertura.

## APK con Capacitor (opzionale)

```bash
npm install @capacitor/core @capacitor/cli @capacitor/android
npx cap init "Basket Monitor" it.basketmonitor.app --web-dir dist
VITE_BASE=./ npm run build
npx cap add android
npx cap sync android
npx cap open android      # Android Studio → Build → Build APK
```

## Struttura

```
├── assets/logo-source.png         logo originale della squadra predefinita (non distribuito)
├── public/
│   ├── logo.png                   logo Don Bosco ritagliato, sfondo trasparente
│   └── icons/                     icone PWA 192/512, maskable, apple-touch, favicon
├── scripts/make-icons.py          genera logo e icone
├── index.html                     applica subito il tema dell'ultima squadra (nessun lampo di colori)
├── src/
│   ├── main.tsx · App.tsx         avvio, splash, switch tra i due substrati
│   ├── index.css                  variabili tema registrate con @property (transizioni), animazioni
│   ├── config.ts                  costanti app, squadra predefinita, stagioni, durata periodi
│   ├── theme/
│   │   ├── color.ts               conversioni, luminanza e contrasto WCAG
│   │   ├── palette.ts (+ test)    palette scura dai due colori della squadra
│   │   ├── extract.ts             colori dominanti dal logo
│   │   ├── apply.ts               variabili CSS, logo, istantanea per l'avvio
│   │   └── ThemeController.tsx    applica il tema della squadra attiva
│   ├── db/
│   │   ├── types.ts               Team, Player, Game
│   │   ├── db.ts                  schema Dexie v2 (migrazione dalla v1 a squadra singola)
│   │   ├── hooks.ts               query reattive filtrate per squadra attiva
│   │   └── repo.ts                CRUD, squadre (duplica/archivia/elimina), backup, dati di esempio
│   ├── store/
│   │   ├── ui.ts                  Zustand: squadra attiva, tab, substrato, bozze convocazioni per squadra
│   │   └── feedback.ts            toast e dialog di conferma
│   ├── lib/                       date, vibrazione, immagini, tasto Indietro, fullscreen/wake lock
│   ├── components/                UI condivisa, TeamLogo, TabBar, Splash, PhotoCropper, impostazioni
│   └── features/
│       ├── teams/                 selettore, schermata Squadre, form squadra con anteprima tema
│       ├── home/                  calendario, prossima partita, form partita
│       ├── players/               lista con filtri, scheda giocatore
│       ├── match/                 selettore partita, convocati, quintetto
│       ├── live/                  secondo substrato: liveModel (timer a timestamp, + test), campo SVG,
│       │                          geometria posizioni (+ test), card giocatori, schermata partita
│       └── reports/               storico resoconti
└── .github/workflows/deploy.yml   build + GitHub Pages
```

## Stato delle fasi

- [x] **Fase 1** — scaffolding, multi-squadra con tema dinamico, primo substrato (Home, Giocatori, Partita, Resoconti), persistenza, backup
- [x] **Fase 2** — schermata partita: campo verticale in parquet con logo della squadra, card, panchina, timer con ±5 s, cambi con conferma, animazioni punteggio
- [x] **Fase 3** — motore INT con test automatici e vista debug
- [ ] **Fase 4** — resoconto finale, PDF, tab Resoconti completa
