import { useLayoutEffect, useRef } from 'react';
import type { AthleteDay } from '@/engine/load';
import { LOAD_CONFIG } from '@/engine/load';

const C = {
  bar: '#3b82f6',
  personal: '#ffe08a',
  team: '#ff4d4f',
  wl: '#ffb020',
  upper: '#ff3b30',
  lower: '#2bb673',
};

/**
 * Grafico del carico come nel foglio: barre TL (asse sinistro), Media Personale, Media Squadra,
 * Work Load (asse destro 0–2,5) con i limiti 1,3 e 0,8. Scorre in orizzontale se le date sono tante.
 */
export function LoadChart({ data, height = 280 }: { data: AthleteDay[]; height?: number }) {
  const n = data.length;
  const scroller = useRef<HTMLDivElement>(null);
  // parte dalle date più recenti
  useLayoutEffect(() => {
    const el = scroller.current;
    if (el) el.scrollLeft = el.scrollWidth;
  }, [data]);
  if (!n) return <div className="grid h-40 place-items-center rounded-2xl border border-dashed border-line text-sm text-ink-muted">Nessun dato</div>;
  const step = 26;
  const padL = 40;
  const padR = 34;
  const padT = 12;
  const padB = 46;
  const W = padL + padR + n * step;
  const H = height;
  const ih = H - padT - padB;
  const maxL = Math.max(100, ...data.flatMap((d) => [d.tl ?? 0, d.rolAvg ?? 0, d.teamRol ?? 0]));
  const top = Math.ceil((maxL * 1.1) / 100) * 100;
  const maxR = 2.5;
  const x = (i: number) => padL + i * step + step / 2;
  const yL = (v: number) => padT + ih - (v / top) * ih;
  const yR = (v: number) => padT + ih - (Math.min(v, maxR) / maxR) * ih;
  const line = (vals: (number | null)[], y: (v: number) => number) => {
    let d = '';
    let pen = false;
    vals.forEach((v, i) => {
      if (v == null) {
        pen = false;
        return;
      }
      d += `${pen ? 'L' : 'M'}${x(i).toFixed(1)} ${y(v).toFixed(1)} `;
      pen = true;
    });
    return d;
  };
  const ticksL = Array.from({ length: 6 }, (_, i) => (top / 5) * i);
  const ticksR = [0, 0.5, 1, 1.5, 2, 2.5];
  const label = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
  return (
    <div>
      <div className="mb-2 flex flex-wrap gap-x-4 gap-y-1 px-1 text-[11.5px] font-semibold text-ink-muted">
        <span className="flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-sm" style={{ background: C.bar }} />TL</span>
        <span className="flex items-center gap-1.5"><i className="h-0.5 w-4 border-t-2 border-dotted" style={{ borderColor: C.personal }} />Media personale</span>
        <span className="flex items-center gap-1.5"><i className="h-0.5 w-4 border-t-2 border-dashed" style={{ borderColor: C.team }} />Media squadra</span>
        <span className="flex items-center gap-1.5"><i className="h-0.5 w-4" style={{ background: C.wl }} />Work Load (dx)</span>
        <span className="flex items-center gap-1.5"><i className="h-0.5 w-4" style={{ background: C.upper }} />{String(LOAD_CONFIG.upperLimit).replace('.', ',')}</span>
        <span className="flex items-center gap-1.5"><i className="h-0.5 w-4" style={{ background: C.lower }} />{String(LOAD_CONFIG.lowerLimit).replace('.', ',')}</span>
      </div>
      <div ref={scroller} className="no-scrollbar overflow-x-auto rounded-2xl border border-line bg-night/40">
        <svg width={Math.max(W, 320)} height={H} className="block">
          {ticksL.map((t) => (
            <g key={t}>
              <line x1={padL} x2={W - padR} y1={yL(t)} y2={yL(t)} stroke="rgba(255,255,255,.07)" />
              <text x={padL - 6} y={yL(t) + 3.5} textAnchor="end" fontSize="10" fill="#9aa6bf">{t}</text>
            </g>
          ))}
          {ticksR.map((t) => (
            <text key={t} x={W - padR + 6} y={yR(t) + 3.5} fontSize="10" fill="#9aa6bf">{String(t).replace('.', ',')}</text>
          ))}
          {data.map((d, i) =>
            d.tl ? <rect key={d.date} x={x(i) - step * 0.32} y={yL(d.tl)} width={step * 0.64} height={padT + ih - yL(d.tl)} rx="2" fill={C.bar} opacity=".9" /> : null,
          )}
          <line x1={padL} x2={W - padR} y1={yR(LOAD_CONFIG.upperLimit)} y2={yR(LOAD_CONFIG.upperLimit)} stroke={C.upper} strokeWidth="2" />
          <line x1={padL} x2={W - padR} y1={yR(LOAD_CONFIG.lowerLimit)} y2={yR(LOAD_CONFIG.lowerLimit)} stroke={C.lower} strokeWidth="2" />
          <path d={line(data.map((d) => d.teamRol), yL)} fill="none" stroke={C.team} strokeWidth="2.2" strokeDasharray="7 5" />
          <path d={line(data.map((d) => d.rolAvg), yL)} fill="none" stroke={C.personal} strokeWidth="1.6" strokeDasharray="2 3" />
          {data.map((d, i) => (d.rolAvg != null ? <rect key={d.date} x={x(i) - 2.5} y={yL(d.rolAvg) - 2.5} width="5" height="5" fill={C.personal} /> : null))}
          <path d={line(data.map((d) => d.acwr), yR)} fill="none" stroke={C.wl} strokeWidth="2.4" strokeLinejoin="round" />
          {data.map((d, i) => (
            <text key={d.date} transform={`translate(${x(i) + 3} ${H - padB + 10}) rotate(-55)`} textAnchor="end" fontSize="9.5" fill="#9aa6bf">
              {label(d.date)}
            </text>
          ))}
        </svg>
      </div>
    </div>
  );
}
