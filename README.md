# Courtlab

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
- **Mini-grafico dell'INT per quarti**: etichette Q1, Q2… (OT per i supplementari) sopra ogni quarto, quarti alterni più chiari, separatori ben visibili e pause tra i quarti in grigio tratteggiato; nel PDF le etichette sono nell'intestazione della colonna.
- **Eliminare una partita**: cestino accanto a ogni partita nella tab Resoconti o dentro il resoconto aperto (con conferma); elimina la partita e il resoconto, anche dagli altri dispositivi sincronizzati.
- Chiudendo il resoconto si torna al primo substrato. La partita risulta conclusa nel calendario e il resoconto si riapre in qualsiasi momento dalla tab **Resoconti** (o toccando la partita nella Home).
- I resoconti sono salvati nella tabella `reports` con un'istantanea dei convocati: modificare o eliminare un giocatore dopo non cambia il resoconto. Sono inclusi nel backup.

## RPE e carico interno (sRPE)

Tab **RPE** (sola lettura per le squadre archiviate):

- **Sedute**: `+ Seduta` crea un allenamento tecnico o una **partita** (tipo scelto nella seduta; nei grafici le partite hanno le barre tratteggiate) con data e durata decise dallo staff. Toccando un atleta si sceglie l'RPE sulla scala CR-10 (0 → 10, con 0,5) e, se serve, minuti diversi per quell'atleta; si passa da solo al prossimo senza risposta. Per ogni seduta: risposte x/N, RPE medio, TL medio.
- **Importa Excel**: si sceglie il foglio sRPE scaricato da Google Sheets in `.xlsx` (colonne NOME ATLETA, DATA, RPE, TEMPO). Anteprima con sedute, RPE e abbinamento nomi → giocatori (anche solo per cognome); i nomi senza corrispondenza diventano nuovi giocatori. Ogni data diventa una seduta, la durata è quella più frequente del giorno.
- **Analisi carico**:
  - squadra: quanti atleti sono sopra 1,3 / in zona / sotto 0,8 (toccando si filtra), grafico del TL medio di squadra con la media mobile, elenco atleti con indicatore del Work Load;
  - atleta: riquadro del giorno selezionato (TL, media personale, media squadra, Work Load con stato), due grafici allineati sullo stesso asse dei giorni — sopra il carico (barre TL, media personale, media squadra), sotto il Work Load con la fascia 0,8–1,3 — e tabella giorno per giorno. Toccando un giorno nel grafico o nella tabella si aggiorna il riquadro. I punti vuoti del Work Load sono i giorni senza RPE (valore riportato dal precedente).
  - La finestra della media mobile è regolabile (predefinita 7 giorni).

- **Report ed export** (Analisi carico → *Report PDF ed Excel*, oppure l'icona nella scheda dell'atleta): periodo a scelta (7 giorni, 4 settimane, stagione, personalizzato).
  - **PDF**: pagina squadra (sedute, RPE medio, TL medio, risposte, zone; grafico del TL medio con la media di squadra; tabella atleti in ordine di cognome con Work Load e giorni sopra 1,3) e, a scelta, una pagina per atleta con i due grafici, il dettaglio seduta per seduta e le partite monitorate. Condivisibile (WhatsApp, Drive…) o scaricabile.
  - **Excel** (.xlsx): fogli *Riepilogo*, *Giorno per giorno*, *Squadra*, *DB* (stesse colonne del foglio sRPE, reimportabile in Courtlab) e *Partite*.
  - **Minuti e INT**: le partite monitorate con la schermata live nel periodo aggiungono partite, minuti e INT medio per atleta (anche nella scheda dell'atleta, sezione *Partite monitorate*).

Formule identiche al foglio: verificate su tutte le 43 date in `src/engine/load.test.ts` e, con il file reale (non incluso nel repository), su tutti i 15 atleti dopo l'importazione nell'app: 2580 valori, nessuna differenza.

| Indicatore | Calcolo |
|---|---|
| TL | RPE × minuti |
| TL del giorno | somma dei TL dell'atleta nella data |
| Media personale | media dei TL del giorno > 0 dell'atleta negli ultimi N giorni di calendario |
| Media squadra | media di tutti i TL della squadra negli ultimi N giorni |
| Work Load (A:C) | TL del giorno ÷ media personale; nei giorni senza TL resta il valore precedente |

Sedute e RPE sono nelle tabelle `sessions` e `rpe` (schema Dexie v4) e sono inclusi nel backup.

### Link RPE per gli atleti (Courtlab Cloud)

Nella seduta, **Crea link per gli atleti** pubblica la raccolta e apre la condivisione (WhatsApp ecc.) con un messaggio pronto (squadra, data). Il link è `…/rpe/#<codice>` (pagina leggera dedicata, con anteprima nelle chat: titolo, descrizione e immagine `public/og-rpe.jpg`, rigenerabile con `node scripts/make-og.cjs`). L'atleta lo apre dal browser, senza installare nulla: sceglie il proprio nome (ricordato per le volte successive), tocca il valore RPE e invia; può modificarlo finché la raccolta è aperta. Le risposte arrivano nell'app ogni 30 secondi mentre la tab RPE è aperta (o con **Aggiorna**) e sono segnate "dall'atleta". Ciò che lo staff inserisce o corregge a mano ha sempre la precedenza. **Chiudi** blocca nuove risposte.

### Sincronizzazione tra dispositivi (Courtlab Cloud)

Accedendo con lo stesso utente su più telefoni/tablet, squadre, giocatori, partite, resoconti, sedute e RPE sono gli stessi ovunque. Restano locali solo la partita in corso e le preferenze del dispositivo.

- **Offline-first**: l'app legge e scrive sempre sul dispositivo; la sincronizzazione parte all'accesso, pochi secondi dopo ogni modifica, ogni minuto, al ritorno online e quando l'app torna in primo piano.
- Ogni ciclo invia ciò che è cambiato (confronto con l'impronta dell'ultima sincronizzazione) e scarica ciò che è cambiato altrove. **Vince la modifica più recente** (ora della modifica sul dispositivo).
- Id validi su tutti i dispositivi: numeri casuali a 53 bit; gli RPE hanno un id derivato da seduta + atleta, così lo stesso RPE inserito su due telefoni resta uno solo. La migrazione v5 del database converte gli RPE esistenti senza toccare i dati.
- **Primo accesso**: se il cloud è vuoto, questo dispositivo carica i suoi dati; se ci sono già dati, chiede conferma e sostituisce quelli locali con quelli del cloud.
- **Protezione**: se su un dispositivo sparisce più di metà dei dati (es. "Elimina tutti i dati" o ripristino di un backup), prima di propagare le eliminazioni chiede se eliminarle ovunque o ripristinarle dal cloud.
- Stato in Impostazioni → Courtlab Cloud (ultima sincronizzazione, offline, errori, "Sincronizza").

Il servizio online è un progetto [Supabase](https://supabase.com) (piano gratuito). Configurazione, una volta sola:

1. Crea un account su supabase.com e un nuovo progetto (regione consigliata: Frankfurt).
2. **SQL Editor** → New query → incolla il contenuto di [`supabase/schema.sql`](supabase/schema.sql) → **Run**. Dopo ogni aggiornamento dello schema va rieseguito (è sicuro rieseguirlo: crea solo ciò che manca).
3. **Authentication → Users → Add user**: crea l'utente dello staff (email + password, "Auto confirm"). In **Authentication → Sign In / Providers** disattiva "Allow new users to sign up", così nessun altro può registrarsi.
4. **Project Settings → API keys**: copia l'URL del progetto e la chiave **publishable** (o "anon public"). Vanno in `src/cloud/config.ts` (oppure come variabili `VITE_SUPABASE_URL` e `VITE_SUPABASE_KEY` in build). La chiave segreta / service_role non va mai nell'app.
5. Nell'app: Impostazioni → **Courtlab Cloud** → accedi con l'utente dello staff.

**Accesso all'app**: con Courtlab Cloud configurato, l'app dello staff si apre solo dopo l'accesso (email e password dell'utente Supabase); senza accesso compare solo la schermata di login e il resto dell'app non viene nemmeno caricato (nessun database locale creato). L'accesso resta salvato sul dispositivo e l'app continua a funzionare offline; *Esci* la blocca di nuovo. La pagina del link (`…/rpe/#codice`) è separata e permette solo di votare; senza codice valido mostra un messaggio d'errore. Il service worker non serve mai l'app al posto della pagina `rpe`.

Sicurezza (regole in `supabase/schema.sql`): gli atleti non hanno accesso alle tabelle, solo a due funzioni — leggere la seduta del proprio link e inviare un RPE valido per un nome in elenco a raccolta aperta. Lo staff vede solo le proprie raccolte. Online vengono pubblicati solo nome della squadra, colori, logo ridotto, data e durata della seduta, nome e numero dei giocatori e gli RPE inviati; tutto il resto resta sul dispositivo.

## Comandi

```bash
npm install          # dipendenze
npm run dev          # sviluppo su http://localhost:5173 (raggiungibile dal telefono sulla stessa Wi-Fi)
npm test             # test automatici (vitest): tema, timer, INT, campo, resoconto, PDF
npm run build        # typecheck + build di produzione in dist/
npm run preview      # serve la build (con service worker) su http://localhost:4173
npm run icons        # rigenera logo squadra (assets/logo-source.png) e icone app (assets/app-icon.svg); serve Python+Pillow e Playwright
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
npx cap init "Courtlab" it.courtlab.app --web-dir dist
VITE_BASE=./ npm run build
npx cap add android
npx cap sync android
npx cap open android      # Android Studio → Build → Build Bundle(s) / APK(s) → Build APK(s)
```

Dopo ogni modifica: `VITE_BASE=./ npm run build && npx cap sync android`. Il codice non usa API che richiedono un server: timer a timestamp, dati in IndexedDB, vibrazione e wake lock con fallback (sostituibili con i plugin Capacitor `Haptics` e `KeepAwake` in `src/lib/haptics.ts` e `src/lib/device.ts`).

## Struttura

```
├── assets/
│   ├── logo-source.png              logo originale della squadra predefinita (non distribuito)
│   └── app-icon.svg                 icona dell'app Courtlab (sorgente vettoriale)
├── public/
│   ├── logo.png                     logo Don Bosco ritagliato, sfondo trasparente
│   └── icons/                       icone PWA 192/512, maskable, apple-touch, favicon
├── supabase/schema.sql              tabelle, regole di accesso e funzioni di Courtlab Cloud
├── scripts/make-icons.py            genera il logo della squadra predefinita
├── scripts/make-app-icons.cjs       genera le icone dell'app dall'SVG
├── index.html                       applica subito il tema dell'ultima squadra (nessun lampo di colori)
├── vite.config.ts                   base path, PWA (manifest + service worker offline), test
├── src/
│   ├── main.tsx · App.tsx           avvio, splash, ripristino partita in corso, substrati
│   ├── index.css                    variabili tema (@property, transizioni), animazioni
│   ├── config.ts                    nome app, squadra predefinita, stagioni, durata periodi
│   ├── engine/
│   │   ├── intConfig.ts             parametri e spiegazione del modello INT
│   │   ├── int.ts                   motore INT (funzioni pure)
│   │   ├── int.test.ts
│   │   └── load.ts (+ test)         TL, medie mobili e Work Load (sRPE)
│   ├── theme/
│   │   ├── color.ts                 conversioni, luminanza e contrasto WCAG
│   │   ├── palette.ts (+ test)      palette scura dai due colori della squadra
│   │   ├── extract.ts               colori dominanti dal logo
│   │   ├── apply.ts                 variabili CSS, logo, istantanea per l'avvio
│   │   └── ThemeController.tsx      applica il tema della squadra attiva
│   ├── cloud/                       Courtlab Cloud: client Supabase, accesso staff, raccolte RPE,
│   │                                sincronizzazione tra dispositivi (sync.ts, impronte + test)
│   ├── db/
│   │   ├── types.ts                 Team, Player, Game, GameReport, TrainingSession, RpeEntry
│   │   ├── db.ts                    schema Dexie v4 (migrazioni dalle versioni precedenti)
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
│       ├── reports/                 tab Resoconti
│       ├── athlete/                 pagina pubblica del link RPE per gli atleti (entry: rpe/index.html)
│       └── rpe/                     tab RPE: sedute, scala CR-10, analisi carico, grafico, import Excel,
│                                    report del carico (loadReport + PDF + Excel, con test)
└── .github/workflows/deploy.yml     test + build + GitHub Pages
```

## Stato delle fasi

- [x] **Fase 1** — scaffolding, multi-squadra con tema dinamico, primo substrato (Home, Giocatori, Partita, Resoconti), persistenza, backup
- [x] **Fase 2** — schermata partita: campo verticale in parquet con logo della squadra, card, panchina, timer con ±5 s, cambi con conferma, animazioni punteggio
- [x] **Fase 3** — motore INT 0–1 con test automatici e vista debug
- [x] **Fase 4** — resoconto finale, grafici INT, export PDF, tab Resoconti completa

Carico interno (RPE):

- [x] **Fase 1** — sedute, inserimento RPE, calcoli del foglio sRPE, grafico, import da Excel
- [x] **Fase 2** — sincronizzazione tra dispositivi dello staff con account (offline-first, vince la modifica più recente)
- [x] **Fase 3** — link per gli atleti per inserire l'RPE senza installare nulla (da attivare con il progetto Supabase)
- [x] **Fase 4** — report ed export del carico (PDF/Excel), integrazione minuti e INT, sedute di tipo Partita
