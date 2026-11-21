import { useMemo, useState } from 'react';
import { CalendarPlus, CirclePlay, MapPin, Plane, Plus, Settings } from 'lucide-react';
import { ScreenHeader } from '@/components/ScreenHeader';
import { SettingsSheet } from '@/components/SettingsSheet';
import { Button } from '@/components/ui/Button';
import { EmptyState, Logo, SectionTitle } from '@/components/ui/misc';
import { useGames } from '@/db/hooks';
import { newGame } from '@/db/repo';
import { outcomeOf, type Game } from '@/db/types';
import { fmtLong, parseISODate, relativeDay, todayISO } from '@/lib/dates';
import { haptic } from '@/lib/haptics';
import { useUI } from '@/store/ui';
import { APP } from '@/config';
import { GameFormSheet } from './GameFormSheet';
import { GameRow } from './GameRow';
import { MonthCalendar } from './MonthCalendar';

const firstOfMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth(), 1);

function NextGameCard({ game, onPrepare, onOpen }: { game: Game; onPrepare: () => void; onOpen: () => void }) {
  const rel = relativeDay(game.date);
  const isToday = game.date === todayISO();
  return (
    <div className="anim-rise relative overflow-hidden rounded-3xl border border-white/5 bg-gradient-to-br from-navy via-[#0a2350] to-surface p-5 shadow-card">
      {/* pallone decorativo */}
      <svg className="pointer-events-none absolute -right-14 -top-14 h-56 w-56 rotate-[18deg] opacity-[0.13]" viewBox="0 0 200 200" fill="none" stroke="#fff" strokeWidth="4">
        <circle cx="100" cy="100" r="94" />
        <path d="M100 6v188M6 100h188M40 28c32 36 32 108 0 144M160 28c-32 36-32 108 0 144" />
      </svg>
      <div className="relative">
        <div className="flex items-center gap-2">
          <span className={`rounded-full px-2.5 py-1 text-[11px] font-extrabold uppercase tracking-widest ${isToday ? 'bg-brand text-white' : 'bg-white/10 text-ink'}`}>
            {isToday ? 'Oggi si gioca' : 'Prossima partita'}
          </span>
          {!isToday && <span className="text-[13px] font-semibold text-accent-light">{rel}</span>}
        </div>
        <button onClick={onOpen} className="mt-3 block text-left">
          <div className="font-display text-[15px] font-semibold uppercase tracking-[0.2em] text-ink-muted">{game.home ? 'Don Bosco vs' : 'In trasferta a'}</div>
          <div className="font-display text-[34px] font-extrabold leading-[1.05] tracking-wide">{game.opponent}</div>
        </button>
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[14px] text-ink-muted">
          <span>{fmtLong(game.date)}</span>
          <span>· ore {game.time}</span>
          <span className="flex items-center gap-1">
            · {game.home ? <MapPin size={14} /> : <Plane size={14} />} {game.home ? 'Casa' : 'Trasferta'}
          </span>
        </div>
        <Button variant="primary" size="lg" className="mt-4 w-full" icon={<CirclePlay size={22} />} onClick={onPrepare}>
          Prepara la partita
        </Button>
      </div>
    </div>
  );
}

export function HomeScreen() {
  const games = useGames();
  const setTab = useUI((s) => s.setTab);
  const patchSetup = useUI((s) => s.patchSetup);
  const setup = useUI((s) => s.setup);
  const [month, setMonth] = useState(() => firstOfMonth(new Date()));
  const [dir, setDir] = useState<1 | -1>(1);
  const [selected, setSelected] = useState(todayISO);
  const [editing, setEditing] = useState<Game | null>(null);
  const [settings, setSettings] = useState(false);

  const today = todayISO();
  const all = useMemo(() => games ?? [], [games]);
  const upcoming = all.filter((g) => g.status !== 'finished' && g.date >= today);
  const next = upcoming[0];
  const finished = all.filter((g) => g.status === 'finished').reverse();
  const dayGames = all.filter((g) => g.date === selected);
  const wins = finished.filter((g) => outcomeOf(g) === 'W').length;

  const changeMonth = (d: 1 | -1) => {
    haptic.tap();
    setDir(d);
    setMonth((m) => new Date(m.getFullYear(), m.getMonth() + d, 1));
  };

  const prepare = (g: Game) => {
    haptic.select();
    if (setup.gameId !== g.id) patchSetup({ gameId: g.id! });
    setTab('match');
  };

  return (
    <>
      <ScreenHeader
        left={<Logo size={44} />}
        title={APP.team}
        subtitle="Basket Monitor"
        right={
          <button onClick={() => setSettings(true)} aria-label="Impostazioni" className="grid h-11 w-11 place-items-center rounded-full text-ink-muted transition hover:bg-white/5 active:scale-90">
            <Settings size={22} />
          </button>
        }
      />
      <div className="mx-auto max-w-2xl px-4 pt-4">
        {games === undefined ? null : next ? (
          <NextGameCard game={next} onPrepare={() => prepare(next)} onOpen={() => setEditing(next)} />
        ) : (
          <EmptyState
            icon={<CalendarPlus size={30} />}
            title="Nessuna partita in programma"
            text="Aggiungi le partite del girone per vederle nel calendario."
            action={
              <Button variant="primary" icon={<Plus size={20} />} onClick={() => setEditing(newGame(selected))}>
                Nuova partita
              </Button>
            }
          />
        )}

        {finished.length > 0 && (
          <div className="mt-3 grid grid-cols-3 gap-2 text-center">
            {[
              { l: 'Giocate', v: finished.length, c: 'text-ink' },
              { l: 'Vinte', v: wins, c: 'text-ok' },
              { l: 'Perse', v: finished.length - wins - finished.filter((g) => outcomeOf(g) === 'D').length, c: 'text-brand' },
            ].map((s) => (
              <div key={s.l} className="card py-2.5">
                <div className={`font-display text-2xl font-bold leading-none ${s.c}`}>{s.v}</div>
                <div className="mt-1 text-[11px] font-semibold uppercase tracking-widest text-ink-muted">{s.l}</div>
              </div>
            ))}
          </div>
        )}

        <SectionTitle>Calendario</SectionTitle>
        <MonthCalendar
          month={month}
          dir={dir}
          onMonth={changeMonth}
          onToday={() => {
            const now = firstOfMonth(new Date());
            setDir(now > month ? 1 : -1);
            setMonth(now);
            setSelected(today);
          }}
          games={all}
          selected={selected}
          onSelect={(iso) => {
            setSelected(iso);
            const d = parseISODate(iso);
            if (d.getMonth() !== month.getMonth()) setMonth(firstOfMonth(d));
          }}
        />

        <SectionTitle
          right={
            <button onClick={() => setEditing(newGame(selected))} className="flex h-9 items-center gap-1 rounded-full px-3 text-sm font-bold text-accent-light active:scale-95">
              <Plus size={16} /> Aggiungi
            </button>
          }
        >
          {selected === today ? 'Oggi' : fmtLong(selected, false)}
        </SectionTitle>
        <div key={selected} className="stagger space-y-2">
          {dayGames.length ? (
            dayGames.map((g) => <GameRow key={g.id} game={g} onClick={() => setEditing(g)} />)
          ) : (
            <div className="anim-fade rounded-2xl border border-dashed border-line px-4 py-4 text-center text-[14px] text-ink-muted">Nessuna partita in questa data</div>
          )}
        </div>

        {upcoming.length > 1 && (
          <>
            <SectionTitle>Prossime partite</SectionTitle>
            <div className="stagger space-y-2">
              {upcoming.slice(1, 7).map((g) => (
                <GameRow key={g.id} game={g} onClick={() => setEditing(g)} />
              ))}
            </div>
          </>
        )}

        {finished.length > 0 && (
          <>
            <SectionTitle
              right={
                <button onClick={() => setTab('reports')} className="h-9 rounded-full px-3 text-sm font-bold text-accent-light active:scale-95">
                  Tutti i resoconti
                </button>
              }
            >
              Risultati recenti
            </SectionTitle>
            <div className="stagger space-y-2">
              {finished.slice(0, 3).map((g) => (
                <GameRow key={g.id} game={g} onClick={() => setEditing(g)} />
              ))}
            </div>
          </>
        )}
        <div className="h-6" />
      </div>

      <button
        onClick={() => {
          haptic.select();
          setEditing(newGame(selected));
        }}
        aria-label="Nuova partita"
        className="fixed right-5 z-30 grid h-14 w-14 place-items-center rounded-2xl bg-brand text-white shadow-[0_10px_30px_-8px_rgba(238,50,57,.9)] transition active:scale-90"
        style={{ bottom: 'calc(var(--tabbar-h) + var(--safe-bottom) + 16px)' }}
      >
        <Plus size={28} strokeWidth={2.6} />
      </button>

      <GameFormSheet game={editing} onClose={() => setEditing(null)} />
      <SettingsSheet open={settings} onClose={() => setSettings(false)} />
    </>
  );
}
