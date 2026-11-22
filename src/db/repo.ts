import Dexie from 'dexie';
import { db, defaultTeam, type KV } from './db';
import type { Game, GameReport, Player, PlayerStatus, RpeEntry, Role, Team, TrainingSession } from './types';
import { todayISO, toISODate } from '@/lib/dates';
import { currentSeason, nextSeason } from '@/config';

const now = () => Date.now();

// ---------- Squadre ----------
export function newTeam(): Team {
  return { name: '', season: currentSeason(), primary: '#1b3a6b', secondary: '#f2a900', archived: false, createdAt: now(), updatedAt: now() };
}

export async function saveTeam(t: Team): Promise<number> {
  return db.teams.put({ ...t, name: t.name.trim(), season: t.season.trim(), updatedAt: now() });
}

export async function setTeamArchived(id: number, archived: boolean) {
  await db.teams.update(id, { archived, updatedAt: now() });
}

/** Elimina la squadra con giocatori, partite e resoconti. */
export async function deleteTeam(id: number) {
  await db.transaction('rw', [db.teams, db.players, db.games, db.reports, db.sessions, db.rpe], async () => {
    await db.reports.where('teamId').equals(id).delete();
    await db.rpe.where('teamId').equals(id).delete();
    await db.sessions.where('teamId').equals(id).delete();
    await db.games.where('teamId').equals(id).delete();
    await db.players.where('teamId').equals(id).delete();
    await db.teams.delete(id);
  });
}

/** Nuova stagione: copia il roster senza partite e resoconti, azzerando infortuni e statistiche. */
export async function duplicateTeamForNewSeason(id: number): Promise<number> {
  return db.transaction('rw', db.teams, db.players, async () => {
    const src = await db.teams.get(id);
    if (!src) throw new Error('Squadra non trovata');
    const t = now();
    const { id: _omit, ...rest } = src;
    void _omit;
    const newId = (await db.teams.add({ ...rest, season: nextSeason(src.season), archived: false, createdAt: t, updatedAt: t })) as number;
    const roster = await db.players.where('teamId').equals(id).toArray();
    await db.players.bulkAdd(
      roster.map(({ id: _pid, ...p }) => {
        void _pid;
        return { ...p, teamId: newId, status: 'available' as const, statusDate: todayISO(), statusDetails: '', createdAt: t, updatedAt: t };
      }),
    );
    return newId;
  });
}

/** Restituisce un id squadra valido: quello richiesto se esiste, altrimenti la prima attiva (creandone una se serve). */
export async function ensureTeam(preferred: number | null): Promise<number> {
  if (preferred != null && (await db.teams.get(preferred))) return preferred;
  const all = await db.teams.orderBy('createdAt').toArray();
  const pick = all.find((t) => !t.archived) ?? all[0];
  if (pick?.id != null) return pick.id;
  return (await db.teams.add(defaultTeam())) as number;
}

// ---------- Giocatori ----------
export function newPlayer(teamId: number): Player {
  return {
    teamId,
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
export function newGame(teamId: number, date = todayISO(), time = '18:00'): Game {
  return { teamId, date, time, opponent: '', home: true, notes: '', status: 'scheduled', createdAt: now(), updatedAt: now() };
}

export async function saveGame(g: Game): Promise<number> {
  return db.games.put({ ...g, opponent: g.opponent.trim(), updatedAt: now() });
}

export async function deleteGame(id: number) {
  await db.transaction('rw', db.games, db.reports, async () => {
    await db.games.delete(id);
    await db.reports.delete(id);
  });
}

// ---------- Backup ----------
interface Backup {
  app: 'basket-monitor' | 'donbosco-basket-monitor';
  format: 1 | 2;
  exportedAt: string;
  activeTeamId?: number | null;
  teams?: Team[];
  players: Player[];
  games: Game[];
  kv: KV[];
  reports?: GameReport[];
  sessions?: TrainingSession[];
  rpe?: RpeEntry[];
}

/** Tutte le squadre, giocatori, partite, resoconti e immagini (incluse come data URL). */
export async function exportBackup(activeTeamId: number | null): Promise<Blob> {
  const data: Backup = {
    app: 'basket-monitor',
    format: 2,
    exportedAt: new Date().toISOString(),
    activeTeamId,
    teams: await db.teams.toArray(),
    players: await db.players.toArray(),
    games: await db.games.toArray(),
    kv: await db.kv.toArray(),
    reports: await db.reports.toArray(),
    sessions: await db.sessions.toArray(),
    rpe: await db.rpe.toArray(),
  };
  return new Blob([JSON.stringify(data)], { type: 'application/json' });
}

/** Sostituisce tutti i dati con quelli del backup. Restituisce la squadra da attivare. */
export async function importBackup(file: File): Promise<{ teams: number; players: number; games: number; activeTeamId: number }> {
  const data = JSON.parse(await file.text()) as Partial<Backup>;
  const okApp = data.app === 'basket-monitor' || data.app === 'donbosco-basket-monitor';
  if (!okApp || !Array.isArray(data.players) || !Array.isArray(data.games)) throw new Error('File di backup non valido');
  let teams = Array.isArray(data.teams) ? data.teams : [];
  let players = data.players;
  let games = data.games;
  // Backup della Fase 1 (senza squadre): tutto alla squadra predefinita
  if (!teams.length) {
    teams = [{ ...defaultTeam(), id: 1 }];
    players = players.map((p) => ({ ...p, teamId: 1 }));
    games = games.map((g) => ({ ...g, teamId: 1 }));
  }
  await db.transaction('rw', [db.teams, db.players, db.games, db.kv, db.reports, db.sessions, db.rpe], async () => {
    await Promise.all([db.teams.clear(), db.players.clear(), db.games.clear(), db.kv.clear(), db.reports.clear(), db.sessions.clear(), db.rpe.clear()]);
    await db.teams.bulkPut(teams);
    if (Array.isArray(data.sessions)) await db.sessions.bulkPut(data.sessions);
    if (Array.isArray(data.rpe)) await db.rpe.bulkPut(data.rpe);
    await db.players.bulkPut(players);
    await db.games.bulkPut(games);
    if (Array.isArray(data.reports)) await db.reports.bulkPut(data.reports);
    // backup precedenti: resoconti salvati in kv come "report:<id>"
    if (Array.isArray(data.kv)) {
      for (const k of data.kv) {
        if (!k.key.startsWith('report:')) continue;
        const live = k.value as GameReport['live'] & { finishedAt?: number };
        const snap = live.called.map((pid) => {
          const p = players.find((x) => x.id === pid);
          return { id: pid, name: p?.name ?? `Giocatore ${pid}`, number: p?.number ?? '', role: p?.role ?? ('SF' as const) };
        });
        await db.reports.put({ gameId: live.gameId, teamId: live.teamId, finishedAt: live.finishedAt ?? k.updatedAt, players: snap, live });
      }
      await db.kv.bulkPut(data.kv.filter((k) => k.key !== 'legacyImportDone' && !k.key.startsWith('report:')));
    }
    await db.kv.put({ key: 'legacyImportDone', value: true, updatedAt: now() });
  });
  const activeTeamId = await ensureTeam(data.activeTeamId ?? null);
  return { teams: teams.length, players: players.length, games: games.length, activeTeamId };
}

/** Elimina tutto e ricrea la squadra predefinita. */
export async function wipeAll(): Promise<number> {
  await db.transaction('rw', [db.teams, db.players, db.games, db.kv, db.reports, db.sessions, db.rpe], async () => {
    await Promise.all([db.teams.clear(), db.players.clear(), db.games.clear(), db.kv.clear(), db.reports.clear(), db.sessions.clear(), db.rpe.clear()]);
    await db.kv.put({ key: 'legacyImportDone', value: true, updatedAt: now() });
  });
  return (await db.teams.add(defaultTeam())) as number;
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

/** Crea una nuova squadra di esempio (verde/oro) con roster e calendario. */
export async function loadDemoTeam(): Promise<number> {
  const t = now();
  const shift = (days: number) => {
    const d = new Date();
    d.setDate(d.getDate() + days);
    return toISODate(d);
  };
  return db.transaction('rw', db.teams, db.players, db.games, async () => {
    const teamId = (await db.teams.add({
      name: 'Squadra di esempio',
      season: currentSeason(),
      primary: '#0b5d3b',
      secondary: '#f2b705',
      archived: false,
      createdAt: t,
      updatedAt: t,
    })) as number;
    await db.players.bulkAdd(
      DEMO.map(([name, number, role, traits, status = 'available', details = '']) => ({
        teamId,
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
    const g = (days: number, time: string, opp: number, home: boolean, extra: Partial<Game> = {}): Game => ({
      teamId,
      date: shift(days),
      time,
      opponent: OPPONENTS[opp],
      home,
      notes: '',
      status: 'scheduled',
      createdAt: t,
      updatedAt: t,
      ...extra,
    });
    await db.games.bulkAdd([
      g(-14, '18:30', 0, true, { status: 'finished', scoreUs: 68, scoreThem: 61, finishedAt: t }),
      g(-7, '21:00', 1, false, { status: 'finished', scoreUs: 55, scoreThem: 63, finishedAt: t }),
      g(0, '19:00', 2, true, { notes: 'Partita di esempio' }),
      g(7, '18:00', 3, false),
      g(14, '20:30', 4, true),
      g(21, '18:00', 5, false),
    ]);
    return teamId;
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

/** Una sola volta: se esiste il database del vecchio prototipo, ne copia giocatori e partite nella squadra predefinita. */
export async function importLegacyOnce(): Promise<number> {
  if (await db.kv.get('legacyImportDone')) return 0;
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
        const teamId = await ensureTeam(null);
        const t = now();
        const statusMap = { ok: 'available', inj: 'injured', doubt: 'doubtful' } as const;
        await db.players.bulkAdd(
          players.map((p) => ({
            teamId,
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
            teamId,
            date: g.date ?? todayISO(),
            time: g.time ?? '18:00',
            opponent: g.opponent ?? '',
            home: g.home ?? true,
            notes: g.notes ?? '',
            status: g.finished ? ('finished' as const) : ('scheduled' as const),
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
