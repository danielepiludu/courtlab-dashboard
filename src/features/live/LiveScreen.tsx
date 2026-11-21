import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { ArrowLeftRight, EllipsisVertical, Expand, LogOut, Pause, Play, RotateCcw, RotateCw, Square, X } from 'lucide-react';
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
import { CourtCard, RestCard, shortName } from './PlayerCards';
import { ASPECT, CARD_H, CARD_W, SLOTS_PCT } from './courtGeometry';
import { addScore, mmss, periodLabel, periodOver, restMs, settle, substitute, toggleClock, undoScore, type LiveState } from './liveModel';

/** INT: il motore arriva con la Fase 3. */
const intOf = (_s: LiveState, _id: number) => 0;

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
    document.querySelectorAll<HTMLElement>('[data-flip]').forEach((el) => {
      const a = prev.get(el.dataset.flip!);
      if (!a) return;
      const b = el.getBoundingClientRect();
      const dx = a.left + a.width / 2 - (b.left + b.width / 2);
      const dy = a.top + a.height / 2 - (b.top + b.height / 2);
      if (Math.abs(dx) < 2 && Math.abs(dy) < 2) return;
      // contenitore con la stessa larghezza del campo: le unità cqw del fantasma restano corrette
      const courtW = document.querySelector<HTMLElement>('[data-court]')?.clientWidth ?? 400;
      const layer = document.createElement('div');
      Object.assign(layer.style, { position: 'fixed', left: '0', top: '0', width: `${courtW}px`, height: '0', zIndex: '70', pointerEvents: 'none', containerType: 'inline-size' });
      const ghost = el.cloneNode(true) as HTMLElement;
      Object.assign(ghost.style, { position: 'absolute', left: `${b.left}px`, top: `${b.top}px`, width: `${b.width}px`, height: `${b.height}px`, margin: '0' });
      ghost.removeAttribute('data-flip');
      layer.appendChild(ghost);
      document.body.appendChild(layer);
      el.style.opacity = '0';
      const k = Math.min(1.25, Math.max(0.75, a.width / b.width));
      const anim = ghost.animate(
        [
          { transform: `translate(${dx}px, ${dy}px) scale(${k})`, boxShadow: '0 0 0 0 transparent' },
          { transform: `translate(${dx * 0.45}px, ${dy * 0.45 - 18}px) scale(${(k + 1) / 2 + 0.06})`, offset: 0.5 },
          { transform: 'none' },
        ],
        { duration: 620, easing: 'cubic-bezier(.25,.8,.3,1)' },
      );
      anim.onfinish = anim.oncancel = () => {
        el.style.opacity = '';
        layer.remove();
      };
    });
  }, [dep]);
  return capture;
}

function ScoreBlock({ label, score, logo, onAdd }: { label: React.ReactNode; score: number; logo?: React.ReactNode; onAdd: (n: 1 | 2 | 3) => void }) {
  return (
    <div className="flex min-w-0 flex-col items-center gap-1">
      <div className="flex max-w-full items-center gap-2">
        {logo}
        <span className="max-w-[90px] truncate text-[11px] font-bold uppercase tracking-wider text-ink-muted [@media(max-width:820px)]:hidden">{label}</span>
        <span key={score} className="anim-bump inline-block font-display text-[34px] font-extrabold leading-none tabular [@media(min-height:600px)]:text-[44px]">
          {score}
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
  const [selRest, setSelRest] = useState<number[]>([]);
  const [menu, setMenu] = useState(false);
  const [isFs, setIsFs] = useState(() => !!document.fullscreenElement);
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
  const calledPlayers = useMemo(() => (live ? live.called.map((id) => byId.get(id)).filter(Boolean) as Player[] : []), [live, byId]);

  // Fine periodo: il cronometro si ferma a 00:00 all'istante esatto di scadenza
  useEffect(() => {
    if (live?.running && v && !v.running) {
      haptic.alarm();
      update((s) => settle(s, Date.now()));
      toast(`Fine ${periodLabel(live.period)}`, 'info', 3000);
    }
  }, [live?.running, v?.running]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!live || !v) return null;

  const rest = calledPlayers.filter((p) => !v.players[p.id!]?.onCourt).sort((a, b) => Number(a.number || 999) - Number(b.number || 999));
  const canConfirm = selOn.length > 0 && selOn.length === selRest.length;
  const anySel = selOn.length + selRest.length > 0;

  const tap = (id: number, onCourt: boolean) => {
    haptic.tap();
    const [sel, setSel] = onCourt ? [selOn, setSelOn] : [selRest, setSelRest];
    setSel(sel.includes(id) ? sel.filter((x) => x !== id) : [...sel, id]);
  };

  const confirmSub = () => {
    if (!canConfirm) return;
    haptic.confirm();
    capture();
    const n = selOn.length;
    update((s, t) => substitute(s, selOn, selRest, roles, t));
    setSelOn([]);
    setSelRest([]);
    toast(n === 1 ? 'Cambio effettuato' : `${n} cambi effettuati`, 'success', 1800);
  };

  const toggle = () => {
    haptic.heavy();
    update((s, t) => toggleClock(s, t));
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
        className="flex h-[92px] shrink-0 items-center gap-3 border-b border-white/5 bg-bar px-3 shadow-[0_10px_30px_-18px_rgba(0,0,0,.9)] [@media(min-height:600px)]:h-[112px] [@media(min-height:600px)]:px-5"
        style={{ paddingLeft: 'max(12px, env(safe-area-inset-left))', paddingRight: 'max(12px, env(safe-area-inset-right))' }}
      >
        {/* Periodo + cronometro + Start/Stop */}
        <div className="flex items-center gap-2.5">
          <div className="flex flex-col items-center">
            <span className={cx('rounded-full px-2.5 py-0.5 text-[14px] font-extrabold leading-tight tracking-wide', v.period >= 4 ? 'bg-warn/20 text-warn' : 'bg-white/10 text-ink')}>{periodLabel(v.period)}</span>
            <span
              className={cx(
                'mt-0.5 font-display text-[40px] font-extrabold leading-none tabular transition-colors [@media(min-height:600px)]:text-[54px]',
                over ? 'text-brand-text' : lastSecs ? 'text-warn' : !v.running && v.started ? 'text-ink-muted' : 'text-ink',
              )}
            >
              {mmss(v.remainingMs, 'ceil')}
            </span>
          </div>
          <button
            onClick={toggle}
            className={cx(
              'flex h-14 min-w-[84px] flex-col items-center justify-center rounded-2xl px-3 font-display text-[15px] font-bold leading-none transition active:scale-95 [@media(min-height:600px)]:h-16 [@media(min-height:600px)]:min-w-[104px]',
              v.running ? 'border border-white/15 bg-surface-3 text-ink' : over ? 'bg-brand text-on-brand shadow-brand' : 'bg-accent text-on-accent shadow-select',
            )}
          >
            {v.running ? <Pause size={22} /> : <Play size={22} fill="currentColor" />}
            <span className="mt-1">{startLabel}</span>
          </button>
        </div>

        {/* Punteggio */}
        <div className="flex min-w-0 flex-1 items-center justify-center gap-2 [@media(min-width:900px)]:gap-4">
          <ScoreBlock label={team?.name} score={v.us} logo={<TeamLogo team={team} size={28} />} onAdd={(n) => update((s, t) => addScore(s, 'us', n, t))} />
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
          <ScoreBlock label={v.opponent} score={v.them} logo={<span className="max-w-[86px] truncate text-[12px] font-bold uppercase text-ink-muted [@media(min-width:821px)]:hidden">{v.opponent}</span>} onAdd={(n) => update((s, t) => addScore(s, 'them', n, t))} />
        </div>

        {/* Menu + Termina */}
        <div className="flex items-center gap-1.5">
          <button onClick={() => setMenu(true)} aria-label="Menu partita" className="grid h-11 w-11 place-items-center rounded-xl text-ink-muted active:scale-90">
            <EllipsisVertical size={22} />
          </button>
          <Button variant="primary" className="h-12 px-3.5 text-[15px] leading-tight" icon={<Square size={16} fill="currentColor" />} onClick={terminate}>
            <span className="text-left">
              Termina
              <br className="[@media(min-width:900px)]:hidden" /> partita
            </span>
          </Button>
        </div>
      </header>

      {/* ---------- Corpo: REST a sinistra, campo a destra ---------- */}
      <div className="flex min-h-0 flex-1" style={{ containerType: 'size' } as CSSProperties}>
        <aside className="relative flex min-w-[230px] flex-1 flex-col border-r border-white/5" style={{ paddingLeft: 'env(safe-area-inset-left)' }}>
          <div className="flex items-center gap-2 px-3 pb-1.5 pt-2.5">
            <h2 className="font-display text-[19px] font-extrabold tracking-[0.18em]">REST</h2>
            <span className="rounded-full bg-white/10 px-2 text-[13px] font-bold">{rest.length}</span>
            <span className="flex-1" />
            {!v.started && <span className="text-[12px] font-semibold text-ink-muted">Premi Start per avviare i timer</span>}
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 pb-24">
            <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(196px, 1fr))' }}>
              {rest.map((p) => {
                const s = v.players[p.id!];
                return (
                  <RestCard
                    key={p.id}
                    p={p}
                    name={shortName(p, calledPlayers)}
                    playedMs={s.playedMs}
                    restMs={restMs(s, now)}
                    started={v.started}
                    int={intOf(v, p.id!)}
                    selected={selRest.includes(p.id!)}
                    onTap={() => tap(p.id!, false)}
                  />
                );
              })}
              {!rest.length && <div className="col-span-full rounded-2xl border border-dashed border-line p-4 text-center text-sm text-ink-muted">Nessun giocatore in REST</div>}
            </div>
          </div>

          {/* Barra del cambio */}
          <div className={cx('pointer-events-none absolute inset-x-0 bottom-0 px-3 pb-3 transition duration-300 ease-out', anySel ? 'translate-y-0 opacity-100' : 'translate-y-6 opacity-0')}>
            <div className="pointer-events-auto flex items-center gap-2 rounded-2xl border border-line bg-surface-2/95 p-2 shadow-card backdrop-blur">
              <button
                onClick={() => {
                  haptic.tap();
                  setSelOn([]);
                  setSelRest([]);
                }}
                aria-label="Annulla selezione"
                className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-white/5 text-ink-muted active:scale-90"
              >
                <X size={20} />
              </button>
              {canConfirm ? (
                <Button variant="accent" size="lg" className="h-12 flex-1 text-[16px]" icon={<ArrowLeftRight size={20} />} onClick={confirmSub}>
                  Conferma cambio {selOn.length > 1 ? `${selOn.length}-${selRest.length}` : ''}
                </Button>
              ) : (
                <div className="flex-1 px-1 text-[13px] font-semibold leading-snug text-ink-muted">
                  Esce: <b className="text-ink">{selOn.length}</b> · Entra: <b className="text-ink">{selRest.length}</b>
                  <span className="block text-[12px] font-medium">
                    {selOn.length > selRest.length ? `Seleziona ${selOn.length - selRest.length} dal REST` : `Seleziona ${selRest.length - selOn.length} in campo`}
                  </span>
                </div>
              )}
            </div>
          </div>
        </aside>

        <section className="flex-none p-2.5" style={{ width: `min(68cqw, calc((100cqh - 20px) * ${ASPECT} + 20px))`, paddingRight: 'max(10px, env(safe-area-inset-right))' }}>
          <div data-court className="relative w-full overflow-hidden rounded-[18px] shadow-[0_18px_50px_-18px_rgba(0,0,0,.9)] ring-1 ring-white/10" style={{ aspectRatio: `${ASPECT}`, containerType: 'inline-size' } as CSSProperties}>
            <Court team={team} />
            {v.slots.map((id, slot) => {
              const p = byId.get(id);
              const s = v.players[id];
              if (!p || !s) return null;
              const [x, y] = SLOTS_PCT[slot];
              return (
                <div key={id} className="absolute -translate-x-1/2 -translate-y-1/2" style={{ left: `${x}%`, top: `${y}%`, width: `${CARD_W * 100}%`, height: `${CARD_H * 100}%` }}>
                  <CourtCard p={p} name={shortName(p, calledPlayers)} playedMs={s.playedMs} int={intOf(v, id)} selected={selOn.includes(id)} onTap={() => tap(id, true)} />
                </div>
              );
            })}
          </div>
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
