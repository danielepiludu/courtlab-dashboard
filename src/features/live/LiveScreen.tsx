import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { ArrowLeftRight, EllipsisVertical, Expand, FastForward, LogOut, Pause, Play, Rewind, RotateCcw, RotateCw, Square, X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Sheet } from '@/components/ui/Sheet';
import { TeamLogo } from '@/components/TeamLogo';
import { useActiveTeam, usePlayers } from '@/db/hooks';
import type { Player, Role } from '@/db/types';
import { enterGameMode, exitGameMode, useWakeLock } from '@/lib/device';
import { useBackClose } from '@/lib/backNav';
import { useNow } from '@/lib/useNow';
import { haptic } from '@/lib/haptics';
import { cx } from '@/lib/cx';
import { confirmDialog, toast } from '@/store/feedback';
import { finishLive, useLive } from '@/store/live';
import { useUI } from '@/store/ui';
import { Court } from './Court';
import { BenchCard, CourtCard, shortName } from './PlayerCards';
import { CARD_H, CARD_W, SLOTS_M, computeView, type CourtView } from './courtGeometry';
import { addScore, adjustClock, mmss, periodLabel, periodLength, periodOver, restMs, settle, substitute, toggleClock, undoScore, type LiveState } from './liveModel';

/** INT: il motore arriva con la Fase 3. */
const intOf = (_s: LiveState, _id: number) => 0;
const ADJUST_MS = 5000;

/** Animazione dei cambi (FLIP con "fantasmi" sopra a tutto, così nulla viene tagliato dagli scroll). */
function useSwapAnimation(dep: unknown) {
  const before = useRef<Map<string, DOMRect> | null>(null);
  const capture = useCallback(() => {
    const m = new Map<string, DOMRect>();
    document.querySelectorAll<HTMLElement>('[data-flip]').forEach((el) => m.set(el.dataset.flip!, el.getBoundingClientRect()));
    before.current = m;
  }, []);
  useLayoutEffect(() => {
    const prev = before.current;
    before.current = null;
    if (!prev) return;
    // stessa scala del campo (--m) per i fantasmi delle card in campo
    const meter = document.querySelector<HTMLElement>('[data-court]')?.style.getPropertyValue('--m') ?? '20px';
    document.querySelectorAll<HTMLElement>('[data-flip]').forEach((el) => {
      const a = prev.get(el.dataset.flip!);
      if (!a) return;
      const b = el.getBoundingClientRect();
      const dx = a.left + a.width / 2 - (b.left + b.width / 2);
      const dy = a.top + a.height / 2 - (b.top + b.height / 2);
      if (Math.abs(dx) < 2 && Math.abs(dy) < 2) return;
      const ghost = el.cloneNode(true) as HTMLElement;
      Object.assign(ghost.style, { position: 'fixed', left: `${b.left}px`, top: `${b.top}px`, width: `${b.width}px`, height: `${b.height}px`, margin: '0', zIndex: '70', pointerEvents: 'none' });
      ghost.style.setProperty('--m', meter);
      ghost.removeAttribute('data-flip');
      document.body.appendChild(ghost);
      el.style.opacity = '0';
      const k = Math.min(1.25, Math.max(0.75, a.width / b.width));
      const anim = ghost.animate(
        [
          { transform: `translate(${dx}px, ${dy}px) scale(${k})` },
          { transform: `translate(${dx * 0.45}px, ${dy * 0.45 - 18}px) scale(${(k + 1) / 2 + 0.06})`, offset: 0.5 },
          { transform: 'none' },
        ],
        { duration: 620, easing: 'cubic-bezier(.25,.8,.3,1)' },
      );
      anim.onfinish = anim.oncancel = () => {
        el.style.opacity = '';
        ghost.remove();
      };
    });
  }, [dep]);
  return capture;
}

/** Dimensioni del contenitore del campo (per calcolare la vista e la scala in metri). */
function useCourtView(ready: boolean): [React.RefObject<HTMLDivElement>, CourtView] {
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 600, h: 320 });
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setSize({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    setSize({ w: el.clientWidth, h: el.clientHeight });
    return () => ro.disconnect();
  }, [ready]);
  return [ref, useMemo(() => computeView(size.w, size.h), [size.w, size.h])];
}

interface Pop {
  id: number;
  diff: number;
}
let popId = 1;

/** Punteggio con +1/+2/+3 sotto e animazioni quando si segna (o si annulla). */
function ScoreBlock({ label, score, logo, accent, onAdd }: { label: ReactNode; score: number; logo?: ReactNode; accent: boolean; onAdd: (n: 1 | 2 | 3) => void }) {
  const prev = useRef(score);
  const [pops, setPops] = useState<Pop[]>([]);
  const [flash, setFlash] = useState(0);
  useEffect(() => {
    const diff = score - prev.current;
    prev.current = score;
    if (!diff) return;
    const id = popId++;
    setPops((p) => [...p, { id, diff }]);
    if (diff > 0) setFlash(id);
    const t = setTimeout(() => setPops((p) => p.filter((x) => x.id !== id)), 1300);
    return () => clearTimeout(t);
  }, [score]);

  return (
    <div className="flex min-w-0 flex-col items-center gap-1">
      <div className="flex max-w-full items-center gap-2">
        {logo}
        <span className="max-w-[90px] truncate text-[11px] font-bold uppercase tracking-wider text-ink-muted [@media(max-width:820px)]:hidden">{label}</span>
        <span className="relative inline-grid place-items-center">
          {/* onda luminosa dietro al numero */}
          {flash > 0 && <span key={flash} className={cx('score-ring absolute inset-[-10px] rounded-full', accent ? 'bg-brand/50' : 'bg-white/30')} />}
          <span key={score} className="score-roll relative font-display text-[34px] font-extrabold leading-none tabular [@media(min-height:600px)]:text-[44px]">
            {score}
          </span>
          {/* +N / −N che sale accanto al punteggio */}
          {pops.map((p) => (
            <span
              key={p.id}
              className={cx(
                'score-pop pointer-events-none absolute left-full top-1/2 ml-1 whitespace-nowrap font-display font-extrabold leading-none',
                p.diff < 0 ? 'text-[18px] text-ink-muted' : p.diff >= 3 ? 'text-[28px]' : 'text-[24px]',
                p.diff > 0 && (accent ? 'text-brand-text' : 'text-ink'),
              )}
            >
              {p.diff > 0 ? `+${p.diff}` : `−${-p.diff}`}
              {p.diff >= 3 && (
                <span className="absolute inset-0" aria-hidden>
                  {[0, 1, 2, 3, 4, 5].map((i) => (
                    <i key={i} className={cx('score-spark absolute left-1/2 top-1/2 h-1.5 w-1.5 rounded-full', accent ? 'bg-brand' : 'bg-ink')} style={{ '--a': `${i * 60}deg` } as CSSProperties} />
                  ))}
                </span>
              )}
            </span>
          ))}
        </span>
      </div>
      <div className="flex gap-1">
        {([1, 2, 3] as const).map((n) => (
          <button
            key={n}
            onClick={() => {
              haptic.select();
              onAdd(n);
            }}
            className="h-11 w-11 rounded-xl border border-white/10 bg-white/[.07] font-display text-[17px] font-bold transition active:scale-90 active:bg-white/20"
          >
            +{n}
          </button>
        ))}
      </div>
    </div>
  );
}

function AdjustButton({ dir, disabled, onClick }: { dir: 1 | -1; disabled: boolean; onClick: () => void }) {
  return (
    <button
      disabled={disabled}
      onClick={onClick}
      aria-label={dir > 0 ? 'Avanti di 5 secondi' : 'Indietro di 5 secondi'}
      className="flex h-11 min-w-[54px] items-center justify-center gap-1 rounded-xl border border-white/10 bg-white/[.07] px-2 font-display text-[15px] font-bold transition active:scale-90 active:bg-white/20 disabled:opacity-30"
    >
      {dir < 0 && <Rewind size={15} fill="currentColor" />}
      5s
      {dir > 0 && <FastForward size={15} fill="currentColor" />}
    </button>
  );
}

/** Secondo substrato: schermata partita (landscape, fullscreen, senza tab bar). */
export function LiveScreen() {
  const live = useLive((s) => s.live);
  const update = useLive((s) => s.update);
  const team = useActiveTeam();
  const players = usePlayers();
  const setSubstrate = useUI((s) => s.setSubstrate);
  const setTab = useUI((s) => s.setTab);
  const resetSetup = useUI((s) => s.resetSetup);
  const now = useNow(250);
  const [selOn, setSelOn] = useState<number[]>([]);
  const [selBench, setSelBench] = useState<number[]>([]);
  const [menu, setMenu] = useState(false);
  const [isFs, setIsFs] = useState(() => !!document.fullscreenElement);
  const [courtRef, view] = useCourtView(!!live);
  useWakeLock(true);
  // Tasto Indietro: apre il menu invece di uscire dalla partita
  useBackClose(!menu, () => setMenu(true));
  const capture = useSwapAnimation(live?.slots.join(','));

  useEffect(() => {
    const f = () => setIsFs(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', f);
    return () => document.removeEventListener('fullscreenchange', f);
  }, []);

  const v = useMemo(() => (live ? settle(live, now) : null), [live, now]);
  const byId = useMemo(() => new Map((players ?? []).map((p) => [p.id!, p])), [players]);
  const roles = useMemo(() => Object.fromEntries((players ?? []).map((p) => [p.id!, p.role])) as Record<number, Role>, [players]);
  const calledPlayers = useMemo(() => (live ? (live.called.map((id) => byId.get(id)).filter(Boolean) as Player[]) : []), [live, byId]);

  // Fine periodo: il cronometro si ferma a 00:00 all'istante esatto di scadenza
  useEffect(() => {
    if (live?.running && v && !v.running) {
      haptic.alarm();
      update((s) => settle(s, Date.now()));
      toast(`Fine ${periodLabel(live.period)}`, 'info', 3000);
    }
  }, [live?.running, v?.running]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!live || !v) return null;

  const bench = calledPlayers.filter((p) => !v.players[p.id!]?.onCourt).sort((a, b) => Number(a.number || 999) - Number(b.number || 999));
  const canConfirm = selOn.length > 0 && selOn.length === selBench.length;
  const anySel = selOn.length + selBench.length > 0;

  const tap = (id: number, onCourt: boolean) => {
    haptic.tap();
    const [sel, setSel] = onCourt ? [selOn, setSelOn] : [selBench, setSelBench];
    setSel(sel.includes(id) ? sel.filter((x) => x !== id) : [...sel, id]);
  };

  const confirmSub = () => {
    if (!canConfirm) return;
    haptic.confirm();
    capture();
    const n = selOn.length;
    update((s, t) => substitute(s, selOn, selBench, roles, t));
    setSelOn([]);
    setSelBench([]);
    toast(n === 1 ? 'Cambio effettuato' : `${n} cambi effettuati`, 'success', 1800);
  };

  const toggle = () => {
    haptic.heavy();
    update((s, t) => toggleClock(s, t));
  };

  const adjust = (dir: 1 | -1) => {
    haptic.tap();
    update((s, t) => adjustClock(s, dir * ADJUST_MS, t));
  };

  const exitToTabs = async () => {
    setMenu(false);
    await exitGameMode();
    setSubstrate('tabs');
    toast('La partita resta in corso: riprendila dalla tab Partita', 'info', 3500);
  };

  const terminate = async () => {
    setMenu(false);
    const ok = await confirmDialog({
      title: 'Termina partita',
      message: 'Sei sicuro di voler concludere la partita?',
      confirmLabel: 'Termina',
      danger: true,
    });
    if (!ok) return;
    haptic.confirm();
    await finishLive();
    resetSetup(live.teamId);
    await exitGameMode();
    setTab('reports');
    setSubstrate('tabs');
    toast(`Partita salvata: ${v.us}–${v.them}`, 'success', 3000);
  };

  const over = periodOver(v);
  const lastSecs = v.running && v.remainingMs < 60_000;
  const startLabel = v.running ? 'Stop' : over ? `Avvia ${periodLabel(v.period + 1)}` : 'Start';
  const len = periodLength(v.period);

  return (
    <div className="fixed inset-0 flex select-none flex-col overflow-hidden bg-night">
      {/* In verticale */}
      <div className="fixed inset-0 z-[60] hidden flex-col items-center justify-center gap-4 bg-night p-8 text-center portrait:flex">
        <RotateCw size={56} className="animate-[spin_3s_linear_infinite] text-accent-light" />
        <b className="font-display text-3xl tracking-wide">Ruota il telefono</b>
        <span className="max-w-xs text-ink-muted">La schermata partita si usa in orizzontale. I timer continuano a funzionare.</span>
      </div>

      {/* ---------- Header ---------- */}
      <header
        className="flex h-[96px] shrink-0 items-center gap-3 border-b border-white/5 bg-bar px-3 shadow-[0_10px_30px_-18px_rgba(0,0,0,.9)] [@media(min-height:600px)]:h-[116px] [@media(min-height:600px)]:px-5"
        style={{ paddingLeft: 'max(12px, env(safe-area-inset-left))', paddingRight: 'max(12px, env(safe-area-inset-right))' }}
      >
        {/* Periodo + cronometro + ±5 s + Start/Stop */}
        <div className="flex items-center gap-2.5">
          <div className="flex flex-col items-center gap-1">
            <div className="flex items-center gap-2">
              <span className={cx('rounded-full px-2 py-0.5 text-[13px] font-extrabold leading-tight tracking-wide', v.period >= 4 ? 'bg-warn/20 text-warn' : 'bg-white/10 text-ink')}>{periodLabel(v.period)}</span>
              <span
                className={cx(
                  'font-display text-[36px] font-extrabold leading-none tabular transition-colors [@media(min-height:600px)]:text-[48px]',
                  over ? 'text-brand-text' : lastSecs ? 'text-warn' : !v.running && v.started ? 'text-ink-muted' : 'text-ink',
                )}
              >
                {mmss(v.remainingMs, 'ceil')}
              </span>
            </div>
            <div className="flex gap-1.5">
              <AdjustButton dir={-1} disabled={!v.started || v.remainingMs >= len} onClick={() => adjust(-1)} />
              <AdjustButton dir={1} disabled={!v.started || v.remainingMs <= 0} onClick={() => adjust(1)} />
            </div>
          </div>
          <button
            onClick={toggle}
            className={cx(
              'flex h-[72px] min-w-[80px] flex-col items-center justify-center rounded-2xl px-3 font-display text-[15px] font-bold leading-none transition active:scale-95 [@media(min-height:600px)]:h-[84px] [@media(min-height:600px)]:min-w-[100px]',
              v.running ? 'border border-white/15 bg-surface-3 text-ink' : over ? 'bg-brand text-on-brand shadow-brand' : 'bg-accent text-on-accent shadow-select',
            )}
          >
            {v.running ? <Pause size={24} /> : <Play size={24} fill="currentColor" />}
            <span className="mt-1.5">{startLabel}</span>
          </button>
        </div>

        {/* Punteggio */}
        <div className="flex min-w-0 flex-1 items-center justify-center gap-2 [@media(min-width:900px)]:gap-4">
          <ScoreBlock label={team?.name} accent score={v.us} logo={<TeamLogo team={team} size={28} />} onAdd={(n) => update((s, t) => addScore(s, 'us', n, t))} />
          <button
            disabled={!v.scoreLog.length}
            onClick={() => {
              haptic.tap();
              const last = v.scoreLog[v.scoreLog.length - 1];
              update((s) => undoScore(s));
              if (last) toast(`Annullato +${last.pts} ${last.side === 'us' ? (team?.name ?? '') : v.opponent}`, 'info', 1800);
            }}
            aria-label="Annulla ultimo punteggio"
            className="mt-[38px] grid h-11 w-11 shrink-0 place-items-center rounded-xl text-ink-muted transition active:scale-90 disabled:opacity-25 [@media(min-height:600px)]:mt-[48px]"
          >
            <RotateCcw size={20} />
          </button>
          <ScoreBlock
            label={v.opponent}
            accent={false}
            score={v.them}
            logo={<span className="max-w-[86px] truncate text-[12px] font-bold uppercase text-ink-muted [@media(min-width:821px)]:hidden">{v.opponent}</span>}
            onAdd={(n) => update((s, t) => addScore(s, 'them', n, t))}
          />
        </div>

        {/* Menu + Termina */}
        <div className="flex items-center gap-1.5">
          <button onClick={() => setMenu(true)} aria-label="Menu partita" className="grid h-11 w-11 place-items-center rounded-xl text-ink-muted active:scale-90">
            <EllipsisVertical size={22} />
          </button>
          <Button variant="primary" className="h-12 px-3.5 text-[15px] leading-tight" icon={<Square size={16} fill="currentColor" />} onClick={terminate}>
            <span className="text-left">
              Termina
              <br className="[@media(min-width:1000px)]:hidden" /> partita
            </span>
          </Button>
        </div>
      </header>

      {/* ---------- Corpo: panchina a sinistra (2 colonne), campo verticale a destra ---------- */}
      <div className="flex min-h-0 flex-1">
        <aside className="relative flex w-[clamp(300px,31vw,420px)] shrink-0 flex-col border-r border-white/5" style={{ paddingLeft: 'env(safe-area-inset-left)' }}>
          <div className="flex items-center gap-2 px-2.5 pb-1.5 pt-2">
            <h2 className="font-display text-[19px] font-extrabold uppercase tracking-[0.12em]">Panchina</h2>
            <span className="rounded-full bg-white/10 px-2 text-[13px] font-bold">{bench.length}</span>
          </div>
          {!v.started && <p className="px-2.5 pb-1.5 text-[12px] font-semibold leading-snug text-ink-muted">Premi Start per avviare i timer</p>}
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2.5 pb-24">
            <div className="grid grid-cols-2 gap-2">
              {bench.map((p) => {
                const s = v.players[p.id!];
                return (
                  <BenchCard
                    key={p.id}
                    p={p}
                    name={shortName(p, calledPlayers)}
                    playedMs={s.playedMs}
                    restMs={restMs(s, now)}
                    started={v.started}
                    int={intOf(v, p.id!)}
                    selected={selBench.includes(p.id!)}
                    onTap={() => tap(p.id!, false)}
                  />
                );
              })}
              {!bench.length && <div className="col-span-2 rounded-2xl border border-dashed border-line p-4 text-center text-sm text-ink-muted">Nessun giocatore in panchina</div>}
            </div>
          </div>

          {/* Barra del cambio */}
          <div className={cx('pointer-events-none absolute inset-x-0 bottom-0 px-2.5 pb-2.5 transition duration-300 ease-out', anySel ? 'translate-y-0 opacity-100' : 'translate-y-6 opacity-0')}>
            <div className="pointer-events-auto flex items-center gap-2 rounded-2xl border border-line bg-surface-2/95 p-2 shadow-card backdrop-blur">
              <button
                onClick={() => {
                  haptic.tap();
                  setSelOn([]);
                  setSelBench([]);
                }}
                aria-label="Annulla selezione"
                className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-white/5 text-ink-muted active:scale-90"
              >
                <X size={20} />
              </button>
              {canConfirm ? (
                <Button variant="accent" size="lg" className="h-12 flex-1 whitespace-nowrap px-2.5 text-[15px]" icon={<ArrowLeftRight size={18} />} onClick={confirmSub}>
                  Conferma cambio{selOn.length > 1 ? ` ${selOn.length}-${selBench.length}` : ''}
                </Button>
              ) : (
                <div className="min-w-0 flex-1 px-1 text-[13px] font-semibold leading-snug text-ink-muted">
                  Esce: <b className="text-ink">{selOn.length}</b> · Entra: <b className="text-ink">{selBench.length}</b>
                  <span className="block truncate text-[12px] font-medium">
                    {selOn.length > selBench.length ? `Scegli ${selOn.length - selBench.length} dalla panchina` : `Scegli ${selBench.length - selOn.length} in campo`}
                  </span>
                </div>
              )}
            </div>
          </div>
        </aside>

        {/* Campo verticale: il parquet riempie tutto lo spazio, il campo è centrato */}
        <section ref={courtRef} data-court className="relative min-w-0 flex-1 overflow-hidden" style={{ '--m': `${view.s}px` } as CSSProperties}>
          <Court team={team} view={view} />
          {v.slots.map((id, slot) => {
            const p = byId.get(id);
            const s = v.players[id];
            if (!p || !s) return null;
            const [x, y] = SLOTS_M[slot];
            return (
              <div
                key={id}
                className="absolute"
                style={{ left: (x - CARD_W / 2 - view.x0) * view.s, top: (y - CARD_H / 2 - view.y0) * view.s, width: CARD_W * view.s, height: CARD_H * view.s }}
              >
                <CourtCard p={p} name={shortName(p, calledPlayers)} playedMs={s.playedMs} int={intOf(v, id)} selected={selOn.includes(id)} onTap={() => tap(id, true)} />
              </div>
            );
          })}
        </section>
      </div>

      {/* ---------- Menu ---------- */}
      <Sheet open={menu} onClose={() => setMenu(false)} title="Partita" subtitle={`${team?.name ?? ''} ${live.home ? 'vs' : '@'} ${live.opponent}`}>
        <div className="space-y-2 pb-2">
          {!isFs && document.fullscreenEnabled && (
            <Button size="lg" className="w-full justify-start" icon={<Expand size={20} />} onClick={() => (setMenu(false), void enterGameMode())}>
              Schermo intero
            </Button>
          )}
          <Button size="lg" className="w-full justify-start" icon={<LogOut size={20} />} onClick={exitToTabs}>
            Esci (la partita resta in corso)
          </Button>
          <Button variant="primary" size="lg" className="w-full justify-start" icon={<Square size={18} fill="currentColor" />} onClick={terminate}>
            Termina partita
          </Button>
        </div>
      </Sheet>
    </div>
  );
}
