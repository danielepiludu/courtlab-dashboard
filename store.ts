import { create } from 'zustand';
import { db, type Game, type Player } from './db';
import { advance, type Live } from './live';
interface Match { gameId: number | null; conv: number[]; start: number[] }
interface S {
  players: Player[]; games: Game[]; match: Match; live: Live | null; setLive: (l: Live | null) => Promise<void>;
  load: () => Promise<void>; setMatch: (m: Partial<Match>) => void;
  savePlayer: (p: Player) => Promise<void>; delPlayer: (id: number) => Promise<void>;
  saveGame: (g: Game) => Promise<number>; delGame: (id: number) => Promise<void>;
}
export const useStore = create<S>((set, get) => ({
  players: [], games: [], live: null, match: { gameId: null, conv: [], start: [] },
  async load() { const lv = await db.live.get(1); set({ players: await db.players.orderBy('number').toArray(), games: await db.games.orderBy('date').toArray(), live: lv ? advance(lv, Date.now()) : null }); },
  async setLive(l) { set({ live: l }); if (l) await db.live.put(l); else await db.live.delete(1); },
  setMatch: (m) => set((s) => ({ match: { ...s.match, ...m } })),
  async savePlayer(p) { await db.players.put(p); await get().load(); },
  async delPlayer(id) { await db.players.delete(id); await get().load(); },
  async saveGame(g) { const id = await db.games.put(g); await get().load(); return id as number; },
  async delGame(id) { await db.games.delete(id); await get().load(); },
}));
