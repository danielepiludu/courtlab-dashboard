import Dexie, { type Table, type Transaction } from 'dexie';
import { BUILTIN_LOGO, type Game, type GameReport, type Player, type ReportPlayer, type Team } from './types';
import { DEFAULT_TEAM } from '@/config';

/** Record generico chiave/valore (stato partita in corso, resoconti, impostazioni) */
export interface KV {
  key: string;
  value: unknown;
  updatedAt: number;
}

export function defaultTeam(): Team {
  const t = Date.now();
  return { ...DEFAULT_TEAM, logo: BUILTIN_LOGO, archived: false, createdAt: t, updatedAt: t };
}

export class AppDB extends Dexie {
  teams!: Table<Team, number>;
  players!: Table<Player, number>;
  games!: Table<Game, number>;
  kv!: Table<KV, string>;
  reports!: Table<GameReport, number>;

  constructor() {
    super('donbosco-basket-monitor');
    // v1: Fase 1 (squadra singola)
    this.version(1).stores({
      players: '++id, name, number, role, status',
      games: '++id, date, status',
      kv: 'key',
    });
    // v2: multi-squadra. I dati esistenti vengono assegnati alla squadra predefinita.
    this.version(2)
      .stores({
        teams: '++id, createdAt',
        players: '++id, teamId, name, number, role, status',
        games: '++id, teamId, date, status',
        kv: 'key',
      })
      .upgrade(async (tx: Transaction) => {
        const teamId = (await tx.table('teams').add(defaultTeam())) as number;
        await tx.table('players').toCollection().modify((p: Player) => void (p.teamId = teamId));
        await tx.table('games').toCollection().modify((g: Game) => void (g.teamId = teamId));
      });
    // v3: tabella dei resoconti (prima in kv come "report:<id>")
    this.version(3)
      .stores({
        teams: '++id, createdAt',
        players: '++id, teamId, name, number, role, status',
        games: '++id, teamId, date, status',
        kv: 'key',
        reports: 'gameId, teamId',
      })
      .upgrade(async (tx: Transaction) => {
        const old = (await tx.table('kv').where('key').startsWith('report:').toArray()) as KV[];
        const players = (await tx.table('players').toArray()) as Player[];
        for (const rec of old) {
          const live = rec.value as GameReport['live'] & { finishedAt?: number };
          const snap: ReportPlayer[] = live.called.map((id) => {
            const p = players.find((x) => x.id === id);
            return { id, name: p?.name ?? `Giocatore ${id}`, number: p?.number ?? '', role: p?.role ?? 'SF' };
          });
          await tx.table('reports').put({ gameId: live.gameId, teamId: live.teamId, finishedAt: live.finishedAt ?? rec.updatedAt, players: snap, live });
          await tx.table('kv').delete(rec.key);
        }
      });
    // Primo avvio: crea la squadra predefinita
    this.on('populate', (tx) => {
      void tx.table('teams').add(defaultTeam());
    });
  }
}

export const db = new AppDB();

/** Chiede al browser di non cancellare i dati in caso di poco spazio. */
export async function requestPersistentStorage() {
  try {
    if (navigator.storage?.persisted && !(await navigator.storage.persisted())) {
      await navigator.storage.persist?.();
    }
  } catch {
    /* ignora */
  }
}
