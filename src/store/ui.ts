import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type Tab = 'home' | 'players' | 'match' | 'reports';
export type Substrate = 'tabs' | 'live';

export interface SetupDraft {
  gameId: number | null;
  /** id dei convocati */
  called: number[];
  /** id dei 5 titolari (sottoinsieme dei convocati) */
  starters: number[];
  /** abilita la convocazione di giocatori segnalati come infortunati */
  allowInjured: boolean;
}

export const EMPTY_SETUP: SetupDraft = Object.freeze({ gameId: null, called: [], starters: [], allowInjured: false }) as SetupDraft;

interface UIState {
  /** squadra attiva: tutto ciò che si vede dipende da questa */
  activeTeamId: number | null;
  setActiveTeam: (id: number) => void;
  tab: Tab;
  setTab: (t: Tab) => void;
  substrate: Substrate;
  setSubstrate: (s: Substrate) => void;
  /** schermata Squadre (non è una tab) */
  teamsOpen: boolean;
  setTeamsOpen: (o: boolean) => void;
  /** bozza di convocazione, separata per ogni squadra */
  setups: Record<number, SetupDraft>;
  patchSetup: (p: Partial<SetupDraft>) => void;
  resetSetup: (teamId?: number) => void;
}

export const useUI = create<UIState>()(
  persist(
    (set, get) => ({
      activeTeamId: null,
      setActiveTeam: (activeTeamId) => set({ activeTeamId }),
      tab: 'home',
      setTab: (tab) => set({ tab }),
      substrate: 'tabs',
      setSubstrate: (substrate) => set({ substrate }),
      teamsOpen: false,
      setTeamsOpen: (teamsOpen) => set({ teamsOpen }),
      setups: {},
      patchSetup: (p) => {
        const id = get().activeTeamId;
        if (id == null) return;
        set((s) => ({ setups: { ...s.setups, [id]: { ...(s.setups[id] ?? EMPTY_SETUP), ...p } } }));
      },
      resetSetup: (teamId) => {
        if (teamId === undefined) return set({ setups: {} });
        set((s) => {
          const setups = { ...s.setups };
          delete setups[teamId];
          return { setups };
        });
      },
    }),
    {
      name: 'dbbm-ui',
      version: 2,
      partialize: (s) => ({ tab: s.tab, setups: s.setups, activeTeamId: s.activeTeamId }),
      // v1 aveva una sola bozza `setup`: si scarta (i convocati vanno riscelti per squadra)
      migrate: (old) => {
        const o = (old ?? {}) as Partial<UIState>;
        return { tab: o.tab ?? 'home', setups: {}, activeTeamId: null } as unknown as UIState;
      },
    },
  ),
);

/** Bozza di convocazione della squadra attiva. */
export const useSetup = () => useUI((s) => (s.activeTeamId != null ? s.setups[s.activeTeamId] : undefined) ?? EMPTY_SETUP);
