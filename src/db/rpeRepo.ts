/** Sedute di allenamento e RPE: lettura/scrittura e conversione per il motore di carico. */
import { db } from './db';
import type { Player, RpeEntry, TrainingSession } from './types';
import type { LoadEntry } from '@/engine/load';
import { todayISO } from '@/lib/dates';

const now = () => Date.now();

export function newSession(teamId: number, date = todayISO(), minutes = 90): TrainingSession {
  return { teamId, date, type: 'basket', minutes, notes: '', createdAt: now(), updatedAt: now() };
}

export async function saveSession(s: TrainingSession): Promise<number> {
  return db.sessions.put({ ...s, updatedAt: now() });
}

export async function deleteSession(id: number) {
  await db.transaction('rw', db.sessions, db.rpe, async () => {
    await db.rpe.where('sessionId').equals(id).delete();
    await db.sessions.delete(id);
  });
}

/** Imposta (o cancella con rpe = null e minuti = null) l'RPE di un atleta in una seduta. */
export async function setRpe(session: TrainingSession, playerId: number, rpe: number | null, minutes: number | null = null, source: RpeEntry['source'] = 'staff') {
  const existing = await db.rpe.where('[sessionId+playerId]').equals([session.id!, playerId]).first();
  if (rpe == null && minutes == null) {
    // se la risposta era arrivata dal link, resta un segnaposto dello staff così la sincronizzazione non la reinserisce
    if (existing?.id && existing.source === 'atleta' && source === 'staff') await db.rpe.put({ ...existing, rpe: null, minutes: null, source: 'staff', updatedAt: now() });
    else if (existing?.id) await db.rpe.delete(existing.id);
    return;
  }
  await db.rpe.put({ ...(existing ?? {}), teamId: session.teamId, sessionId: session.id!, playerId, rpe, minutes, source, updatedAt: now() });
}

/**
 * Converte sedute + RPE nel formato del motore di carico.
 * Come nel foglio, ogni atleta della rosa compare in ogni seduta (vuoto se non ha risposto).
 */
export function toLoadEntries(sessions: TrainingSession[], entries: RpeEntry[], players: Player[]): LoadEntry<number>[] {
  const bySession = new Map<number, Map<number, RpeEntry>>();
  for (const e of entries) {
    const m = bySession.get(e.sessionId) ?? new Map<number, RpeEntry>();
    m.set(e.playerId, e);
    bySession.set(e.sessionId, m);
  }
  const out: LoadEntry<number>[] = [];
  for (const s of sessions) {
    const m = bySession.get(s.id!) ?? new Map();
    for (const p of players) {
      const e = m.get(p.id!);
      out.push({ athlete: p.id!, date: s.date, rpe: e?.rpe ?? null, minutes: e?.minutes ?? s.minutes });
    }
  }
  return out;
}
