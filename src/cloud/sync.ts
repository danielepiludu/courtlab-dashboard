import { create } from 'zustand';
import { db, SYNC_KINDS, type SyncKind } from '@/db/db';
import { onLocalChange, withoutNotify } from '@/db/ids';
import { fingerprint } from './fingerprint';
import { SYNC_STATE_KEY, ensureTeam } from '@/db/repo';
import { useUI } from '@/store/ui';
import { confirmDialog, toast } from '@/store/feedback';
import { CloudError, rest, useCloud } from './client';
import { cloudConfigured } from './config';

/**
 * Sincronizzazione tra i dispositivi dello staff (Courtlab Cloud).
 *
 * - L'app resta offline-first: legge e scrive sempre su IndexedDB.
 * - Ogni ciclo: invia ciò che è cambiato qui (confronto con l'impronta dell'ultima sincronizzazione),
 *   poi scarica ciò che è cambiato altrove. Vince la modifica più recente.
 * - Parte all'accesso, dopo ogni modifica (con un breve ritardo), ogni minuto, al ritorno online
 *   e quando l'app torna in primo piano.
 */

type Phase = 'off' | 'idle' | 'syncing' | 'offline' | 'error';
export const useSync = create<{ phase: Phase; lastSync: number | null; error: string | null; firstRun: boolean }>(() => ({
  phase: 'off',
  lastSync: null,
  error: null,
  firstRun: false,
}));

interface SyncState {
  user: string;
  /** ultimo server_at ricevuto (ISO) */
  cursor: string | null;
  /** impronta di ogni elemento all'ultima sincronizzazione */
  hashes: Record<string, Record<string, string>>;
}

interface RemoteRow {
  kind: SyncKind;
  id: string;
  data: Record<string, unknown> | null;
  deleted: boolean;
  updated_at: number;
  server_at: string;
}

const STATE_KEY = SYNC_STATE_KEY;
const OVERLAP_MS = 60_000;
const PAGE = 500;
const MAX_BATCH_CHARS = 900_000;

const keyOf = (kind: SyncKind, rec: Record<string, unknown>) => String(kind === 'reports' ? rec.gameId : rec.id);

// ── ora delle modifiche locali (per decidere chi vince) ──
const TOUCH_KEY = 'courtlab-sync-touch';
let touched: Record<string, number> = (() => {
  try {
    return JSON.parse(localStorage.getItem(TOUCH_KEY) ?? '{}') as Record<string, number>;
  } catch {
    return {};
  }
})();
let touchSave: ReturnType<typeof setTimeout> | undefined;
function saveTouched() {
  clearTimeout(touchSave);
  touchSave = setTimeout(() => {
    try {
      localStorage.setItem(TOUCH_KEY, JSON.stringify(touched));
    } catch {
      /* ignora */
    }
  }, 400);
}

async function loadState(): Promise<SyncState | null> {
  return ((await db.kv.get(STATE_KEY))?.value as SyncState | undefined) ?? null;
}
async function saveState(s: SyncState) {
  await db.kv.put({ key: STATE_KEY, value: s, updatedAt: Date.now() });
}

const set = (p: Partial<ReturnType<typeof useSync.getState>>) => useSync.setState(p);
const message = (e: unknown) => {
  const m = e instanceof CloudError ? e.message : e instanceof Error ? e.message : 'Errore di sincronizzazione';
  // il database online non conosce ancora un tipo di dati nuovo dell'app
  return /sync_records_kind_check/.test(m) ? 'Aggiorna il database online: riesegui schema.sql nel SQL Editor di Supabase' : m;
};

// ── invio ──
async function push(state: SyncState): Promise<{ sent: number; rejected: number } | null> {
  const rows: { kind: SyncKind; id: string; data: unknown; deleted: boolean; updated_at: number }[] = [];
  const next: Record<string, Record<string, string>> = {};
  let deletions = 0;
  let known = 0;
  for (const kind of SYNC_KINDS) {
    const prev = state.hashes[kind] ?? {};
    known += Object.keys(prev).length;
    const cur: Record<string, string> = {};
    for (const rec of (await db.table(kind).toArray()) as Record<string, unknown>[]) {
      const id = keyOf(kind, rec);
      const h = fingerprint(rec);
      cur[id] = h;
      if (prev[id] !== h) rows.push({ kind, id, data: rec, deleted: false, updated_at: touched[`${kind}:${id}`] ?? Date.now() });
    }
    for (const id of Object.keys(prev)) {
      if (!(id in cur)) {
        rows.push({ kind, id, data: null, deleted: true, updated_at: touched[`${kind}:${id}`] ?? Date.now() });
        deletions++;
      }
    }
    next[kind] = cur;
  }
  if (!rows.length) return { sent: 0, rejected: 0 };

  // protezione: un'eliminazione di massa (es. "Elimina tutti i dati") si propaga solo se confermata
  if (deletions >= 10 && deletions > known / 2) {
    const ok = await confirmDialog({
      title: 'Eliminare anche dal cloud?',
      message: `Su questo dispositivo sono stati eliminati ${deletions} elementi. Vuoi eliminarli anche dal cloud e dagli altri dispositivi? Se scegli "Ripristina", vengono riscaricati.`,
      confirmLabel: 'Elimina ovunque',
      cancelLabel: 'Ripristina',
      danger: true,
    });
    if (!ok) {
      // dimentica le impronte degli elementi mancanti: il download completo li ricrea
      for (const kind of SYNC_KINDS) {
        const keep: Record<string, string> = {};
        for (const [id, h] of Object.entries(state.hashes[kind] ?? {})) if (id in next[kind]) keep[id] = h;
        state.hashes[kind] = keep;
      }
      // la squadra vuota creata da "Elimina tutti i dati" non serve più
      for (const id of Object.keys(next.teams ?? {})) {
        if (state.hashes.teams?.[id]) continue;
        const tid = Number(id);
        const used = (await db.players.where('teamId').equals(tid).count()) + (await db.games.where('teamId').equals(tid).count()) + (await db.sessions.where('teamId').equals(tid).count());
        if (!used) await withoutNotify(() => db.teams.delete(tid));
      }
      state.cursor = null;
      await saveState(state);
      return null;
    }
  }

  // a gruppi, per non superare la dimensione massima di una richiesta (foto e loghi pesano)
  let accepted = 0;
  let batch: typeof rows = [];
  let size = 0;
  const flush = async () => {
    if (!batch.length) return;
    accepted += (await rest<number>('rpc/sync_push', { method: 'POST', body: JSON.stringify({ p_rows: batch }) })) ?? 0;
    for (const r of batch) {
      const kind = r.kind;
      state.hashes[kind] ??= {};
      if (r.deleted) delete state.hashes[kind][r.id];
      else state.hashes[kind][r.id] = next[kind][r.id];
      delete touched[`${kind}:${r.id}`];
    }
    await saveState(state);
    saveTouched();
    batch = [];
    size = 0;
  };
  for (const r of rows) {
    const len = JSON.stringify(r).length;
    if (size + len > MAX_BATCH_CHARS) await flush();
    batch.push(r);
    size += len;
  }
  await flush();
  return { sent: rows.length, rejected: rows.length - accepted };
}

// ── download ──
async function pull(state: SyncState, full = false): Promise<number> {
  const since = !full && state.cursor ? new Date(new Date(state.cursor).getTime() - OVERLAP_MS).toISOString() : null;
  let applied = 0;
  let maxAt = state.cursor;
  for (let offset = 0; ; offset += PAGE) {
    const filter = since ? `&server_at=gt.${encodeURIComponent(since)}` : '';
    const rows = (await rest<RemoteRow[]>(`sync_records?select=kind,id,data,deleted,updated_at,server_at${filter}&order=server_at.asc,kind.asc,id.asc&limit=${PAGE}&offset=${offset}`)) ?? [];
    applied += await withoutNotify(() => apply(state, rows));
    for (const r of rows) if (!maxAt || r.server_at > maxAt) maxAt = r.server_at;
    if (rows.length < PAGE) break;
  }
  state.cursor = maxAt;
  await saveState(state);
  return applied;
}

async function apply(state: SyncState, rows: RemoteRow[]): Promise<number> {
  let n = 0;
  for (const r of rows) {
    if (!SYNC_KINDS.includes(r.kind)) continue;
    const hashes = (state.hashes[r.kind] ??= {});
    const table = db.table(r.kind);
    const key = Number(r.id);
    try {
      if (r.deleted || !r.data) {
        if (hashes[r.id] !== undefined || (await table.get(key))) {
          await table.delete(key);
          delete hashes[r.id];
          n++;
        }
        continue;
      }
      const h = fingerprint(r.data);
      if (hashes[r.id] === h) continue;
      const local = (await table.get(key)) as Record<string, unknown> | undefined;
      if (local && fingerprint(local) === h) {
        hashes[r.id] = h;
        continue;
      }
      if (r.kind === 'rpe') {
        // stesso atleta e seduta con un id diverso (dati di versioni precedenti): tiene quello del cloud
        const d = r.data as { sessionId: number; playerId: number };
        const other = await db.rpe.where('[sessionId+playerId]').equals([d.sessionId, d.playerId]).first();
        if (other && other.id !== key) await db.rpe.delete(other.id!);
      }
      await table.put(r.data);
      hashes[r.id] = h;
      n++;
    } catch (e) {
      console.warn('Sync: elemento non applicato', r.kind, r.id, e);
    }
  }
  return n;
}

// ── primo collegamento di questo dispositivo ──
async function firstLink(user: string): Promise<SyncState | null> {
  const remote = (await rest<unknown[]>('sync_records?select=id&limit=1')) ?? [];
  const state: SyncState = { user, cursor: null, hashes: {} };
  if (!remote.length) {
    // cloud vuoto: questo dispositivo carica i suoi dati
    await saveState(state);
    return state;
  }
  const meaningful = (await db.players.count()) + (await db.games.count()) + (await db.sessions.count());
  if (meaningful > 0) {
    const ok = await confirmDialog({
      title: 'Usare i dati del cloud?',
      message:
        'Su Courtlab Cloud ci sono già i tuoi dati. Quelli di questo dispositivo verranno sostituiti con quelli del cloud. Se qui c\'è qualcosa da conservare, annulla ed esporta prima un backup dalle Impostazioni.',
      confirmLabel: 'Usa i dati del cloud',
    });
    if (!ok) return null;
  }
  set({ firstRun: true });
  await withoutNotify(() =>
    db.transaction('rw', SYNC_KINDS.map((k) => db.table(k)), async () => {
      for (const k of SYNC_KINDS) await db.table(k).clear();
    }),
  );
  touched = {};
  saveTouched();
  await saveState(state);
  return state;
}

// ── ciclo ──
let timer: ReturnType<typeof setTimeout> | undefined;
let declined = false;
let active: Promise<void> | null = null;
let queued: Promise<void> | null = null;

export function scheduleSync(delay = 2500) {
  clearTimeout(timer);
  timer = setTimeout(() => void syncNow(), delay);
}

/** Avvia una sincronizzazione; se ne è già in corso una, ne accoda una sola dopo (la promessa termina con quella). */
export function syncNow(): Promise<void> {
  if (!active) {
    active = runOnce().finally(() => {
      active = null;
    });
    return active;
  }
  queued ??= active.then(() => {
    queued = null;
    return syncNow();
  });
  return queued;
}

async function runOnce(): Promise<void> {
  const session = useCloud.getState().session;
  if (!cloudConfigured() || !session) return set({ phase: 'off' });
  if (declined) return;
  if (navigator.onLine === false) return set({ phase: 'offline' });
  set({ phase: 'syncing', error: null });
  try {
    let state = await loadState();
    let fresh = false;
    if (!state || state.user !== session.user.id) {
      state = await firstLink(session.user.id);
      if (!state) {
        declined = true;
        return set({ phase: 'error', error: 'Sincronizzazione non attivata su questo dispositivo' });
      }
      fresh = true;
    }
    const pushed = await push(state);
    const applied = await pull(state, fresh || pushed === null || (pushed?.rejected ?? 0) > 0);
    if (fresh || applied) await fixActiveTeam();
    if (useSync.getState().firstRun) {
      set({ firstRun: false });
      toast('Dati sincronizzati con Courtlab Cloud', 'success', 3000);
    }
    set({ phase: 'idle', lastSync: Date.now() });
  } catch (e) {
    const offline = !(navigator as Navigator).onLine;
    set({ phase: offline ? 'offline' : 'error', error: message(e) });
  }
}

/** Dopo aver ricevuto i dati, la squadra attiva deve esistere. */
async function fixActiveTeam() {
  const ui = useUI.getState();
  const id = await ensureTeam(ui.activeTeamId);
  if (id !== ui.activeTeamId) ui.setActiveTeam(id);
}

let started = false;
/** Avvia la sincronizzazione automatica (una volta, all'avvio dell'app). */
export function initSync() {
  if (started || !cloudConfigured()) return;
  started = true;
  // solo in sviluppo: accesso per i test automatici
  if (import.meta.env.DEV) Object.assign(window, { __courtlabSync: { syncNow, useSync, touched: () => touched } });
  onLocalChange((kind, key) => {
    touched[`${kind}:${key}`] = Date.now();
    saveTouched();
    scheduleSync();
  });
  const wake = () => document.visibilityState === 'visible' && void syncNow();
  setInterval(wake, 60_000);
  window.addEventListener('online', () => void syncNow());
  window.addEventListener('offline', () => set({ phase: 'offline' }));
  document.addEventListener('visibilitychange', wake);
  let logged = !!useCloud.getState().session;
  useCloud.subscribe((s) => {
    const now = !!s.session;
    if (now === logged) return;
    logged = now;
    declined = false;
    if (now) void syncNow();
    else set({ phase: 'off', lastSync: null, error: null });
  });
  void syncNow();
}

/** Riprova dopo un rifiuto o un errore (pulsante "Sincronizza ora"). */
export function retrySync() {
  declined = false;
  return syncNow();
}
