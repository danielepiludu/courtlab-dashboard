import Dexie, { type Table, type Transaction } from 'dexie';
import { BUILTIN_LOGO, type Game, type Player, type Team } from './types';
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
