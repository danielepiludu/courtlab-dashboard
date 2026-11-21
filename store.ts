import { create } from 'zustand';
import { db, type Game, type Player } from './db';
interface Match { gameId: number | null; conv: number[]; start: number[] }
interface S {
  players: Player[]; games: Game[]; match: Match;
  load: () => Promise<void>; setMatch: (m: Partial<Match>) => void;
  savePlayer: (p: Player) => Promise<void>; delPlayer: (id: number) => Promise<void>;
  saveGame: (g: Game) => Promise<number>; delGame: (id: number) => Promise<void>;
}
export const useStore = create<S>((set, get) => ({
  players: [], games: [], match: { gameId: null, conv: [], start: [] },
  async load() { set({ players: await db.players.orderBy('number').toArray(), games: await db.games.orderBy('date').toArray() }); },
  setMatch: (m) => set((s) => ({ match: { ...s.match, ...m } })),
  async savePlayer(p) { await db.players.put(p); await get().load(); },
  async delPlayer(id) { await db.players.delete(id); await get().load(); },
  async saveGame(g) { const id = await db.games.put(g); await get().load(); return id as number; },
  async delGame(id) { await db.games.delete(id); await get().load(); },
}));
