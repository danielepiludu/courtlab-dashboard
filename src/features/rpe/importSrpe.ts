/**
 * Importazione dello storico sRPE da Excel (foglio con colonne NOME ATLETA, DATA, RPE, TEMPO).
 * Parsing e abbinamento sono funzioni pure; `applyImport` scrive nel database.
 */
import { db } from '@/db/db';
import type { Player } from '@/db/types';
import { newPlayer } from '@/db/repo';

export type Cell = string | number | boolean | Date | null | undefined;
export interface ParsedRow {
  name: string;
  date: string;
  rpe: number | null;
  minutes: number | null;
}

const norm = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9 ]/g, '')
    .trim()
    .toUpperCase();

const pad = (n: number) => String(n).padStart(2, '0');

function toISO(v: Cell): string | null {
  if (v instanceof Date && !Number.isNaN(v.getTime())) return `${v.getUTCFullYear()}-${pad(v.getUTCMonth() + 1)}-${pad(v.getUTCDate())}`;
  if (typeof v === 'number' && v > 20000 && v < 80000) {
    // numero seriale di Excel
    const d = new Date(Math.round((v - 25569) * 86_400_000));
    return toISO(d);
  }
  if (typeof v === 'string') {
    const m = v.trim().match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/);
    if (m) return `${m[3].length === 2 ? '20' + m[3] : m[3]}-${pad(+m[2])}-${pad(+m[1])}`;
    if (/^\d{4}-\d{2}-\d{2}/.test(v)) return v.slice(0, 10);
  }
  return null;
}

const toNum = (v: Cell): number | null => {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string' && v.trim() !== '' && !Number.isNaN(Number(v.replace(',', '.')))) return Number(v.replace(',', '.'));
  return null;
};

/** Trova la riga d'intestazione e restituisce le righe dati. */
export function parseSrpeRows(rows: Cell[][]): ParsedRow[] {
  const h = rows.findIndex((r) => {
    const t = r.map((c) => (typeof c === 'string' ? norm(c) : ''));
    return t.some((x) => x.startsWith('NOME')) && t.includes('DATA') && t.includes('RPE');
  });
  if (h < 0) throw new Error('Non trovo le colonne NOME ATLETA, DATA, RPE, TEMPO');
  const head = rows[h].map((c) => (typeof c === 'string' ? norm(c) : ''));
  const ci = { name: head.findIndex((x) => x.startsWith('NOME')), date: head.indexOf('DATA'), rpe: head.indexOf('RPE'), min: head.findIndex((x) => x === 'TEMPO' || x.startsWith('MIN')) };
  const out: ParsedRow[] = [];
  for (const r of rows.slice(h + 1)) {
    const name = typeof r[ci.name] === 'string' ? (r[ci.name] as string).trim() : '';
    const date = toISO(r[ci.date]);
    if (!name || !date) continue;
    const rpe = toNum(r[ci.rpe]);
    out.push({ name, date, rpe: rpe != null && rpe >= 0 && rpe <= 10 ? rpe : null, minutes: ci.min >= 0 ? toNum(r[ci.min]) : null });
  }
  return out;
}

export interface ImportPlan {
  rows: ParsedRow[];
  /** nome nel file → giocatore esistente (id) o null = da creare */
  matches: { sheetName: string; playerId: number | null; playerName?: string }[];
  /** sedute per data con durata più frequente */
  sessions: { date: string; minutes: number }[];
  withRpe: number;
}

/** Abbina i nomi del file (spesso solo il cognome) ai giocatori della squadra. */
export function planImport(rows: ParsedRow[], players: Pick<Player, 'id' | 'name'>[]): ImportPlan {
  const names = [...new Set(rows.map((r) => r.name))];
  const matches = names.map((sheetName) => {
    const n = norm(sheetName);
    const p =
      players.find((x) => norm(x.name) === n) ??
      players.find((x) => norm(x.name).split(' ').includes(n)) ??
      players.find((x) => n.split(' ').length > 1 && n.split(' ').every((t) => norm(x.name).split(' ').includes(t)));
    return { sheetName, playerId: p?.id ?? null, playerName: p?.name };
  });
  const byDate = new Map<string, number[]>();
  for (const r of rows) if (r.minutes != null) byDate.set(r.date, [...(byDate.get(r.date) ?? []), r.minutes]);
  const dates = [...new Set(rows.map((r) => r.date))].sort();
  const sessions = dates.map((date) => {
    const ms = byDate.get(date) ?? [];
    const freq = new Map<number, number>();
    ms.forEach((m) => freq.set(m, (freq.get(m) ?? 0) + 1));
    const minutes = [...freq.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 90;
    return { date, minutes };
  });
  return { rows, matches, sessions, withRpe: rows.filter((r) => r.rpe != null).length };
}

const titleCase = (s: string) =>
  s
    .toLowerCase()
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');

/** Scrive sedute, RPE e (se servono) nuovi giocatori. Le sedute già presenti nella stessa data vengono riutilizzate. */
export async function applyImport(teamId: number, plan: ImportPlan): Promise<{ sessions: number; entries: number; newPlayers: number }> {
  return db.transaction('rw', [db.players, db.sessions, db.rpe], async () => {
    const t = Date.now();
    const idByName = new Map<string, number>();
    let newPlayers = 0;
    for (const m of plan.matches) {
      if (m.playerId != null) idByName.set(m.sheetName, m.playerId);
      else {
        const id = (await db.players.add({ ...newPlayer(teamId), name: titleCase(m.sheetName) })) as number;
        idByName.set(m.sheetName, id);
        newPlayers++;
      }
    }
    const existing = await db.sessions.where('teamId').equals(teamId).toArray();
    const sessionByDate = new Map<string, { id: number; minutes: number }>();
    let created = 0;
    for (const s of plan.sessions) {
      const ex = existing.find((x) => x.date === s.date && x.type === 'basket');
      if (ex) sessionByDate.set(s.date, { id: ex.id!, minutes: ex.minutes });
      else {
        const id = (await db.sessions.add({ teamId, date: s.date, type: 'basket', minutes: s.minutes, notes: 'Importata da Excel', createdAt: t, updatedAt: t })) as number;
        sessionByDate.set(s.date, { id, minutes: s.minutes });
        created++;
      }
    }
    let entries = 0;
    for (const r of plan.rows) {
      if (r.rpe == null) continue;
      const s = sessionByDate.get(r.date)!;
      const playerId = idByName.get(r.name)!;
      const old = await db.rpe.where('[sessionId+playerId]').equals([s.id, playerId]).first();
      await db.rpe.put({ ...(old ?? {}), teamId, sessionId: s.id, playerId, rpe: r.rpe, minutes: r.minutes != null && r.minutes !== s.minutes ? r.minutes : null, source: 'import', updatedAt: t });
      entries++;
    }
    return { sessions: created, entries, newPlayers };
  });
}
