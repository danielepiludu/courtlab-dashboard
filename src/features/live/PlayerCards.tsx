import { memo, type CSSProperties, type ReactNode } from 'react';
import { Clock3, Minus, TrendingDown, TrendingUp } from 'lucide-react';
import type { Player } from '@/db/types';
import { fmtInt, intLevel } from '@/engine/int';
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

/** Andamento dell'INT: sale (in campo, in gioco), cala piano (in campo, tempo fermo), recupera (panchina). */
export type Trend = 'up' | 'slow' | 'down' | 'idle';

export function TrendIcon({ trend, size, color }: { trend: Trend; size: number | string; color?: string }) {
  if (trend === 'up') return <TrendingUp size={size} strokeWidth={3} style={{ color }} />;
  if (trend === 'down') return <TrendingDown size={size} strokeWidth={3} className="text-ok" />;
  if (trend === 'slow') return <TrendingDown size={size} strokeWidth={3} className="text-ink-muted" />;
  return <Minus size={size} strokeWidth={3} className="text-ink-faint" />;
}

/** Barra INT a gradiente: il riempimento mostra i colori della scala fino al valore attuale. */
export function IntBar({ value, trend = 'idle', style, label = true }: { value: number; trend?: Trend; style?: CSSProperties; label?: boolean }) {
  const v = Math.min(1, Math.max(0, value));
  const c = intColor(v);
  return (
    <div className="w-full" style={style}>
      {label && (
        <div className="mb-1 flex items-center gap-1 text-[11px] font-bold leading-none">
          <span className="tracking-widest text-ink-muted">INT</span>
          <TrendIcon trend={trend} size={12} color={c} />
          <span className="flex-1" />
          <span className="font-display text-[15px] font-extrabold tabular" style={{ color: c, textShadow: v > 0.6 ? `0 0 10px ${c}` : undefined }}>
            {fmtInt(v)}
          </span>
        </div>
      )}
      <div className="relative h-2 overflow-hidden rounded-full bg-white/[.08]">
        {/* tacche delle soglie */}
        {[35, 65, 80].map((x) => (
          <i key={x} className="absolute inset-y-0 w-px bg-white/15" style={{ left: `${x}%` }} />
        ))}
        <div
          className="relative h-full rounded-full transition-[width] duration-700 ease-out"
          style={{
            width: `${v * 100}%`,
            backgroundImage: INT_GRADIENT,
            backgroundSize: `${v > 0.01 ? 100 / v : 10000}% 100%`,
            boxShadow: v > 0.05 ? `0 0 10px -1px ${c}` : undefined,
          }}
        />
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

const CIRC = 2 * Math.PI * 45;

/** Foto con l'anello della fatica: si riempie e cambia colore (bianco → giallo → arancio → rosso) con l'INT. */
function FatigueRing({ p, value, size, children, photoFont }: { p: Player; value: number; size: string; children?: ReactNode; photoFont?: string }) {
  const v = Math.min(1, Math.max(0, value));
  const c = intColor(v);
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg viewBox="0 0 100 100" className={cx('absolute inset-0 h-full w-full -rotate-90 overflow-visible', v >= 0.8 && 'int-hot')} style={{ '--glow': c } as CSSProperties}>
        <circle cx="50" cy="50" r="45" fill="none" stroke="rgba(255,255,255,.12)" strokeWidth="8" />
        {v > 0.005 && (
        <circle
          cx="50"
          cy="50"
          r="45"
          fill="none"
          stroke={c}
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={`${Math.max(0.001, v * CIRC)} ${CIRC}`}
          style={{ transition: 'stroke-dasharray .7s ease-out, stroke .7s ease-out' }}
        />
        )}
      </svg>
      <Photo p={p} className="absolute inset-[11%]" style={{ fontSize: photoFont }} />
      {children}
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

/** Card in campo: dimensioni in metri di campo (--m = pixel per metro), la foto è l'elemento principale. */
export const CourtCard = memo(function CourtCard({ p, name, playedMs, int, trend, selected, onTap }: CardProps) {
  const v = Math.min(1, Math.max(0, int));
  const c = intColor(v);
  return (
    <button
      data-flip={p.id}
      onClick={onTap}
      aria-pressed={selected}
      className={cx(
        'flex h-full w-full flex-col items-center justify-between overflow-hidden border bg-surface/90 shadow-[0_8px_22px_-8px_rgba(0,0,0,.85)] backdrop-blur-[2px] transition-[box-shadow,border-color,transform] duration-200 active:scale-[.96]',
        selected ? 'border-accent shadow-glow' : 'border-white/10',
      )}
      style={{ borderRadius: m(0.38), padding: `${m(0.14)} ${m(0.18)} ${m(0.18)}`, gap: m(0.05) }}
    >
      <FatigueRing p={p} value={v} size={m(2.5)} photoFont={m(0.72)}>
        {/* INT */}
        <span
          className="absolute flex items-center rounded-full bg-black/75 font-display font-extrabold leading-none ring-1 tabular"
          style={{ fontSize: `max(10.5px, ${m(0.4)})`, padding: `${m(0.05)} ${m(0.1)}`, gap: m(0.03), left: m(-0.3), top: m(-0.04), color: c, boxShadow: `0 0 0 1px ${c}55` }}
          title={`INT ${fmtInt(v)} · ${intLevel(v)}`}
        >
          <TrendIcon trend={trend} size="0.85em" color={c} />
          {fmtInt(v)}
        </span>
        {/* numero di maglia */}
        <span
          className="absolute grid place-items-center rounded-full bg-brand font-display font-extrabold leading-[1.35] text-on-brand shadow"
          style={{ fontSize: `max(11px, ${m(0.44)})`, minWidth: m(0.78), padding: `0 ${m(0.1)}`, right: m(-0.22), bottom: m(0.02) }}
        >
          {p.number || '–'}
        </span>
      </FatigueRing>
      <b className="w-full truncate text-center leading-[1.1]" style={{ fontSize: `max(10.5px, ${m(0.4)})` }}>
        {name}
      </b>
      {/* Minuti giocati: in evidenza */}
      <div
        className="flex w-full items-center justify-center bg-black/55 font-display font-extrabold leading-none text-white ring-1 ring-white/15 tabular"
        style={{ fontSize: `max(16px, ${m(0.74)})`, padding: `${m(0.07)} 0`, gap: m(0.1), borderRadius: m(0.2) }}
        title="Minuti giocati"
      >
        <Clock3 size="0.62em" strokeWidth={3} className="shrink-0 text-ink-muted" />
        {mmss(playedMs)}
      </div>
    </button>
  );
});

function Stat({ label, value, tone }: { label: string; value: string; tone: 'ink' | 'accent' | 'faint' }) {
  return (
    <div className="min-w-0 flex-1 rounded-lg bg-black/40 px-1.5 pb-1 pt-0.5 ring-1 ring-white/10">
      <div className="truncate text-[9px] font-bold uppercase text-ink-muted">{label}</div>
      <div className={cx('font-display text-[19px] font-extrabold leading-none tabular', tone === 'accent' ? 'text-accent-light' : tone === 'faint' ? 'text-ink-faint' : 'text-white')}>{value}</div>
    </div>
  );
}

/** Scheda in panchina (griglia a 2 colonne): minuti, tempo in panchina e INT ben leggibili. */
export const BenchCard = memo(function BenchCard({ p, name, playedMs, int, trend, selected, onTap, restMs, started }: CardProps & { restMs: number; started: boolean }) {
  const v = Math.min(1, Math.max(0, int));
  return (
    <button
      data-flip={p.id}
      onClick={onTap}
      aria-pressed={selected}
      className={cx(
        'flex w-full min-w-0 flex-col gap-1.5 rounded-2xl border bg-surface p-2 text-left transition-[box-shadow,border-color,transform] duration-200 active:scale-[.96]',
        selected ? 'border-accent bg-accent/10 shadow-glow' : 'border-line',
      )}
    >
      <div className="flex min-w-0 items-center gap-2">
        <FatigueRing p={p} value={v} size="50px" photoFont="15px">
          <span className="absolute -bottom-1 -right-1.5 grid min-w-[22px] place-items-center rounded-full bg-brand px-1 font-display text-[12px] font-extrabold leading-[1.4] text-on-brand">{p.number || '–'}</span>
        </FatigueRing>
        <div className="min-w-0 flex-1">
          <b className="block truncate text-[15px] leading-tight">{name}</b>
          <span className="block truncate text-[11px] font-bold uppercase tracking-wide" style={{ color: intColor(v) }}>
            {started ? intLevel(v) : '—'}
          </span>
        </div>
      </div>
      <div className="flex gap-1">
        <Stat label="Minuti" value={mmss(playedMs)} tone="ink" />
        <Stat label="Panchina" value={mmss(restMs)} tone={started ? 'accent' : 'faint'} />
      </div>
      <IntBar value={v} trend={trend} />
    </button>
  );
});
