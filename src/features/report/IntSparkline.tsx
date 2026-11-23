import { useId } from 'react';
import type { SeriesPoint } from './reportModel';

export interface PeriodSpan {
  label: string;
  from: number;
  to: number;
}

/**
 * Andamento dell'INT nel tempo: linea e area con i colori della scala (bianco → rosso),
 * fasce azzurre dove il giocatore era in campo, quarti delineati (fasce alternate, separatori,
 * pause tra i quarti in grigio) con le etichette Q1, Q2… sopra.
 */
export function IntSparkline({
  series,
  durationMs,
  marks = [],
  spans = [],
  height = 44,
  showLabels = true,
  className,
}: {
  series: SeriesPoint[];
  durationMs: number;
  marks?: { t: number; label: string }[];
  spans?: PeriodSpan[];
  height?: number;
  showLabels?: boolean;
  className?: string;
}) {
  const id = useId().replace(/:/g, '');
  const W = 300;
  const H = height;
  const pad = 3;
  const dur = Math.max(1, durationMs);
  const x = (t: number) => (Math.min(Math.max(t, 0), dur) / dur) * W;
  const pct = (t: number) => (Math.min(Math.max(t, 0), dur) / dur) * 100;
  const y = (v: number) => pad + (1 - v) * (H - pad * 2);
  // senza le durate dei quarti (resoconti vecchi) si usano gli inizi
  const periods: PeriodSpan[] = spans.length ? spans : marks.map((m, i) => ({ label: m.label, from: m.t, to: marks[i + 1]?.t ?? dur }));

  const labels =
    showLabels && periods.length ? (
      <div className="relative mb-1 h-[14px]" aria-hidden>
        {periods.map((p) => (
          <span key={p.label + p.from} className="absolute top-0 flex justify-center" style={{ left: `${pct(p.from)}%`, width: `${Math.max(0, pct(p.to) - pct(p.from))}%` }}>
            <span className="rounded bg-white/10 px-1.5 font-sans text-[11px] font-bold leading-[14px] tracking-wide text-ink">{p.label}</span>
          </span>
        ))}
      </div>
    ) : null;

  if (series.length < 2) {
    return (
      <div className={className}>
        {labels}
        <div style={{ height }} className="grid place-items-center rounded-lg bg-white/[.04] text-[11px] font-semibold text-ink-faint">
          nessun dato
        </div>
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
  // pause tra un quarto e l'altro
  const pauses = periods.slice(0, -1).map((p, i) => [p.to, periods[i + 1].from] as const).filter(([a, b]) => b - a > 1000);

  return (
    <div className={className}>
      {labels}
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ height, width: '100%' }} className="block" role="img" aria-label={`Andamento INT${periods.length ? ` per ${periods.map((p) => p.label).join(', ')}` : ''}`}>
        <defs>
          <linearGradient id={`g${id}`} gradientUnits="userSpaceOnUse" x1="0" y1={y(0)} x2="0" y2={y(1)}>
            <stop offset="0" stopColor="#ffffff" />
            <stop offset="0.35" stopColor="#ffd60a" />
            <stop offset="0.65" stopColor="#ff8c1a" />
            <stop offset="1" stopColor="#ff2e2e" />
          </linearGradient>
          <pattern id={`p${id}`} patternUnits="userSpaceOnUse" width="4" height="4" patternTransform="rotate(45)">
            <rect width="1.2" height="4" fill="rgba(255,255,255,.10)" />
          </pattern>
        </defs>
        <rect x="0" y="0" width={W} height={H} rx="6" fill="rgba(255,255,255,.03)" />
        {/* quarti alterni leggermente più chiari */}
        {periods.map((p, i) =>
          i % 2 === 0 ? <rect key={`q${p.from}`} x={x(p.from)} y="0" width={Math.max(0, x(p.to) - x(p.from))} height={H} fill="rgba(255,255,255,.05)" /> : null,
        )}
        {/* pause tra i quarti */}
        {pauses.map(([a, b]) => (
          <g key={`pz${a}`}>
            <rect x={x(a)} y="0" width={Math.max(0.5, x(b) - x(a))} height={H} fill="rgba(0,0,0,.35)" />
            <rect x={x(a)} y="0" width={Math.max(0.5, x(b) - x(a))} height={H} fill={`url(#p${id})`} />
          </g>
        ))}
        {bands.map(([a, b], i) => (
          <rect key={i} x={x(a)} y="0" width={Math.max(1, x(b) - x(a))} height={H} fill="var(--c-select)" opacity="0.16" />
        ))}
        {[0.35, 0.65, 0.8].map((v) => (
          <line key={v} x1="0" x2={W} y1={y(v)} y2={y(v)} stroke="rgba(255,255,255,.07)" strokeWidth="1" vectorEffect="non-scaling-stroke" />
        ))}
        {/* separatori dei quarti */}
        {periods.slice(1).map((p) => (
          <line key={`s${p.from}`} x1={x(p.from)} x2={x(p.from)} y1="0" y2={H} stroke="rgba(255,255,255,.38)" strokeWidth="1.2" vectorEffect="non-scaling-stroke" />
        ))}
        <path d={area} fill={`url(#g${id})`} opacity="0.22" />
        <path d={line} fill="none" stroke={`url(#g${id})`} strokeWidth="2.2" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
      </svg>
    </div>
  );
}
