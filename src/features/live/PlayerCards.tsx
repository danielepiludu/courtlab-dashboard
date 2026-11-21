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

export function IntBar({ value, compact, style }: { value: number; compact?: boolean; style?: CSSProperties }) {
  const v = Math.round(Math.min(100, Math.max(0, value)));
  return (
    <div className="w-full" style={style}>
      <div className={cx('flex items-baseline justify-between font-bold leading-none', compact ? 'mb-[0.4cqw] text-[max(9px,1.6cqw)]' : 'mb-1 text-[11px]')}>
        <span className="tracking-widest text-ink-muted">INT</span>
        <span className="tabular" style={{ color: intColor(v) }}>
          {v}
        </span>
      </div>
      <div className={cx('overflow-hidden rounded-full bg-white/10', compact ? 'h-[max(4px,0.8cqw)]' : 'h-1.5')}>
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

/** Card in campo: dimensioni in cqw (relative alla larghezza del campo), la foto è l'elemento principale. */
export const CourtCard = memo(function CourtCard({ p, name, playedMs, int, selected, onTap }: CardProps) {
  return (
    <button
      data-flip={p.id}
      onClick={onTap}
      aria-pressed={selected}
      className={cx(
        'flex h-full w-full flex-col items-center justify-between overflow-hidden rounded-[1.8cqw] border bg-surface/90 px-[1.1cqw] pb-[1cqw] pt-[1cqw] shadow-[0_8px_22px_-8px_rgba(0,0,0,.85)] backdrop-blur-[2px] transition-[box-shadow,border-color,transform] duration-200 active:scale-[.96]',
        selected ? 'border-accent shadow-glow' : 'border-white/10',
      )}
    >
      <div className="relative">
        <Photo p={p} className={cx('ring-[0.35cqw]', selected ? 'ring-accent' : 'ring-white/15')} style={{ width: '14cqw', height: '14cqw', fontSize: '5cqw' }} />
        <span className="absolute -bottom-[0.6cqw] -right-[1cqw] grid min-w-[4.6cqw] place-items-center rounded-full bg-brand px-[0.6cqw] font-display font-extrabold leading-[1.35] text-on-brand shadow" style={{ fontSize: 'max(11px, 2.5cqw)' }}>
          {p.number || '–'}
        </span>
      </div>
      <b className="w-full truncate text-center leading-[1.15]" style={{ fontSize: 'max(10.5px, 2.3cqw)' }}>
        {name}
      </b>
      <div className="flex w-full items-baseline justify-between px-[0.4cqw] leading-none">
        <span className="font-display font-bold tabular" style={{ fontSize: 'max(12.5px, 3.1cqw)' }}>
          {mmss(playedMs)}
        </span>
        <span className="font-display font-bold tabular" style={{ fontSize: 'max(11px, 2.4cqw)', color: intColor(int) }} title="INT">
          {Math.round(int)}
        </span>
      </div>
      <div className="h-[max(4px,0.8cqw)] w-full overflow-hidden rounded-full bg-white/10">
        <div className="h-full rounded-full transition-[width,background-color] duration-700 ease-out" style={{ width: `${Math.min(100, Math.max(0, int))}%`, background: intColor(int) }} />
      </div>
    </button>
  );
});

/** Card nella colonna REST: mostra anche il tempo reale di riposo. */
export const RestCard = memo(function RestCard({ p, name, playedMs, int, selected, onTap, restMs, started }: CardProps & { restMs: number; started: boolean }) {
  return (
    <button
      data-flip={p.id}
      onClick={onTap}
      aria-pressed={selected}
      className={cx(
        'flex w-full items-center gap-3 rounded-2xl border bg-surface p-2.5 text-left transition-[box-shadow,border-color,transform] duration-200 active:scale-[.97]',
        selected ? 'border-accent bg-accent/10 shadow-glow' : 'border-line',
      )}
    >
      <div className="relative">
        <Photo p={p} className={cx('h-14 w-14 text-xl ring-2 [@media(min-height:600px)]:h-16 [@media(min-height:600px)]:w-16', selected ? 'ring-accent' : 'ring-white/10')} />
        <span className="absolute -bottom-1 -right-1.5 grid min-w-[24px] place-items-center rounded-full bg-brand px-1 font-display text-[13px] font-extrabold leading-[1.4] text-on-brand">{p.number || '–'}</span>
      </div>
      <div className="min-w-0 flex-1">
        <b className="block truncate text-[15px] leading-tight">{name}</b>
        <div className="mt-1 flex items-center justify-between gap-2 text-[12px] font-semibold text-ink-muted">
          <span>
            MIN <b className="font-display text-[15px] text-ink tabular">{mmss(playedMs)}</b>
          </span>
          <span className={cx('flex items-center gap-1', started ? 'text-accent-light' : 'text-ink-faint')} title="Tempo reale di riposo">
            <Timer size={13} />
            <b className="font-display text-[15px] tabular">{mmss(restMs)}</b>
          </span>
        </div>
        <IntBar value={int} style={{ marginTop: 5 }} />
      </div>
    </button>
  );
});
