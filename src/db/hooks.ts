import { useLiveQuery } from 'dexie-react-hooks';
import { db } from './db';
import { compareNumbers, type Game, type Player } from './types';

const sortGames = (a: Game, b: Game) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time);

/** Giocatori ordinati per numero di maglia. `undefined` mentre carica. */
export function usePlayers(): Player[] | undefined {
  return useLiveQuery(async () => (await db.players.toArray()).sort((a, b) => compareNumbers(a.number, b.number)), []);
}

/** Partite ordinate per data/ora crescente. `undefined` mentre carica. */
export function useGames(): Game[] | undefined {
  return useLiveQuery(async () => (await db.games.toArray()).sort(sortGames), []);
}

export function useGame(id: number | null | undefined): Game | undefined {
  return useLiveQuery(async () => (id == null ? undefined : db.games.get(id)), [id]);
}
