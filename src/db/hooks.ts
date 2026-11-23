import { useLiveQuery } from 'dexie-react-hooks';
import { db } from './db';
import { compareSurname, type Game, type Player, type Team } from './types';
import { useUI } from '@/store/ui';

const sortGames = (a: Game, b: Game) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time);
const sortTeams = (a: Team, b: Team) => Number(a.archived) - Number(b.archived) || b.createdAt - a.createdAt;

export const useActiveTeamId = () => useUI((s) => s.activeTeamId);

/** Tutte le squadre: prima le attive (più recenti in alto), poi le archiviate. */
export function useTeams(): Team[] | undefined {
  return useLiveQuery(async () => (await db.teams.toArray()).sort(sortTeams), []);
}

export function useActiveTeam(): Team | undefined {
  const id = useActiveTeamId();
  return useLiveQuery(async () => (id == null ? undefined : db.teams.get(id)), [id]);
}

/** true se la squadra attiva è archiviata: tutto in sola lettura. */
export function useReadOnly(): boolean {
  return !!useActiveTeam()?.archived;
}

/** Giocatori della squadra attiva, in ordine alfabetico per cognome. `undefined` mentre carica. */
export function usePlayers(): Player[] | undefined {
  const id = useActiveTeamId();
  return useLiveQuery(
    async () => (id == null ? [] : (await db.players.where('teamId').equals(id).toArray()).sort(compareSurname)),
    [id],
  );
}

/** Partite della squadra attiva in ordine cronologico. `undefined` mentre carica. */
export function useGames(): Game[] | undefined {
  const id = useActiveTeamId();
  return useLiveQuery(async () => (id == null ? [] : (await db.games.where('teamId').equals(id).toArray()).sort(sortGames)), [id]);
}

export function useGame(id: number | null | undefined): Game | undefined {
  return useLiveQuery(async () => (id == null ? undefined : db.games.get(id)), [id]);
}

export interface TeamCounts {
  players: number;
  games: number;
  finished: number;
}

/** Conteggi per squadra (giocatori, partite, concluse). */
export function useTeamCounts(): Record<number, TeamCounts> {
  return (
    useLiveQuery(async () => {
      const out: Record<number, TeamCounts> = {};
      const get = (id: number) => (out[id] ??= { players: 0, games: 0, finished: 0 });
      await db.players.each((p) => void get(p.teamId).players++);
      await db.games.each((g) => {
        const c = get(g.teamId);
        c.games++;
        if (g.status === 'finished') c.finished++;
      });
      return out;
    }, []) ?? {}
  );
}

/** Sedute della squadra attiva (più recenti prima). */
export function useSessions(): import('./types').TrainingSession[] | undefined {
  const id = useActiveTeamId();
  return useLiveQuery(async () => (id == null ? [] : (await db.sessions.where('teamId').equals(id).toArray()).sort((a, b) => b.date.localeCompare(a.date) || (b.id ?? 0) - (a.id ?? 0))), [id]);
}

/** Tutti gli RPE della squadra attiva. */
export function useRpeEntries(): import('./types').RpeEntry[] | undefined {
  const id = useActiveTeamId();
  return useLiveQuery(async () => (id == null ? [] : db.rpe.where('teamId').equals(id).toArray()), [id]);
}

/** Rilevazioni antropometriche della squadra attiva (dalla più recente). */
export function useMeasureSessions(): import('./types').MeasureSession[] | undefined {
  const id = useActiveTeamId();
  return useLiveQuery(async () => (id == null ? [] : (await db.msessions.where('teamId').equals(id).toArray()).sort((a, b) => b.date.localeCompare(a.date))), [id]);
}

/** Misure degli atleti della squadra attiva. */
export function useMeasures(): import('./types').AthleteMeasures[] | undefined {
  const id = useActiveTeamId();
  return useLiveQuery(async () => (id == null ? [] : db.measures.where('teamId').equals(id).toArray()), [id]);
}
