import Dexie, { type Table } from 'dexie';
import type { Game, Player } from './types';

/** Record generico chiave/valore (stato partita in corso, impostazioni, ecc.) */
export interface KV {
  key: string;
  value: unknown;
  updatedAt: number;
}

export class AppDB extends Dexie {
  players!: Table<Player, number>;
  games!: Table<Game, number>;
  kv!: Table<KV, string>;

  constructor() {
    super('donbosco-basket-monitor');
    this.version(1).stores({
      players: '++id, name, number, role, status',
      games: '++id, date, status',
      kv: 'key',
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
