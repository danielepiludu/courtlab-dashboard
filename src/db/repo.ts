import Dexie from 'dexie';
import { db, type KV } from './db';
import type { Game, Player, PlayerStatus, Role } from './types';
import { todayISO, toISODate } from '@/lib/dates';

const now = () => Date.now();

// ---------- Giocatori ----------
export function newPlayer(): Player {
  return {
    name: '',
    number: '',
    role: 'PG',
    traits: [],
    notes: '',
    status: 'available',
    statusDate: todayISO(),
    statusDetails: '',
    createdAt: now(),
    updatedAt: now(),
  };
}

export async function savePlayer(p: Player): Promise<number> {
  return db.players.put({ ...p, name: p.name.trim(), updatedAt: now() });
}

export async function deletePlayer(id: number) {
  await db.players.delete(id);
}

// ---------- Partite ----------
export function newGame(date = todayISO(), time = '18:00'): Game {
  return { date, time, opponent: '', home: true, notes: '', status: 'scheduled', createdAt: now(), updatedAt: now() };
}

export async function saveGame(g: Game): Promise<number> {
  return db.games.put({ ...g, opponent: g.opponent.trim(), updatedAt: now() });
}

export async function deleteGame(id: number) {
  await db.transaction('rw', db.games, db.kv, async () => {
    await db.games.delete(id);
    await db.kv.delete(`report:${id}`);
  });
}

// ---------- Backup ----------
interface Backup {
  app: 'donbosco-basket-monitor';
  format: 1;
  exportedAt: string;
  players: Player[];
  games: Game[];
  kv: KV[];
}

export async function exportBackup(): Promise<Blob> {
  const data: Backup = {
    app: 'donbosco-basket-monitor',
    format: 1,
    exportedAt: new Date().toISOString(),
    players: await db.players.toArray(),
    games: await db.games.toArray(),
    kv: await db.kv.toArray(),
  };
  return new Blob([JSON.stringify(data)], { type: 'application/json' });
}

export async function importBackup(file: File): Promise<{ players: number; games: number }> {
  const data = JSON.parse(await file.text()) as Partial<Backup>;
  if (data.app !== 'donbosco-basket-monitor' || !Array.isArray(data.players) || !Array.isArray(data.games)) {
    throw new Error('File di backup non valido');
  }
  await db.transaction('rw', db.players, db.games, db.kv, async () => {
    await Promise.all([db.players.clear(), db.games.clear(), db.kv.clear()]);
    await db.players.bulkPut(data.players!);
    await db.games.bulkPut(data.games!);
    if (Array.isArray(data.kv)) await db.kv.bulkPut(data.kv);
  });
  return { players: data.players.length, games: data.games.length };
}

export async function wipeAll() {
  await db.transaction('rw', db.players, db.games, db.kv, async () => {
    await Promise.all([db.players.clear(), db.games.clear(), db.kv.clear()]);
  });
}

// ---------- Dati di esempio ----------
const DEMO: [string, string, Role, string[], PlayerStatus?, string?][] = [
  ['Marco Bianchi', '4', 'PG', ['Playmaker', 'Visione di gioco']],
  ['Luca Rossi', '7', 'SG', ['Tiratore', 'Difensore']],
  ['Andrea Conti', '9', 'SF', ['Atletico', 'Penetratore']],
  ['Matteo Greco', '11', 'PF', ['Rimbalzista']],
  ['Davide Costa', '13', 'C', ['Post basso', 'Stoppatore']],
  ['Simone Gallo', '5', 'PG', ['Velocità']],
  ['Federico Fontana', '8', 'SG', ['Tiratore'], 'doubtful', 'Fastidio al ginocchio'],
  ['Tommaso Rinaldi', '10', 'SF', ['Difensore']],
  ['Lorenzo Moretti', '14', 'PF', ['Atletico', 'Rimbalzista']],
  ['Riccardo Barbieri', '15', 'C', ['Post basso']],
  ['Gabriele Lombardi', '21', 'SF', ['Tiratore'], 'injured', 'Distorsione caviglia'],
  ['Nicolò Mancini', '0', 'SG', ['Penetratore', 'Leader']],
];
const OPPONENTS = ['Basket Pisa', 'Pall. Lucca', 'Virtus Siena', 'CMB Grosseto', 'US Empoli', 'Pistoia Junior', 'Prato Basket'];

export async function loadDemoData() {
  const t = now();
  const shift = (days: number) => {
    const d = new Date();
    d.setDate(d.getDate() + days);
    return toISODate(d);
  };
  await db.transaction('rw', db.players, db.games, async () => {
    await db.players.bulkAdd(
      DEMO.map(([name, number, role, traits, status = 'available', details = '']) => ({
        name,
        number,
        role,
        traits,
        notes: '',
        status,
        statusDate: shift(-3),
        statusDetails: details,
        createdAt: t,
        updatedAt: t,
      })),
    );
    const games: Game[] = [
      { date: shift(-14), time: '18:30', opponent: OPPONENTS[0], home: true, notes: '', status: 'finished', scoreUs: 68, scoreThem: 61, finishedAt: t, createdAt: t, updatedAt: t },
      { date: shift(-7), time: '21:00', opponent: OPPONENTS[1], home: false, notes: '', status: 'finished', scoreUs: 55, scoreThem: 63, finishedAt: t, createdAt: t, updatedAt: t },
      { date: shift(0), time: '19:00', opponent: OPPONENTS[2], home: true, notes: 'Partita di esempio', status: 'scheduled', createdAt: t, updatedAt: t },
      { date: shift(7), time: '18:00', opponent: OPPONENTS[3], home: false, notes: '', status: 'scheduled', createdAt: t, updatedAt: t },
      { date: shift(14), time: '20:30', opponent: OPPONENTS[4], home: true, notes: '', status: 'scheduled', createdAt: t, updatedAt: t },
      { date: shift(21), time: '18:00', opponent: OPPONENTS[5], home: false, notes: '', status: 'scheduled', createdAt: t, updatedAt: t },
    ];
    await db.games.bulkAdd(games);
  });
}

// ---------- Importazione dal prototipo precedente ("Minuti Basket") ----------
interface LegacyPlayer {
  name?: string;
  number?: number;
  role?: Role;
  traits?: string;
  notes?: string;
  status?: 'ok' | 'inj' | 'doubt';
  statusNote?: string;
  statusDate?: string;
  photo?: string;
}
interface LegacyGame {
  date?: string;
  time?: string;
  opponent?: string;
  home?: boolean;
  notes?: string;
  finished?: boolean;
  scoreUs?: number;
  scoreThem?: number;
}

/** Una sola volta: se esiste il database del vecchio prototipo, ne copia giocatori e partite. */
export async function importLegacyOnce() {
  const flag = await db.kv.get('legacyImportDone');
  if (flag) return 0;
  let count = 0;
  try {
    if (await Dexie.exists('minuti-basket')) {
      const old = new Dexie('minuti-basket');
      await old.open();
      const names = old.tables.map((t) => t.name);
      const players = names.includes('players') ? ((await old.table('players').toArray()) as LegacyPlayer[]) : [];
      const games = names.includes('games') ? ((await old.table('games').toArray()) as LegacyGame[]) : [];
      old.close();
      const empty = (await db.players.count()) === 0 && (await db.games.count()) === 0;
      if (empty && (players.length || games.length)) {
        const t = now();
        const statusMap = { ok: 'available', inj: 'injured', doubt: 'doubtful' } as const;
        await db.players.bulkAdd(
          players.map((p) => ({
            name: p.name ?? '',
            number: p.number != null ? String(p.number) : '',
            role: p.role ?? 'PG',
            traits: (p.traits ?? '').split(',').map((s) => s.trim()).filter(Boolean),
            notes: p.notes ?? '',
            status: statusMap[p.status ?? 'ok'] ?? 'available',
            statusDate: p.statusDate ?? todayISO(),
            statusDetails: p.statusNote ?? '',
            photo: p.photo,
            createdAt: t,
            updatedAt: t,
          })),
        );
        await db.games.bulkAdd(
          games.map((g) => ({
            date: g.date ?? todayISO(),
            time: g.time ?? '18:00',
            opponent: g.opponent ?? '',
            home: g.home ?? true,
            notes: g.notes ?? '',
            status: g.finished ? 'finished' : 'scheduled',
            scoreUs: g.scoreUs,
            scoreThem: g.scoreThem,
            finishedAt: g.finished ? t : undefined,
            createdAt: t,
            updatedAt: t,
          })),
        );
        count = players.length + games.length;
      }
    }
  } catch {
    /* il vecchio DB non è leggibile: ignora */
  }
  await db.kv.put({ key: 'legacyImportDone', value: true, updatedAt: now() });
  return count;
}
