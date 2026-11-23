/**
 * Importazione delle misurazioni dal foglio Excel (formato "Misurazioni"):
 * una scheda per rilevazione (nome = data, es. "20082026", oppure un mese, es. "LUGLIO"),
 * atleti in colonna (riga 1), misure in riga (colonna A). Le righe senza nome diventano note dell'atleta.
 */
import { db } from '@/db/db';
import { newPlayer } from '@/db/repo';
import type { Player } from '@/db/types';
import { MEASURES } from '@/engine/anthro';

export type Cell = string | number | boolean | Date | null | undefined;

const norm = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
const pad = (n: number) => String(n).padStart(2, '0');
const MONTHS = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'];

function cellISO(v: Cell): string | null {
  if (v instanceof Date && !Number.isNaN(v.getTime())) return `${v.getUTCFullYear()}-${pad(v.getUTCMonth() + 1)}-${pad(v.getUTCDate())}`;
  if (typeof v === 'number' && v > 20000 && v < 80000) return cellISO(new Date(Math.round((v - 25569) * 86_400_000)));
  if (typeof v === 'string') {
    const m = v.trim().match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/);
    if (m) return `${m[3].length === 2 ? '20' + m[3] : m[3]}-${pad(+m[2])}-${pad(+m[1])}`;
    if (/^\d{4}-\d{2}-\d{2}/.test(v.trim())) return v.trim().slice(0, 10);
  }
  return null;
}

/** Data dal nome della scheda: "20082026" → 2026-08-20; "LUGLIO" → mese (giorno 1, anno da stimare). */
export function sheetDate(name: string): { date: string | null; month: number | null } {
  const t = name.trim();
  let m = t.match(/^(\d{2})(\d{2})(\d{4})$/);
  if (m) return { date: `${m[3]}-${m[2]}-${m[1]}`, month: null };
  m = t.match(/^(\d{1,2})[-_. /](\d{1,2})[-_. /](\d{2,4})$/);
  if (m) return { date: `${m[3].length === 2 ? '20' + m[3] : m[3]}-${pad(+m[2])}-${pad(+m[1])}`, month: null };
  const month = MONTHS.findIndex((x) => norm(t).startsWith(x));
  return { date: null, month: month >= 0 ? month + 1 : null };
}

const toNumber = (v: Cell): number | null => {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string') {
    const m = v.trim().replace(',', '.').match(/^-?\d+(\.\d+)?$/);
    if (m) return Number(m[0]);
  }
  return null;
};
const sentence = (s: string) => {
  const t = s.trim().replace(/\s+/g, ' ').toLowerCase();
  return t.charAt(0).toUpperCase() + t.slice(1);
};

export interface SheetAthlete {
  name: string;
  birthDate: string | null;
  values: Record<string, number | string>;
  note: string;
}
export interface ParsedSheet {
  sheetName: string;
  date: string | null;
  month: number | null;
  athletes: SheetAthlete[];
  /** righe non riconosciute (finite nelle note) */
  unknownRows: string[];
}

/** Legge una scheda. Restituisce null se non sembra una scheda di misurazioni. */
export function parseMeasureSheet(sheetName: string, rows: Cell[][]): ParsedSheet | null {
  const headerIdx = rows.findIndex((r) => r.slice(1).filter((c) => typeof c === 'string' && c.trim()).length >= 2);
  if (headerIdx < 0) return null;
  const header = rows[headerIdx];
  const cols = header.map((c, i) => ({ i, name: typeof c === 'string' ? c.trim() : '' })).filter((c) => c.i > 0 && c.name);
  const athletes = new Map<number, SheetAthlete>(cols.map((c) => [c.i, { name: c.name, birthDate: null, values: {}, note: '' }]));
  const unknownRows: string[] = [];
  let recognized = 0;
  for (const row of rows.slice(headerIdx + 1)) {
    const label = typeof row[0] === 'string' ? norm(row[0]) : '';
    const filled = cols.filter((c) => row[c.i] != null && String(row[c.i]).trim() !== '');
    if (/nascita/.test(label)) {
      for (const c of filled) athletes.get(c.i)!.birthDate = cellISO(row[c.i] as Cell);
      recognized++;
      continue;
    }
    const def = label ? MEASURES.find((m) => m.match.test(label)) : undefined;
    if (!def) {
      if (!filled.length) continue;
      unknownRows.push(label || '(riga senza nome)');
      for (const c of filled) {
        const a = athletes.get(c.i)!;
        const piece = `${label ? `${String(row[0]).trim()}: ` : ''}${String(row[c.i]).trim()}`;
        a.note = a.note ? `${a.note}; ${piece}` : piece;
      }
      continue;
    }
    recognized++;
    for (const c of filled) {
      const a = athletes.get(c.i)!;
      if (def.kind === 'number') {
        const n = toNumber(row[c.i] as Cell);
        if (n != null) a.values[def.id] = n;
      } else a.values[def.id] = sentence(String(row[c.i]));
    }
  }
  if (recognized < 2) return null;
  const { date, month } = sheetDate(sheetName);
  return { sheetName, date, month, athletes: [...athletes.values()], unknownRows };
}

export interface MeasureImportPlan {
  sheets: (ParsedSheet & { chosenDate: string; label: string })[];
  matches: { sheetName: string; playerId: number | null; playerName?: string }[];
  values: number;
}

/** Prepara l'importazione: date delle schede (stimate se manca il giorno) e abbinamento dei nomi ai giocatori. */
export function planMeasureImport(sheets: ParsedSheet[], players: Pick<Player, 'id' | 'name'>[]): MeasureImportPlan {
  // anno della stagione dalle schede con data piena (luglio-dicembre = primo anno della stagione)
  const known = sheets.map((s) => s.date).filter((d): d is string => !!d).sort();
  const firstKnown = known[0];
  const seasonYear = firstKnown ? (+firstKnown.slice(5, 7) >= 7 ? +firstKnown.slice(0, 4) : +firstKnown.slice(0, 4) - 1) : new Date().getFullYear();
  const withDates = sheets.map((s) => {
    const chosenDate = s.date ?? (s.month ? `${s.month >= 7 ? seasonYear : seasonYear + 1}-${pad(s.month)}-01` : `${seasonYear}-07-01`);
    const label = s.date ? '' : s.month ? MONTHS[s.month - 1].charAt(0).toUpperCase() + MONTHS[s.month - 1].slice(1) : s.sheetName;
    return { ...s, chosenDate, label };
  });
  const names = [...new Set(sheets.flatMap((s) => s.athletes.map((a) => a.name)))];
  const matches = names.map((sheetName) => {
    const n = norm(sheetName);
    const p =
      players.find((x) => norm(x.name) === n) ??
      players.find((x) => norm(x.name).split(' ').includes(n)) ??
      players.find((x) => n.split(' ').length > 1 && n.split(' ').every((t) => norm(x.name).split(' ').includes(t)));
    return { sheetName, playerId: p?.id ?? null, playerName: p?.name };
  });
  const values = sheets.reduce((t, s) => t + s.athletes.reduce((u, a) => u + Object.keys(a.values).length, 0), 0);
  return { sheets: withDates.sort((a, b) => a.chosenDate.localeCompare(b.chosenDate)), matches, values };
}

const titleCase = (s: string) =>
  s
    .toLowerCase()
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');

/** Scrive rilevazioni e misure; crea i giocatori mancanti e completa le date di nascita. */
export async function applyMeasureImport(teamId: number, plan: MeasureImportPlan): Promise<{ sessions: number; athletes: number; newPlayers: number }> {
  return db.transaction('rw', [db.players, db.msessions, db.measures], async () => {
    const t = Date.now();
    const idByName = new Map<string, number>();
    let newPlayers = 0;
    for (const m of plan.matches) {
      if (m.playerId != null) idByName.set(m.sheetName, m.playerId);
      else {
        idByName.set(m.sheetName, (await db.players.add({ ...newPlayer(teamId), name: titleCase(m.sheetName) })) as number);
        newPlayers++;
      }
    }
    // date di nascita (solo se mancano)
    for (const s of plan.sheets)
      for (const a of s.athletes) {
        if (!a.birthDate) continue;
        const id = idByName.get(a.name)!;
        const p = await db.players.get(id);
        if (p && !p.birthDate) await db.players.update(id, { birthDate: a.birthDate, updatedAt: t });
      }
    const existing = await db.msessions.where('teamId').equals(teamId).toArray();
    let created = 0;
    let athletes = 0;
    for (const s of plan.sheets) {
      let sid = existing.find((x) => x.date === s.chosenDate)?.id;
      if (sid == null) {
        sid = (await db.msessions.add({ teamId, date: s.chosenDate, label: s.label, notes: 'Importata da Excel', createdAt: t, updatedAt: t })) as number;
        created++;
      }
      for (const a of s.athletes) {
        if (!Object.keys(a.values).length && !a.note) continue;
        const playerId = idByName.get(a.name)!;
        const old = await db.measures.where('[sessionId+playerId]').equals([sid, playerId]).first();
        await db.measures.put({
          ...(old ?? {}),
          teamId,
          sessionId: sid,
          playerId,
          values: { ...(old?.values ?? {}), ...a.values },
          note: [old?.note, a.note].filter(Boolean).join('; '),
          updatedAt: t,
        });
        athletes++;
      }
    }
    return { sessions: created, athletes, newPlayers };
  });
}
