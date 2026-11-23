/**
 * Identificativi validi su tutti i dispositivi (sincronizzazione):
 * numeri interi casuali a 53 bit, così due telefoni non creano mai lo stesso id.
 * Gli RPE hanno un id derivato da seduta + atleta: lo stesso RPE inserito su due
 * dispositivi è lo stesso elemento (vince la modifica più recente).
 */
const MIN = 2 ** 32; // sopra gli id progressivi delle versioni precedenti

export function newId(): number {
  const [hi, lo] = crypto.getRandomValues(new Uint32Array(2));
  const v = (hi & 0x1fffff) * 2 ** 32 + lo;
  return v < MIN ? v + MIN : v;
}

/** Hash FNV-1a a 53 bit di una stringa (stabile tra dispositivi). */
export function hash53(s: string): number {
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 0x01000193);
    h2 = Math.imul(h2 ^ c, 0x5bd1e995);
  }
  return ((h2 >>> 0) & 0x1fffff) * 2 ** 32 + (h1 >>> 0);
}

export function rpeId(sessionId: number, playerId: number): number {
  const v = hash53(`rpe:${sessionId}:${playerId}`);
  return v < MIN ? v + MIN : v;
}

// ── Notifica delle modifiche locali (usata dalla sincronizzazione) ──
type Listener = (kind: string, key: number, deleted: boolean) => void;
const listeners = new Set<Listener>();
let muted = 0;

export function onLocalChange(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
export function notifyLocalChange(kind: string, key: number, deleted: boolean) {
  if (muted) return;
  for (const fn of listeners) fn(kind, key, deleted);
}
/** Esegue scritture che arrivano dal cloud senza segnalarle come modifiche locali. */
export async function withoutNotify<T>(fn: () => Promise<T>): Promise<T> {
  muted++;
  try {
    return await fn();
  } finally {
    muted--;
  }
}
