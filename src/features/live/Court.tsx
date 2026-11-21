import { memo, useMemo } from 'react';
import type { Team } from '@/db/types';
import { teamLogoSrc } from '@/theme/apply';
import { teamInitials } from '@/components/TeamLogo';
import { readableOn } from '@/theme/color';
import { COURT as C, VIEW_H, VIEW_W } from './courtGeometry';

// Tonalità del parquet (rovere), poi scurite da un velo per il tema scuro
const WOOD = ['#9a6a3c', '#8d5f34', '#a5733f', '#93653a', '#875a31', '#9f6d3d'];
const PLANK_H = 0.3; // altezza listello (m)
const TILE_W = 6;
const ROWS = 8;

/** Listelli sfalsati generati in modo deterministico (stesso disegno a ogni render). */
function usePlanks() {
  return useMemo(() => {
    let seed = 7;
    const rnd = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);
    const planks: { x: number; y: number; w: number; c: string; grain: number[] }[] = [];
    for (let r = 0; r < ROWS; r++) {
      let x = -rnd() * 2.2;
      while (x < TILE_W) {
        const w = 1.3 + rnd() * 1.9;
        planks.push({ x, y: r * PLANK_H, w, c: WOOD[Math.floor(rnd() * WOOD.length)], grain: [rnd(), rnd(), rnd()] });
        x += w;
      }
    }
    return planks;
  }, []);
}

interface CourtProps {
  team: Pick<Team, 'logo' | 'name' | 'primary' | 'secondary'> | undefined;
}

/** Mezzo campo FIBA in SVG su parquet, canestro a destra, logo della squadra nel cerchio centrale. */
export const Court = memo(function Court({ team }: CourtProps) {
  const planks = usePlanks();
  const logo = teamLogoSrc(team);
  const line = { stroke: '#f6eedf', strokeWidth: 0.075, fill: 'none', strokeOpacity: 0.92 } as const;
  const paintX = C.length - C.paintDepth;
  const paintY = C.basketY - C.paintWidth / 2;
  const dx = Math.sqrt(C.threeR ** 2 - (C.basketY - C.cornerY) ** 2);
  const arcX = C.basketX - dx;
  const three = `M${C.length} ${C.cornerY} H${arcX} A${C.threeR} ${C.threeR} 0 0 0 ${arcX} ${C.width - C.cornerY} H${C.length}`;

  return (
    <svg viewBox={`${C.x0} ${C.y0} ${VIEW_W} ${VIEW_H}`} className="absolute inset-0 h-full w-full" aria-hidden>
      <defs>
        <pattern id="parquet" width={TILE_W} height={ROWS * PLANK_H} patternUnits="userSpaceOnUse">
          {planks.map((p, i) => (
            <g key={i}>
              <rect x={p.x} y={p.y} width={p.w} height={PLANK_H} fill={p.c} />
              {p.grain.map((g, k) => (
                <line key={k} x1={p.x + 0.1} x2={p.x + p.w - 0.1} y1={p.y + 0.06 + g * 0.18} y2={p.y + 0.07 + g * 0.17} stroke="#5a3718" strokeWidth={0.012} strokeOpacity={0.35} />
              ))}
              <rect x={p.x} y={p.y} width={0.018} height={PLANK_H} fill="#3e2510" fillOpacity={0.55} />
              <rect x={p.x} y={p.y} width={p.w} height={0.012} fill="#3e2510" fillOpacity={0.35} />
            </g>
          ))}
        </pattern>
        <linearGradient id="sheen" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity="0.13" />
          <stop offset="0.45" stopColor="#fff" stopOpacity="0.02" />
          <stop offset="1" stopColor="#000" stopOpacity="0.1" />
        </linearGradient>
        <radialGradient id="vignette" cx="0.55" cy="0.5" r="0.75">
          <stop offset="0.55" stopColor="#000" stopOpacity="0" />
          <stop offset="1" stopColor="#000" stopOpacity="0.45" />
        </radialGradient>
        <clipPath id="center-clip">
          <circle cx={0} cy={C.basketY} r={C.centerR - 0.04} />
        </clipPath>
      </defs>

      {/* Parquet */}
      <rect x={C.x0} y={C.y0} width={VIEW_W} height={VIEW_H} fill="url(#parquet)" />
      <rect x={C.x0} y={C.y0} width={VIEW_W} height={VIEW_H} fill="#0b0704" fillOpacity={0.3} />
      <rect x={C.x0} y={C.y0} width={VIEW_W} height={VIEW_H} fill="url(#sheen)" />

      {/* Area da 3 leggermente tinta col colore della squadra */}
      <path d={`${three} Z`} fill="var(--c-bar)" fillOpacity={0.16} />

      {/* Pitturato: colore della squadra con bordo d'accento */}
      <rect x={paintX} y={paintY} width={C.paintDepth} height={C.paintWidth} fill="var(--c-bar)" fillOpacity={0.88} />
      <rect x={paintX + 0.14} y={paintY + 0.14} width={C.paintDepth - 0.28} height={C.paintWidth - 0.28} fill="none" stroke="var(--c-brand)" strokeWidth={0.1} strokeOpacity={0.9} />

      {/* Linee */}
      <g {...line}>
        <path d={`M${C.x0} 0 H${C.length} V${C.width} H${C.x0}`} />
        <path d={`M0 0 V${C.width}`} />
        <path d={three} />
        <rect x={paintX} y={paintY} width={C.paintDepth} height={C.paintWidth} />
        <path d={`M${paintX} ${C.basketY - C.ftR} A${C.ftR} ${C.ftR} 0 0 0 ${paintX} ${C.basketY + C.ftR}`} />
        <path d={`M${paintX} ${C.basketY - C.ftR} A${C.ftR} ${C.ftR} 0 0 1 ${paintX} ${C.basketY + C.ftR}`} strokeDasharray="0.35 0.3" />
        <path d={`M${C.basketX} ${C.basketY - C.restrictedR} A${C.restrictedR} ${C.restrictedR} 0 0 0 ${C.basketX} ${C.basketY + C.restrictedR}`} />
        <path d={`M${C.basketX} ${C.basketY - C.restrictedR} H${C.length - 1.2} M${C.basketX} ${C.basketY + C.restrictedR} H${C.length - 1.2}`} />
      </g>

      {/* Cerchio di centrocampo con il logo della squadra */}
      <circle cx={0} cy={C.basketY} r={C.centerR} fill={team?.primary ?? 'var(--c-bar)'} />
      {logo ? (
        <image href={logo} x={-C.centerR + 0.12} y={C.basketY - C.centerR + 0.12} width={(C.centerR - 0.12) * 2} height={(C.centerR - 0.12) * 2} clipPath="url(#center-clip)" preserveAspectRatio="xMidYMid meet" />
      ) : (
        <text x={0} y={C.basketY + 0.45} textAnchor="middle" fontSize={1.3} fontWeight={800} fontFamily="Barlow Condensed, sans-serif" fill={readableOn(team?.primary ?? '#1b3a6b')}>
          {teamInitials(team?.name ?? '')}
        </text>
      )}
      <circle cx={0} cy={C.basketY} r={C.centerR} {...line} />

      {/* Tabellone e ferro */}
      <path d={`M${C.length - 1.2} ${C.basketY - 0.9} V${C.basketY + 0.9}`} stroke="#f6eedf" strokeWidth={0.13} strokeLinecap="round" />
      <path d={`M${C.length - 1.2} ${C.basketY} H${C.basketX + 0.23}`} stroke="#f6eedf" strokeWidth={0.07} />
      <circle cx={C.basketX} cy={C.basketY} r={0.23} fill="none" stroke="#ff7a1a" strokeWidth={0.07} />

      <rect x={C.x0} y={C.y0} width={VIEW_W} height={VIEW_H} fill="url(#vignette)" />
    </svg>
  );
});
