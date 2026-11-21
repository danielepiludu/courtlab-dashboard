import { useEffect, useState } from 'react';
import { TabBar } from '@/components/TabBar';
import { Splash } from '@/components/Splash';
import { FeedbackHost } from '@/components/ui/FeedbackHost';
import { HomeScreen } from '@/features/home/HomeScreen';
import { PlayersScreen } from '@/features/players/PlayersScreen';
import { MatchSetupScreen } from '@/features/match/MatchSetupScreen';
import { ReportsScreen } from '@/features/reports/ReportsScreen';
import { LiveScreen } from '@/features/live/LiveScreen';
import { TeamsScreen } from '@/features/teams/TeamsScreen';
import { ReportScreen } from '@/features/report/ReportScreen';
import { ThemeController } from '@/theme/ThemeController';
import { db, requestPersistentStorage } from '@/db/db';
import { ensureTeam, importLegacyOnce } from '@/db/repo';
import { useUI } from '@/store/ui';
import { useLive } from '@/store/live';
import { toast } from '@/store/feedback';
import { SPLASH_MIN_MS } from '@/config';

/** Avvio: apre il database, importa eventuali dati legacy e ripristina la squadra attiva. */
function useBoot() {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const t0 = Date.now();
    void (async () => {
      try {
        await db.open();
        const n = await importLegacyOnce();
        if (n) toast(`Importati ${n} elementi dalla versione precedente`, 'success', 3500);
        const ui = useUI.getState();
        // Partita in corso (es. app chiusa per sbaglio): si riprende da dove era
        const live = await useLive.getState().load();
        const id = await ensureTeam(live?.teamId ?? ui.activeTeamId);
        if (id !== ui.activeTeamId) ui.setActiveTeam(id);
        ui.setSubstrate(live ? 'live' : 'tabs');
      } catch (e) {
        console.error(e);
        toast('Errore di accesso ai dati locali', 'error', 5000);
      }
      void requestPersistentStorage();
      setTimeout(() => setReady(true), Math.max(0, SPLASH_MIN_MS - (Date.now() - t0)));
    })();
  }, []);
  return ready;
}

export default function App() {
  const ready = useBoot();
  const [splashGone, setSplashGone] = useState(false);
  const tab = useUI((s) => s.tab);
  const substrate = useUI((s) => s.substrate);
  const teamId = useUI((s) => s.activeTeamId);

  useEffect(() => {
    if (!ready) return;
    const t = setTimeout(() => setSplashGone(true), 520);
    return () => clearTimeout(t);
  }, [ready]);

  return (
    <>
      {ready && <ThemeController />}
      {ready &&
        (substrate === 'live' ? (
          <LiveScreen />
        ) : (
          <div className="flex h-full flex-col">
            <main
              id="tab-scroll"
              key={`${tab}-${teamId}`}
              className="anim-fade flex-1 overflow-y-auto overscroll-contain"
              style={{ paddingBottom: 'calc(var(--tabbar-h) + var(--safe-bottom))' }}
            >
              {tab === 'home' && <HomeScreen />}
              {tab === 'players' && <PlayersScreen />}
              {tab === 'match' && <MatchSetupScreen />}
              {tab === 'reports' && <ReportsScreen />}
            </main>
            <TabBar />
            <TeamsScreen />
            <ReportScreen />
          </div>
        ))}
      {!splashGone && <Splash leaving={ready} />}
      <FeedbackHost />
    </>
  );
}
