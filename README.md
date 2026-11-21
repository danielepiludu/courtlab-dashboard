# Don Bosco Basket Monitor

PWA Android installabile e offline per il preparatore della **Pallacanestro Don Bosco Livorno**: monitora minuti giocati e carico di fatica (INT) dei giocatori durante la partita.

React + TypeScript + Vite · Tailwind · Zustand · Dexie (IndexedDB) · vite-plugin-pwa · Wake Lock API. Nessun backend: i dati restano sul dispositivo.

## Avvio

```bash
npm install
npm run dev          # sviluppo (http://localhost:5173, raggiungibile anche dal telefono sulla stessa Wi-Fi)
npm run build        # typecheck + build in dist/
npm run preview      # serve la build (service worker attivo) su http://localhost:4173
npm run icons        # rigenera logo e icone da assets/logo-source.png (Python 3 + Pillow)
```

Per installarla sul telefono: aprire l'URL in Chrome per Android → menu ⋮ → **Installa app**.
Il push su `main` pubblica automaticamente su GitHub Pages (`.github/workflows/deploy.yml`).

Per un futuro pacchetto Capacitor: `VITE_BASE=./ npm run build` e usare `dist/` come `webDir`.

## Struttura

```
├── assets/logo-source.png        logo originale (non distribuito)
├── public/
│   ├── logo.png                  logo ritagliato, sfondo trasparente
│   └── icons/                    icone PWA 192/512, maskable, apple-touch, favicon
├── scripts/make-icons.py         genera logo e icone
├── src/
│   ├── main.tsx · App.tsx        avvio, splash, switch tra i due substrati
│   ├── index.css                 tema scuro, animazioni
│   ├── config.ts                 costanti app e durata periodi
│   ├── db/
│   │   ├── types.ts              Player, Game, ruoli, stati
│   │   ├── db.ts                 schema Dexie (players, games, kv)
│   │   ├── hooks.ts              query reattive (useLiveQuery)
│   │   └── repo.ts               CRUD, backup, dati di esempio, import vecchio prototipo
│   ├── store/
│   │   ├── ui.ts                 Zustand: tab, substrato, bozza convocazioni (persistita)
│   │   └── feedback.ts           toast e dialog di conferma
│   ├── lib/                      date, vibrazione, ritaglio foto, tasto Indietro, fullscreen/wake lock
│   ├── components/
│   │   ├── ui/                   Button, Sheet, Chip/Segmented, Avatar, Badge, FeedbackHost…
│   │   ├── TabBar · ScreenHeader · Splash · PhotoCropper · SettingsSheet
│   └── features/
│       ├── home/                 calendario, prossima partita, form partita
│       ├── players/              lista con filtri, scheda giocatore
│       ├── match/                selettore partita, convocati, quintetto
│       ├── live/                 secondo substrato (schermata partita)
│       └── reports/              storico resoconti
└── .github/workflows/deploy.yml  build + GitHub Pages
```

## Stato delle fasi

- [x] **Fase 1** — scaffolding, tema, logo, primo substrato (Home, Giocatori, Partita, Resoconti), persistenza
- [ ] **Fase 2** — schermata partita: campo, card, REST, timer, cambi con conferma
- [ ] **Fase 3** — motore INT con test automatici
- [ ] **Fase 4** — resoconto finale, PDF, tab Resoconti completa
