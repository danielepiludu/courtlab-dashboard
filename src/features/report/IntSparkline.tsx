import { useId } from 'react';
import type { SeriesPoint } from './reportModel';

/**
 * Andamento dell'INT nel tempo: linea e area con i colori della scala (bianco → rosso),
 * fasce azzurre dove il giocatore era in campo, linee tratteggiate all'inizio di ogni periodo.
 */
export function IntSparkline({ series, durationMs, marks = [], height = 44, className }: { series: SeriesPoint[]; durationMs: number; marks?: { t: number; label: string }[]; height?: number; className?: string }) {
  const id = useId().replace(/:/g, '');
  const W = 300;
  const H = height;
  const pad = 3;
  const dur = Math.max(1, durationMs);
  const x = (t: number) => (t / dur) * W;
  const y = (v: number) => pad + (1 - v) * (H - pad * 2);
  if (series.length < 2) {
    return (
      <div className={className} style={{ height }}>
        <div className="grid h-full place-items-center rounded-lg bg-white/[.04] text-[11px] font-semibold text-ink-faint">nessun dato</div>
      </div>
    );
  }
  const line = series.map((p, i) => `${i ? 'L' : 'M'}${x(p.t).toFixed(1)} ${y(p.v).toFixed(1)}`).join(' ');
  const area = `${line} L${x(series[series.length - 1].t).toFixed(1)} ${H} L${x(series[0].t).toFixed(1)} ${H} Z`;
  // fasce "in campo"
  const bands: [number, number][] = [];
  for (let i = 0; i < series.length; i++) {
    if (!series[i].on) continue;
    const a = series[i].t;
    const b = series[i + 1]?.t ?? a;
    const last = bands[bands.length - 1];
    if (last && Math.abs(last[1] - a) < 1) last[1] = b;
    else bands.push([a, b]);
  }
  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className={className} style={{ height, width: '100%' }} role="img" aria-label="Andamento INT">
      <defs>
        <linearGradient id={`g${id}`} gradientUnits="userSpaceOnUse" x1="0" y1={y(0)} x2="0" y2={y(1)}>
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="0.35" stopColor="#ffd60a" />
          <stop offset="0.65" stopColor="#ff8c1a" />
          <stop offset="1" stopColor="#ff2e2e" />
        </linearGradient>
      </defs>
      <rect x="0" y="0" width={W} height={H} rx="6" fill="rgba(255,255,255,.04)" />
      {bands.map(([a, b], i) => (
        <rect key={i} x={x(a)} y="0" width={Math.max(1, x(b) - x(a))} height={H} fill="var(--c-select)" opacity="0.16" />
      ))}
      {[0.35, 0.65, 0.8].map((v) => (
        <line key={v} x1="0" x2={W} y1={y(v)} y2={y(v)} stroke="rgba(255,255,255,.08)" strokeWidth="1" vectorEffect="non-scaling-stroke" />
      ))}
      {marks.slice(1).map((m) => (
        <line key={m.t} x1={x(m.t)} x2={x(m.t)} y1="0" y2={H} stroke="rgba(255,255,255,.22)" strokeWidth="1" strokeDasharray="3 3" vectorEffect="non-scaling-stroke" />
      ))}
      <path d={area} fill={`url(#g${id})`} opacity="0.22" />
      <path d={line} fill="none" stroke={`url(#g${id})`} strokeWidth="2.2" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}
