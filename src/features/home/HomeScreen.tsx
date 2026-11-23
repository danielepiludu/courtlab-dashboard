import { useMemo, useState } from 'react';
import { CalendarPlus, ChevronDown, CirclePlay, Lock, MapPin, Plane, Plus, Settings } from 'lucide-react';
import { ScreenHeader } from '@/components/ScreenHeader';
import { SettingsSheet } from '@/components/SettingsSheet';
import { Button } from '@/components/ui/Button';
import { EmptyState, SectionTitle } from '@/components/ui/misc';
import { TeamLogo } from '@/components/TeamLogo';
import { useActiveTeam, useGames } from '@/db/hooks';
import { newGame } from '@/db/repo';
import { type Game } from '@/db/types';
import { fmtLong, parseISODate, relativeDay, todayISO, canStartOn } from '@/lib/dates';
import { haptic } from '@/lib/haptics';
import { useSetup, useUI } from '@/store/ui';
import { TeamSwitcherSheet } from '@/features/teams/TeamSwitcherSheet';
import { GameFormSheet } from './GameFormSheet';
import { GameRow } from './GameRow';
import { MonthCalendar } from './MonthCalendar';

const firstOfMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth(), 1);

function NextGameCard({ game, onPrepare, onOpen, readOnly }: { game: Game; onPrepare: () => void; onOpen: () => void; readOnly: boolean }) {
  const rel = relativeDay(game.date);
  const isToday = game.date === todayISO();
  return (
    <div className="anim-rise relative overflow-hidden rounded-3xl border border-white/5 bg-gradient-to-br from-bar to-surface p-5 shadow-card">
      {/* pallone decorativo */}
      <svg className="pointer-events-none absolute -right-14 -top-14 h-56 w-56 rotate-[18deg] opacity-[0.13]" viewBox="0 0 200 200" fill="none" stroke="#fff" strokeWidth="4">
        <circle cx="100" cy="100" r="94" />
        <path d="M100 6v188M6 100h188M40 28c32 36 32 108 0 144M160 28c-32 36-32 108 0 144" />
      </svg>
      <div className="relative">
        <div className="flex items-center gap-2">
          <span className={`rounded-full px-2.5 py-1 text-[11px] font-extrabold uppercase tracking-widest ${isToday ? 'bg-brand text-on-brand' : 'bg-white/10 text-ink'}`}>
            {isToday ? 'Oggi si gioca' : 'Prossima partita'}
          </span>
          {!isToday && <span className="text-[13px] font-semibold text-accent-light">{rel}</span>}
        </div>
        <button onClick={onOpen} className="mt-3 block text-left">
          <div className="font-display text-[15px] font-semibold uppercase tracking-[0.2em] text-ink-muted">{game.home ? 'In casa contro' : 'In trasferta a'}</div>
          <div className="font-display text-[34px] font-extrabold leading-[1.05] tracking-wide">{game.opponent}</div>
        </button>
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[14px] text-ink-muted">
          <span>{fmtLong(game.date)}</span>
          <span>· ore {game.time}</span>
          <span className="flex items-center gap-1">
            · {game.home ? <MapPin size={14} /> : <Plane size={14} />} {game.home ? 'Casa' : 'Trasferta'}
          </span>
        </div>
        {!readOnly &&
          (canStartOn(game.date) ? (
            <Button variant="primary" size="lg" className="mt-4 w-full" icon={<CirclePlay size={22} />} onClick={onPrepare}>
              Prepara la partita
            </Button>
          ) : (
            <div className="mt-4 flex h-12 items-center justify-center gap-2 rounded-2xl bg-white/[.06] text-[14px] font-semibold text-ink-muted">
              <Lock size={16} /> Si potrà iniziare {rel.toLowerCase().startsWith('tra') ? fmtLong(game.date, false).toLowerCase() : rel.toLowerCase()}
            </div>
          ))}
      </div>
    </div>
  );
}

export function HomeScreen() {
  const games = useGames();
  const team = useActiveTeam();
  const readOnly = !!team?.archived;
  const teamId = team?.id ?? 0;
  const setTab = useUI((s) => s.setTab);
  const patchSetup = useUI((s) => s.patchSetup);
  const setup = useSetup();
  const [switcher, setSwitcher] = useState(false);
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

  const changeMonth = (d: 1 | -1) => {
    haptic.tap();
    setDir(d);
    setMonth((m) => new Date(m.getFullYear(), m.getMonth() + d, 1));
  };

  const openReport = useUI((s) => s.openReport);
  /** partite concluse: si apre il resoconto; le altre: la scheda partita */
  const openGame = (g: Game) => {
    haptic.tap();
    if (g.status === 'finished') openReport(g.id!);
    else setEditing(g);
  };

  const prepare = (g: Game) => {
    haptic.select();
    if (setup.gameId !== g.id) patchSetup({ gameId: g.id! });
    setTab('match');
  };

  return (
    <>
      <ScreenHeader
        left={
          <button
            onClick={() => {
              haptic.tap();
              setSwitcher(true);
            }}
            aria-label="Cambia squadra"
            className="-ml-1 flex min-w-0 flex-1 items-center gap-3 rounded-2xl py-1 pl-1 pr-2 text-left transition active:scale-[.98] active:bg-white/5"
          >
            <TeamLogo key={team?.id} team={team} size={44} className="anim-pop" />
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-1">
                <span className="truncate font-display text-[21px] font-bold leading-tight tracking-wide">{team?.name ?? ''}</span>
                <ChevronDown size={18} className="shrink-0 text-ink-muted" />
              </span>
              <span className="block truncate text-[13px] font-medium text-ink-muted">Stagione {team?.season}</span>
            </span>
          </button>
        }
        right={
          <button onClick={() => setSettings(true)} aria-label="Impostazioni" className="grid h-11 w-11 place-items-center rounded-full text-ink-muted transition hover:bg-white/5 active:scale-90">
            <Settings size={22} />
          </button>
        }
      />
      <div className="mx-auto max-w-2xl px-4 pt-4">
        {games === undefined ? null : next ? (
          <NextGameCard game={next} readOnly={readOnly} onPrepare={() => prepare(next)} onOpen={() => setEditing(next)} />
        ) : (
          <EmptyState
            icon={<CalendarPlus size={30} />}
            title="Nessuna partita in programma"
            text={readOnly ? 'Nessuna partita futura in questa stagione archiviata.' : 'Aggiungi le partite del girone per vederle nel calendario.'}
            action={
              !readOnly && (
                <Button variant="primary" icon={<Plus size={20} />} onClick={() => setEditing(newGame(teamId, selected))}>
                  Nuova partita
                </Button>
              )
            }
          />
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

        {/* partite del giorno scelto nel calendario (oggi: già in evidenza in alto) */}
        {(selected !== today || dayGames.some((g) => g.id !== next?.id)) && (
          <>
            <SectionTitle>{selected === today ? 'Oggi' : fmtLong(selected, false)}</SectionTitle>
            <div key={selected} className="stagger space-y-2">
              {dayGames.length ? (
                dayGames.map((g) => <GameRow key={g.id} game={g} onClick={() => openGame(g)} />)
              ) : (
                <p className="anim-fade px-1 text-[14px] text-ink-faint">Nessuna partita in questa data</p>
              )}
            </div>
          </>
        )}

        {upcoming.length > 1 && (
          <>
            <SectionTitle>Prossime partite</SectionTitle>
            <div className="stagger space-y-2">
              {upcoming.slice(1, 4).map((g) => (
                <GameRow key={g.id} game={g} onClick={() => openGame(g)} />
              ))}
            </div>
          </>
        )}

        {finished.length > 0 && (
          <>
            <SectionTitle
              right={
                <button onClick={() => setTab('reports')} className="h-8 rounded-full px-2 text-[13px] font-semibold text-accent-light active:scale-95">
                  Tutti
                </button>
              }
            >
              Risultati recenti
            </SectionTitle>
            <div className="stagger space-y-2">
              {finished.slice(0, 2).map((g) => (
                <GameRow key={g.id} game={g} onClick={() => openGame(g)} />
              ))}
            </div>
          </>
        )}
        <div className="h-6" />
      </div>

      {!readOnly && (
      <button
        onClick={() => {
          haptic.select();
          setEditing(newGame(teamId, selected));
        }}
        aria-label="Nuova partita"
        className="fixed right-5 z-30 grid h-14 w-14 place-items-center rounded-2xl bg-brand text-on-brand shadow-brand-lg transition active:scale-90"
        style={{ bottom: 'calc(var(--tabbar-h) + var(--safe-bottom) + 16px)' }}
      >
        <Plus size={28} strokeWidth={2.6} />
      </button>
      )}

      <GameFormSheet game={editing} readOnly={readOnly} onClose={() => setEditing(null)} />
      <SettingsSheet open={settings} onClose={() => setSettings(false)} />
      <TeamSwitcherSheet open={switcher} onClose={() => setSwitcher(false)} />
    </>
  );
}
