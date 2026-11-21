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

const emptySetup = (): SetupDraft => ({ gameId: null, called: [], starters: [], allowInjured: false });

interface UIState {
  tab: Tab;
  setTab: (t: Tab) => void;
  substrate: Substrate;
  setSubstrate: (s: Substrate) => void;
  setup: SetupDraft;
  patchSetup: (p: Partial<SetupDraft>) => void;
  resetSetup: () => void;
  /** id della partita il cui resoconto è aperto nella tab Resoconti */
  openReportId: number | null;
  setOpenReport: (id: number | null) => void;
}

export const useUI = create<UIState>()(
  persist(
    (set) => ({
      tab: 'home',
      setTab: (tab) => set({ tab }),
      substrate: 'tabs',
      setSubstrate: (substrate) => set({ substrate }),
      setup: emptySetup(),
      patchSetup: (p) => set((s) => ({ setup: { ...s.setup, ...p } })),
      resetSetup: () => set({ setup: emptySetup() }),
      openReportId: null,
      setOpenReport: (openReportId) => set({ openReportId }),
    }),
    {
      name: 'dbbm-ui',
      version: 1,
      partialize: (s) => ({ tab: s.tab, setup: s.setup }),
    },
  ),
);
