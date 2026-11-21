import { useEffect, useState } from 'react';
import { useStore } from './store';
import { vib } from './ui';
import Home from './Home';
import Players from './Players';
import Match from './Match';
import History from './History';
const TABS = [
  { id: 'home', l: 'Home', d: 'M3 11l9-8 9 8v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z' },
  { id: 'pl', l: 'Giocatori', d: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8M22 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8' },
  { id: 'match', l: 'Partita', d: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20M10 8l6 4-6 4z' },
  { id: 'hist', l: 'Storico', d: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20M12 6v6l4 2' },
] as const;
export default function App() {
  const load = useStore((s) => s.load);
  const [tab, setTab] = useState<(typeof TABS)[number]['id']>('home');
  useEffect(() => { load(); }, [load]);
  return (
    <div className="mx-auto flex h-full max-w-3xl flex-col">
      <main key={tab} className="anim-fade flex-1 overflow-y-auto pt-[env(safe-area-inset-top)] pb-28">
        {tab === 'home' && <Home />}{tab === 'pl' && <Players />}{tab === 'match' && <Match />}{tab === 'hist' && <History />}
      </main>
      <nav className="fixed inset-x-0 bottom-0 z-40 mx-auto flex max-w-3xl justify-around rounded-t-3xl border-t border-white/10 bg-card/95 px-2 pt-2 pb-[max(env(safe-area-inset-bottom),12px)] backdrop-blur">
        {TABS.map((t) => (
          <button key={t.id} onClick={() => { vib(8); setTab(t.id); }} aria-label={t.l}
            className={`flex h-14 w-20 flex-col items-center justify-center gap-0.5 rounded-2xl transition active:scale-90 ${tab === t.id ? 'bg-lime/15 text-lime' : 'text-white/50'}`}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d={t.d} /></svg>
            <span className="text-[11px] font-semibold">{t.l}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}
