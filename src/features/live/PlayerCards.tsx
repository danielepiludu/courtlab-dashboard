import { memo, type CSSProperties } from 'react';
import { Timer } from 'lucide-react';
import type { Player } from '@/db/types';
import { cx } from '@/lib/cx';
import { mmss } from './liveModel';

// --- Scala funzionale INT: verde → giallo → arancio → rosso (indipendente dal tema) ---
const INT_STOPS: [number, [number, number, number]][] = [
  [0, [43, 182, 115]],
  [40, [245, 211, 35]],
  [70, [245, 135, 31]],
  [100, [229, 56, 59]],
];
export function intColor(v: number): string {
  const x = Math.min(100, Math.max(0, v));
  for (let i = 1; i < INT_STOPS.length; i++) {
    const [b, cb] = INT_STOPS[i];
    const [a, ca] = INT_STOPS[i - 1];
    if (x <= b) {
      const t = (x - a) / (b - a);
      return `rgb(${ca.map((c, k) => Math.round(c + (cb[k] - c) * t)).join(',')})`;
    }
  }
  return 'rgb(229,56,59)';
}

export function IntBar({ value, style }: { value: number; style?: CSSProperties }) {
  const v = Math.round(Math.min(100, Math.max(0, value)));
  return (
    <div className="w-full" style={style}>
      <div className="mb-1 flex items-baseline justify-between text-[11px] font-bold leading-none">
        <span className="tracking-widest text-ink-muted">INT</span>
        <span className="tabular" style={{ color: intColor(v) }}>
          {v}
        </span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
        <div className="h-full rounded-full transition-[width,background-color] duration-700 ease-out" style={{ width: `${v}%`, background: intColor(v) }} />
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
  selected: boolean;
  onTap: () => void;
}

const m = (k: number) => `calc(var(--m) * ${k})`;

/** Card in campo: dimensioni in metri di campo (--m = pixel per metro), la foto è l'elemento principale. */
export const CourtCard = memo(function CourtCard({ p, name, playedMs, int, selected, onTap }: CardProps) {
  return (
    <button
      data-flip={p.id}
      onClick={onTap}
      aria-pressed={selected}
      className={cx(
        'flex h-full w-full flex-col items-center justify-between overflow-hidden border bg-surface/90 shadow-[0_8px_22px_-8px_rgba(0,0,0,.85)] backdrop-blur-[2px] transition-[box-shadow,border-color,transform] duration-200 active:scale-[.96]',
        selected ? 'border-accent shadow-glow' : 'border-white/10',
      )}
      style={{ borderRadius: m(0.38), padding: `${m(0.18)} ${m(0.2)} ${m(0.2)}` }}
    >
      <div className="relative">
        <Photo p={p} className={cx('ring-2', selected ? 'ring-accent' : 'ring-white/15')} style={{ width: m(2.25), height: m(2.25), fontSize: m(0.8) }} />
        <span
          className="absolute grid place-items-center rounded-full bg-brand font-display font-extrabold leading-[1.35] text-on-brand shadow"
          style={{ fontSize: `max(11px, ${m(0.46)})`, minWidth: m(0.8), padding: `0 ${m(0.1)}`, right: m(-0.18), bottom: m(-0.08) }}
        >
          {p.number || '–'}
        </span>
      </div>
      <b className="w-full truncate text-center leading-[1.15]" style={{ fontSize: `max(10.5px, ${m(0.42)})` }}>
        {name}
      </b>
      <div className="flex w-full items-baseline justify-between leading-none" style={{ padding: `0 ${m(0.06)}` }}>
        <span className="font-display font-bold tabular" style={{ fontSize: `max(12.5px, ${m(0.56)})` }}>
          {mmss(playedMs)}
        </span>
        <span className="font-display font-bold tabular" style={{ fontSize: `max(11px, ${m(0.44)})`, color: intColor(int) }} title="INT">
          {Math.round(int)}
        </span>
      </div>
      <div className="w-full overflow-hidden rounded-full bg-white/10" style={{ height: `max(4px, ${m(0.14)})` }}>
        <div className="h-full rounded-full transition-[width,background-color] duration-700 ease-out" style={{ width: `${Math.min(100, Math.max(0, int))}%`, background: intColor(int) }} />
      </div>
    </button>
  );
});

/** Scheda in panchina (griglia a 2 colonne): mostra anche il tempo reale di riposo. */
export const BenchCard = memo(function BenchCard({ p, name, playedMs, int, selected, onTap, restMs, started }: CardProps & { restMs: number; started: boolean }) {
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
        <div className="relative shrink-0">
          <Photo p={p} className={cx('h-11 w-11 text-base ring-2 [@media(min-height:600px)]:h-14 [@media(min-height:600px)]:w-14', selected ? 'ring-accent' : 'ring-white/10')} />
          <span className="absolute -bottom-1 -right-1.5 grid min-w-[22px] place-items-center rounded-full bg-brand px-1 font-display text-[12px] font-extrabold leading-[1.4] text-on-brand">{p.number || '–'}</span>
        </div>
        <div className="min-w-0 flex-1">
          <b className="block truncate text-[14px] leading-tight">{name}</b>
          <div className="font-display text-[15px] font-bold leading-tight tabular">
            <span className="mr-1 font-sans text-[10px] font-bold tracking-wider text-ink-muted">MIN</span>
            {mmss(playedMs)}
          </div>
          <div className={cx('flex items-center gap-1 font-display text-[14px] font-bold leading-tight tabular', started ? 'text-accent-light' : 'text-ink-faint')} title="Tempo reale in panchina">
            <Timer size={12} strokeWidth={2.5} />
            {mmss(restMs)}
          </div>
        </div>
      </div>
      <IntBar value={int} />
    </button>
  );
});
