import { memo, type CSSProperties } from 'react';
import { Clock3, Minus, TrendingDown, TrendingUp } from 'lucide-react';
import type { Player } from '@/db/types';
import { fmtInt, intLevel } from '@/engine/int';
import { Num } from '@/components/ui/Num';
import { cx } from '@/lib/cx';
import { mmss } from './liveModel';

// --- Scala funzionale INT 0–1: bianco → giallo → arancio → rosso (indipendente dal tema) ---
const INT_STOPS: [number, [number, number, number]][] = [
  [0, [255, 255, 255]],
  [0.35, [255, 214, 10]],
  [0.65, [255, 140, 26]],
  [1, [255, 46, 46]],
];
export const INT_GRADIENT = 'linear-gradient(90deg, #ffffff 0%, #ffd60a 35%, #ff8c1a 65%, #ff2e2e 100%)';
export const INT_HOT = 0.8;

export function intColor(v: number): string {
  const x = Math.min(1, Math.max(0, Number.isFinite(v) ? v : 0));
  for (let i = 1; i < INT_STOPS.length; i++) {
    const [b, cb] = INT_STOPS[i];
    const [a, ca] = INT_STOPS[i - 1];
    if (x <= b) {
      const t = (x - a) / (b - a);
      return `rgb(${ca.map((c, k) => Math.round(c + (cb[k] - c) * t)).join(',')})`;
    }
  }
  return 'rgb(255,46,46)';
}

/** Andamento dell'INT: sale (in gioco), cala piano (interruzione), recupera (panchina/intervallo), fermo. */
export type Trend = 'up' | 'slow' | 'down' | 'idle';

export function TrendIcon({ trend, size, color }: { trend: Trend; size: number | string; color?: string }) {
  if (trend === 'up') return <TrendingUp size={size} strokeWidth={3} style={{ color }} />;
  if (trend === 'down') return <TrendingDown size={size} strokeWidth={3} className="text-ok" />;
  if (trend === 'slow') return <TrendingDown size={size} strokeWidth={3} className="text-ink-muted" />;
  return <Minus size={size} strokeWidth={3} className="text-ink-faint" />;
}

/** Barra dritta a gradiente: il riempimento mostra i colori della scala fino al valore attuale. */
export function IntBar({ value, height = 8, style }: { value: number; height?: number | string; style?: CSSProperties }) {
  const v = Math.min(1, Math.max(0, value));
  const c = intColor(v);
  return (
    <div className="relative w-full overflow-hidden rounded-full bg-white/[.09] ring-1 ring-inset ring-white/5" style={{ height, ...style }}>
      {[35, 65, 80].map((x) => (
        <i key={x} className="absolute inset-y-0 z-10 w-px bg-black/35" style={{ left: `${x}%` }} />
      ))}
      <div
        className="relative h-full rounded-full transition-[width] duration-700 ease-out"
        style={{ width: `${v * 100}%`, backgroundImage: INT_GRADIENT, backgroundSize: `${v > 0.01 ? 100 / v : 10000}% 100%`, boxShadow: v > 0.05 ? `0 0 12px 0 ${c}` : undefined }}
      >
        <i className="absolute inset-x-0 top-0 h-1/2 rounded-full bg-white/25" />
      </div>
    </div>
  );
}

/** Legenda della scala INT. */
export function IntLegend({ className }: { className?: string }) {
  return (
    <div className={cx('w-full', className)}>
      <div className="h-1.5 rounded-full" style={{ backgroundImage: INT_GRADIENT }} />
      <div className="mt-0.5 flex justify-between text-[9.5px] font-bold uppercase tracking-wide text-ink-muted">
        <span>Fresco</span>
        <span>Attivo</span>
        <span>Affaticato</span>
        <span style={{ color: intColor(0.9) }}>Da cambiare</span>
      </div>
    </div>
  );
}

/** Nome breve: nome di battesimo, con iniziale del cognome se ci sono omonimi tra i convocati. */
export function shortName(p: Player, all: Player[]): string {
  const [first, ...rest] = p.name.trim().split(/\s+/);
  const dup = all.some((o) => o.id !== p.id && o.name.trim().split(/\s+/)[0] === first);
  return dup && rest.length ? `${first} ${rest[rest.length - 1][0]}.` : first || p.name;
}

function Photo({ p, className, style }: { p: Player; className?: string; style?: CSSProperties }) {
  const initials = p.name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join('');
  return (
    <div className={cx('grid shrink-0 place-items-center overflow-hidden rounded-full bg-gradient-to-br from-bar to-surface-3 font-display font-bold text-ink', className)} style={style}>
      {p.photo ? <img src={p.photo} alt="" className="h-full w-full object-cover" draggable={false} /> : <span>{initials || p.number}</span>}
    </div>
  );
}

interface CardProps {
  p: Player;
  name: string;
  playedMs: number;
  int: number;
  trend: Trend;
  selected: boolean;
  onTap: () => void;
}

const m = (k: number) => `calc(var(--m) * ${k})`;

/** Card in campo: dimensioni in metri di campo (--m = pixel per metro). */
export const CourtCard = memo(function CourtCard({ p, name, playedMs, int, trend, selected, onTap }: CardProps) {
  const v = Math.min(1, Math.max(0, int));
  const c = intColor(v);
  const hot = v >= INT_HOT;
  return (
    <button
      data-flip={p.id}
      onClick={onTap}
      aria-pressed={selected}
      className={cx(
        'relative flex h-full w-full flex-col items-center overflow-hidden border bg-gradient-to-b from-surface-2/95 to-surface/95 shadow-[0_10px_26px_-8px_rgba(0,0,0,.9)] backdrop-blur-[2px] transition-[box-shadow,border-color,transform] duration-200 active:scale-[.96]',
        selected ? 'border-accent shadow-glow' : hot ? 'card-hot border-transparent' : 'border-white/10',
      )}
      style={{ borderRadius: m(0.4), padding: `${m(0.13)} ${m(0.17)} ${m(0.16)}`, gap: m(0.045), '--glow': c } as CSSProperties}
    >
      {/* riflesso superiore */}
      <i className="pointer-events-none absolute inset-x-0 top-0 h-1/3 bg-gradient-to-b from-white/[.07] to-transparent" />
      <div className="relative shrink-0">
        <Photo p={p} className={cx('ring-2 shadow-[0_6px_16px_-6px_rgba(0,0,0,.9)]', selected ? 'ring-accent' : 'ring-white/20')} style={{ width: m(2.0), height: m(2.0), fontSize: m(0.72) }} />
        <span
          className="absolute grid place-items-center rounded-full bg-brand font-display font-extrabold leading-none text-on-brand shadow ring-2 ring-surface"
          style={{ fontSize: `max(11px, ${m(0.46)})`, minWidth: m(0.8), height: m(0.8), padding: `0 ${m(0.1)}`, right: m(-0.26), bottom: m(-0.06) }}
        >
          {p.number || '–'}
        </span>
      </div>
      <b className="w-full shrink-0 truncate text-center leading-[1.15]" style={{ fontSize: `max(10px, ${m(0.4)})` }}>
        {name}
      </b>
      {/* Minuti giocati */}
      <div className="flex w-full shrink-0 items-center justify-center bg-black/55 text-white ring-1 ring-white/15" style={{ padding: `${m(0.09)} 0 ${m(0.02)}`, gap: m(0.1), borderRadius: m(0.2) }} title="Minuti giocati">
        <Clock3 strokeWidth={3} className="shrink-0 text-ink-muted" style={{ width: `max(11px, ${m(0.42)})`, height: `max(11px, ${m(0.42)})`, marginTop: m(-0.06) }} />
        <Num value={mmss(playedMs)} style={{ fontSize: `max(15px, ${m(0.74)})` }} />
      </div>
      {/* INT: numero grande + barra dritta */}
      <div className="flex w-full shrink-0 items-end justify-between" style={{ marginTop: m(0.03) }} title={`INT ${fmtInt(v)} · ${intLevel(v)}`}>
        <span className="flex items-center font-bold uppercase tracking-wider text-ink-muted" style={{ fontSize: `max(9px, ${m(0.3)})`, gap: m(0.04), paddingBottom: m(0.1) }}>
          INT
          <TrendIcon trend={trend} size="1.3em" color={c} />
        </span>
        <Num value={fmtInt(v)} style={{ fontSize: `max(17px, ${m(0.86)})`, color: c, textShadow: v > 0.3 ? `0 0 14px ${c}` : undefined }} />
      </div>
      <IntBar value={v} height={`max(5px, ${m(0.2)})`} style={{ flexShrink: 0 }} />
    </button>
  );
});

function Stat({ label, value, tone }: { label: string; value: string; tone: 'ink' | 'accent' | 'faint' }) {
  return (
    <div className="min-w-0 flex-1 rounded-lg bg-black/40 px-1.5 pb-0.5 pt-1 ring-1 ring-white/10">
      <div className="truncate text-[9px] font-bold uppercase leading-none text-ink-muted">{label}</div>
      <Num value={value} className={cx('mt-0.5 text-[20px]', tone === 'accent' ? 'text-accent-light' : tone === 'faint' ? 'text-ink-faint' : 'text-white')} />
    </div>
  );
}

/** Scheda in panchina (griglia a 2 colonne): minuti, tempo in panchina e INT ben leggibili. */
export const BenchCard = memo(function BenchCard({ p, name, playedMs, int, trend, selected, onTap, restMs, started }: CardProps & { restMs: number; started: boolean }) {
  const v = Math.min(1, Math.max(0, int));
  const c = intColor(v);
  return (
    <button
      data-flip={p.id}
      onClick={onTap}
      aria-pressed={selected}
      className={cx(
        'relative flex w-full min-w-0 flex-col gap-1.5 overflow-hidden rounded-2xl border bg-gradient-to-b from-surface-2 to-surface p-2 text-left transition-[box-shadow,border-color,transform] duration-200 active:scale-[.96]',
        selected ? 'border-accent shadow-glow' : 'border-line',
      )}
    >
      <div className="flex min-w-0 items-center gap-2">
        <div className="relative shrink-0">
          <Photo p={p} className={cx('h-12 w-12 text-base ring-2', selected ? 'ring-accent' : 'ring-white/15')} />
          <span className="absolute -bottom-1 -right-1.5 grid h-[22px] min-w-[22px] place-items-center rounded-full bg-brand px-1 font-display text-[13px] font-extrabold leading-none text-on-brand ring-2 ring-surface">
            {p.number || '–'}
          </span>
        </div>
        <div className="min-w-0 flex-1">
          <b className="block truncate text-[15px] leading-tight">{name}</b>
          <span className="mt-0.5 inline-block rounded px-1 text-[10px] font-extrabold uppercase tracking-wide" style={{ color: started ? c : undefined, background: started ? `${c.replace('rgb', 'rgba').replace(')', ',.14)')}` : undefined }}>
            {started ? intLevel(v) : 'In attesa'}
          </span>
        </div>
      </div>
      <div className="flex gap-1">
        <Stat label="Minuti" value={mmss(playedMs)} tone="ink" />
        <Stat label="Panchina" value={mmss(restMs)} tone={started ? 'accent' : 'faint'} />
      </div>
      <div className="flex items-end justify-between px-0.5">
        <span className="flex items-center gap-1 pb-1 text-[10px] font-bold uppercase tracking-wider text-ink-muted">
          INT <TrendIcon trend={trend} size={13} color={c} />
        </span>
        <Num value={fmtInt(v)} className="text-[26px]" style={{ color: c, textShadow: v > 0.3 ? `0 0 12px ${c}` : undefined }} />
      </div>
      <IntBar value={v} height={7} />
    </button>
  );
});
