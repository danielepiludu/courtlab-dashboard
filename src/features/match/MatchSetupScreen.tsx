import { useEffect, useMemo, useRef, useState } from 'react';
import { CalendarPlus, Check, CirclePlay, MapPin, Plane, Star, Users, Zap } from 'lucide-react';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Avatar } from '@/components/ui/Avatar';
import { RoleBadge, STATUS_META } from '@/components/ui/Badges';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/misc';
import { useGames, usePlayers } from '@/db/hooks';
import type { Game, Player } from '@/db/types';
import { fmtDayMonth, relativeDay, todayISO } from '@/lib/dates';
import { haptic } from '@/lib/haptics';
import { enterGameMode } from '@/lib/device';
import { cx } from '@/lib/cx';
import { toast } from '@/store/feedback';
import { useUI } from '@/store/ui';
import { GAME } from '@/config';
import { QuickGameSheet } from './QuickGameSheet';

const N = GAME.onCourt;

function StepTitle({ n, title, right }: { n: number; title: string; right?: React.ReactNode }) {
  return (
    <div className="mb-3 mt-7 flex items-center gap-3 px-1">
      <span className="grid h-7 w-7 place-items-center rounded-full bg-brand font-display text-[15px] font-bold text-white">{n}</span>
      <h2 className="flex-1 font-display text-[19px] font-bold uppercase tracking-[0.1em]">{title}</h2>
      {right}
    </div>
  );
}

function GameCard({ g, selected, onClick }: { g: Game; selected: boolean; onClick: () => void }) {
  const today = g.date === todayISO();
  return (
    <button
      onClick={onClick}
      className={cx(
        'pressable relative w-[200px] shrink-0 rounded-2xl border p-3.5 text-left transition-shadow',
        selected ? 'border-accent bg-accent/15 shadow-glow' : 'border-line bg-surface',
      )}
    >
      {selected && (
        <span className="anim-pop absolute right-2.5 top-2.5 grid h-6 w-6 place-items-center rounded-full bg-accent text-white">
          <Check size={15} strokeWidth={3} />
        </span>
      )}
      <div className={cx('text-[12px] font-bold uppercase tracking-widest', today ? 'text-brand' : 'text-ink-muted')}>{today ? 'Oggi' : relativeDay(g.date)}</div>
      <div className="mt-1 truncate pr-6 font-display text-[22px] font-bold leading-tight">{g.opponent || 'Avversario'}</div>
      <div className="mt-1 flex items-center gap-1.5 text-[13px] text-ink-muted">
        {g.home ? <MapPin size={13} /> : <Plane size={13} />}
        {fmtDayMonth(g.date)} · {g.time}
      </div>
    </button>
  );
}

function CallTile({ p, called, disabled, onClick }: { p: Player; called: boolean; disabled: boolean; onClick: () => void }) {
  return (
    <button
      disabled={disabled}
      onClick={onClick}
      className={cx(
        'pressable relative flex items-center gap-3 rounded-2xl border p-2.5 text-left transition-shadow disabled:active:scale-100',
        called ? 'border-accent bg-accent/10 shadow-glow' : 'border-line bg-surface',
        disabled && 'opacity-45',
      )}
    >
      <div className="relative shrink-0">
        <Avatar player={p} size={48} />
        <span
          className={cx(
            'absolute -bottom-1 -right-1 grid h-6 w-6 place-items-center rounded-full border-2 transition',
            called ? 'anim-pop border-surface bg-accent text-white' : 'border-ink-faint bg-surface',
          )}
        >
          {called && <Check size={13} strokeWidth={3.5} />}
        </span>
      </div>
      <div className="min-w-0 flex-1">
        <b className="block truncate text-[15px] leading-tight">{p.name.split(' ')[0]}</b>
        <div className="mt-1 flex items-center gap-1.5">
          <span className="font-display text-[16px] font-bold leading-none text-brand">{p.number !== '' ? `#${p.number}` : '–'}</span>
          <RoleBadge role={p.role} className="h-5 min-w-[28px] text-[12px]" />
          {p.status !== 'available' && <i className={cx('h-2 w-2 shrink-0 rounded-full', STATUS_META[p.status].dot)} title={STATUS_META[p.status].label} />}
        </div>
      </div>
    </button>
  );
}

export function MatchSetupScreen() {
  const games = useGames();
  const players = usePlayers();
  const setup = useUI((s) => s.setup);
  const patch = useUI((s) => s.patchSetup);
  const setSubstrate = useUI((s) => s.setSubstrate);
  const setTab = useUI((s) => s.setTab);
  const [quick, setQuick] = useState(false);

  const today = todayISO();
  const selectable = useMemo(() => {
    const open = (games ?? []).filter((g) => g.status !== 'finished');
    // prima oggi e le prossime, poi quelle passate non giocate
    return [...open.filter((g) => g.date >= today), ...open.filter((g) => g.date < today).reverse()];
  }, [games, today]);
  const all = useMemo(() => players ?? [], [players]);
  const byId = useMemo(() => new Map(all.map((p) => [p.id!, p])), [all]);
  const game = selectable.find((g) => g.id === setup.gameId);

  // Pulizia della bozza: giocatori eliminati, infortunati non ammessi
  useEffect(() => {
    if (players === undefined) return;
    const ok = (id: number) => {
      const p = byId.get(id);
      return !!p && (setup.allowInjured || p.status !== 'injured');
    };
    const called = setup.called.filter(ok);
    const starters = setup.starters.filter((id) => called.includes(id));
    if (called.length !== setup.called.length || starters.length !== setup.starters.length) patch({ called, starters });
  }, [players, byId, setup, patch]);

  // Alla prima apertura seleziona automaticamente la partita di oggi
  const autoPicked = useRef(false);
  useEffect(() => {
    if (autoPicked.current || games === undefined) return;
    autoPicked.current = true;
    if (!game && selectable[0]?.date === today) patch({ gameId: selectable[0].id! });
  }, [games, game, selectable, today, patch]);

  const calledPlayers = all.filter((p) => setup.called.includes(p.id!));
  const injuredCount = all.filter((p) => p.status === 'injured').length;

  const toggleCall = (id: number) => {
    haptic.tap();
    if (setup.called.includes(id)) patch({ called: setup.called.filter((x) => x !== id), starters: setup.starters.filter((x) => x !== id) });
    else patch({ called: [...setup.called, id] });
  };

  const toggleStarter = (id: number) => {
    if (setup.starters.includes(id)) {
      haptic.tap();
      patch({ starters: setup.starters.filter((x) => x !== id) });
    } else if (setup.starters.length >= N) {
      haptic.warn();
      toast(`Il quintetto ha già ${N} titolari: togline uno prima`, 'info');
    } else {
      haptic.select();
      patch({ starters: [...setup.starters, id] });
    }
  };

  const callAllAvailable = () => {
    haptic.select();
    const ids = all.filter((p) => p.status !== 'injured' || setup.allowInjured).map((p) => p.id!);
    patch({ called: ids });
  };

  const missing = !game
    ? 'Scegli la partita'
    : setup.called.length < N
      ? `Servono almeno ${N} convocati (${setup.called.length}/${N})`
      : setup.starters.length < N
        ? `Scegli ${N} titolari (${setup.starters.length}/${N})`
        : null;

  const start = () => {
    if (missing) return;
    haptic.confirm();
    void enterGameMode();
    setSubstrate('live');
  };

  return (
    <>
      <ScreenHeader title="Partita" subtitle="Partita, convocati e quintetto titolare" />
      <div className="mx-auto max-w-2xl px-4 pb-32">
        {/* 1 · Partita */}
        <StepTitle
          n={1}
          title="Partita"
          right={
            <button onClick={() => setQuick(true)} className="flex h-9 items-center gap-1.5 rounded-full bg-white/5 px-3 text-sm font-bold text-accent-light active:scale-95">
              <Zap size={15} /> Al volo
            </button>
          }
        />
        {games === undefined ? null : selectable.length === 0 ? (
          <EmptyState
            icon={<CalendarPlus size={30} />}
            title="Nessuna partita da giocare"
            text="Aggiungila dal calendario nella Home oppure creane una al volo."
            action={
              <div className="flex gap-2">
                <Button onClick={() => setTab('home')}>Calendario</Button>
                <Button variant="primary" icon={<Zap size={18} />} onClick={() => setQuick(true)}>
                  Al volo
                </Button>
              </div>
            }
          />
        ) : (
          <div className="no-scrollbar -mx-4 flex gap-2.5 overflow-x-auto px-4 pb-2 pt-1">
            {selectable.map((g) => (
              <GameCard
                key={g.id}
                g={g}
                selected={g.id === setup.gameId}
                onClick={() => {
                  haptic.select();
                  patch({ gameId: g.id === setup.gameId ? null : g.id! });
                }}
              />
            ))}
          </div>
        )}

        {/* 2 · Convocati */}
        <StepTitle
          n={2}
          title="Convocati"
          right={
            <span className="font-display text-xl font-bold tabular">
              <span className={setup.called.length >= N ? 'text-accent-light' : 'text-ink-muted'}>{setup.called.length}</span>
              <span className="text-ink-faint">/{all.length}</span>
            </span>
          }
        />
        {players === undefined ? null : all.length === 0 ? (
          <EmptyState
            icon={<Users size={30} />}
            title="Nessun giocatore in rosa"
            text="Aggiungi i giocatori dalla tab Giocatori."
            action={<Button onClick={() => setTab('players')}>Vai a Giocatori</Button>}
          />
        ) : (
          <>
            <div className="mb-3 flex gap-2">
              <Button size="sm" onClick={callAllAvailable}>
                Tutti i disponibili
              </Button>
              <Button size="sm" variant="ghost" disabled={!setup.called.length} onClick={() => patch({ called: [], starters: [] })}>
                Azzera
              </Button>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {all.map((p) => (
                <CallTile
                  key={p.id}
                  p={p}
                  called={setup.called.includes(p.id!)}
                  disabled={p.status === 'injured' && !setup.allowInjured}
                  onClick={() => toggleCall(p.id!)}
                />
              ))}
            </div>
            {injuredCount > 0 && (
              <label className="mt-3 flex min-h-[48px] cursor-pointer items-center gap-3 rounded-2xl border border-line bg-surface/60 px-4">
                <span className="flex-1 text-[14px] text-ink-muted">
                  <b className="text-danger">{injuredCount} infortunat{injuredCount === 1 ? 'o' : 'i'}</b> — consenti la convocazione
                </span>
                <input
                  type="checkbox"
                  className="peer sr-only"
                  checked={setup.allowInjured}
                  onChange={(e) => {
                    haptic.tap();
                    patch({ allowInjured: e.target.checked });
                  }}
                />
                <span className="relative h-7 w-12 rounded-full bg-white/10 transition peer-checked:bg-accent after:absolute after:left-1 after:top-1 after:h-5 after:w-5 after:rounded-full after:bg-white after:transition-transform peer-checked:after:translate-x-5" />
              </label>
            )}
          </>
        )}

        {/* 3 · Quintetto */}
        <StepTitle
          n={3}
          title="Quintetto titolare"
          right={
            <span className="font-display text-xl font-bold tabular">
              <span className={setup.starters.length === N ? 'text-accent-light' : 'text-ink-muted'}>{setup.starters.length}</span>
              <span className="text-ink-faint">/{N}</span>
            </span>
          }
        />
        {calledPlayers.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-line px-4 py-6 text-center text-[14px] text-ink-muted">Seleziona prima i convocati</div>
        ) : (
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {calledPlayers.map((p) => {
              const st = setup.starters.includes(p.id!);
              return (
                <button
                  key={p.id}
                  onClick={() => toggleStarter(p.id!)}
                  className={cx(
                    'pressable anim-pop relative flex flex-col items-center rounded-2xl border px-1 pb-2.5 pt-3 transition-shadow',
                    st ? 'border-accent bg-accent/15 shadow-glow' : 'border-line bg-surface',
                  )}
                >
                  {st && (
                    <span className="anim-pop absolute right-1.5 top-1.5 grid h-6 w-6 place-items-center rounded-full bg-accent text-white">
                      <Star size={13} fill="currentColor" />
                    </span>
                  )}
                  <Avatar player={p} size={64} />
                  <div className="mt-1.5 flex max-w-full items-baseline gap-1 px-1">
                    <span className="font-display text-[16px] font-bold text-brand">{p.number}</span>
                    <b className="truncate text-[14px]">{p.name.split(' ')[0]}</b>
                  </div>
                  <span className="text-[11px] font-bold text-ink-muted">{p.role}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Barra azione */}
      <div className="fixed inset-x-0 z-30" style={{ bottom: 'calc(var(--tabbar-h) + var(--safe-bottom))' }}>
        <div className="mx-auto max-w-2xl bg-gradient-to-t from-night via-night/95 to-transparent px-4 pb-3 pt-6">
          <Button
            variant="primary"
            size="lg"
            className="w-full disabled:!bg-surface-3 disabled:!text-ink-faint disabled:!opacity-100 disabled:!shadow-none"
            icon={<CirclePlay size={24} />}
            disabled={!!missing}
            onClick={start}
          >
            Inizia partita
          </Button>
          <div className={cx('mt-1.5 h-4 text-center text-[13px] font-semibold', missing ? 'text-ink-muted' : 'text-accent-light')}>
            {missing ?? `${game!.home ? 'vs' : '@'} ${game!.opponent} · ${setup.called.length} convocati`}
          </div>
        </div>
      </div>

      <QuickGameSheet open={quick} onClose={() => setQuick(false)} onCreated={(id) => patch({ gameId: id })} />
    </>
  );
}
