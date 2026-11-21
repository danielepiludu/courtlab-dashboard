import { create } from 'zustand';
import { db } from '@/db/db';
import { normalizeLive, settle, type LiveState } from '@/features/live/liveModel';

const KEY = 'live';

interface LiveStore {
  live: LiveState | null;
  /** carica la partita in corso salvata (ripristino dopo chiusura accidentale) */
  load: () => Promise<LiveState | null>;
  /** sostituisce lo stato e lo salva subito */
  set: (s: LiveState | null) => void;
  /** applica una transizione pura allo stato attuale e salva */
  update: (fn: (s: LiveState, now: number) => LiveState) => void;
}

function persist(s: LiveState | null) {
  const op: Promise<unknown> = s ? db.kv.put({ key: KEY, value: s, updatedAt: Date.now() }) : db.kv.delete(KEY);
  op.catch((e: unknown) => console.error('Salvataggio partita non riuscito', e));
}

export const useLive = create<LiveStore>((set, get) => ({
  live: null,
  async load() {
    const rec = await db.kv.get(KEY);
    const raw = (rec?.value as LiveState | undefined) ?? null;
    const live = raw ? normalizeLive(raw) : null;
    set({ live });
    return live;
  },
  set(live) {
    set({ live });
    persist(live);
  },
  update(fn) {
    const cur = get().live;
    if (!cur) return;
    const next = fn(cur, Date.now());
    if (next === cur) return;
    set({ live: next });
    persist(next);
  },
}));

/** Partita conclusa: salva lo stato finale come base del resoconto e segna la partita come finita. */
export async function finishLive(): Promise<number | null> {
  const cur = useLive.getState().live;
  if (!cur) return null;
  const now = Date.now();
  const final = { ...settle(cur, now), running: false };
  await db.transaction('rw', db.games, db.kv, async () => {
    await db.kv.put({ key: `report:${cur.gameId}`, value: { ...final, finishedAt: now }, updatedAt: now });
    const g = await db.games.get(cur.gameId);
    if (g) await db.games.put({ ...g, status: 'finished', scoreUs: final.us, scoreThem: final.them, finishedAt: now, updatedAt: now });
    await db.kv.delete(KEY);
  });
  useLive.setState({ live: null });
  return cur.gameId;
}
