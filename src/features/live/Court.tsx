import { memo, useMemo } from 'react';
import type { Team } from '@/db/types';
import { teamLogoSrc } from '@/theme/apply';
import { teamInitials } from '@/components/TeamLogo';
import { readableOn } from '@/theme/color';
import { COURT as C, type CourtView } from './courtGeometry';

// Tonalità del parquet (rovere), poi scurite da un velo per il tema scuro
const WOOD = ['#9a6a3c', '#8d5f34', '#a5733f', '#93653a', '#875a31', '#9f6d3d'];
const PLANK = 0.3; // larghezza listello (m)
const TILE_L = 6;
const ROWS = 8;

/** Listelli sfalsati generati in modo deterministico (stesso disegno a ogni render). */
function usePlanks() {
  return useMemo(() => {
    let seed = 7;
    const rnd = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);
    const planks: { x: number; y: number; w: number; c: string; grain: number[] }[] = [];
    for (let r = 0; r < ROWS; r++) {
      let x = -rnd() * 2.2;
      while (x < TILE_L) {
        const w = 1.3 + rnd() * 1.9;
        planks.push({ x, y: r * PLANK, w, c: WOOD[Math.floor(rnd() * WOOD.length)], grain: [rnd(), rnd(), rnd()] });
        x += w;
      }
    }
    return planks;
  }, []);
}

function Logo({ team, cx, cy, size, clip }: { team: CourtProps['team']; cx: number; cy: number; size: number; clip?: string }) {
  const src = teamLogoSrc(team);
  if (src) return <image href={src} x={cx - size / 2} y={cy - size / 2} width={size} height={size} clipPath={clip} preserveAspectRatio="xMidYMid meet" />;
  const bg = team?.primary ?? '#1b3a6b';
  return (
    <g>
      <circle cx={cx} cy={cy} r={size / 2} fill={bg} stroke={team?.secondary ?? '#fff'} strokeWidth={size * 0.05} />
      <text x={cx} y={cy + size * 0.13} textAnchor="middle" fontSize={size * 0.36} fontWeight={800} fontFamily="Barlow Condensed, sans-serif" fill={readableOn(bg)}>
        {teamInitials(team?.name ?? '')}
      </text>
    </g>
  );
}

interface CourtProps {
  team: Pick<Team, 'logo' | 'name' | 'primary' | 'secondary'> | undefined;
  view: CourtView;
}

/** Mezzo campo FIBA verticale su parquet, canestro in alto, logo della squadra. */
export const Court = memo(function Court({ team, view: v }: CourtProps) {
  const planks = usePlanks();
  const line = { stroke: '#f6eedf', strokeWidth: 0.075, fill: 'none', strokeOpacity: 0.92 } as const;
  const paintL = C.basketX - C.paintWidth / 2;
  const dy = Math.sqrt(C.threeR ** 2 - (C.basketX - C.cornerX) ** 2);
  const arcY = C.basketY + dy;
  const three = `M${C.cornerX} 0 V${arcY} A${C.threeR} ${C.threeR} 0 0 0 ${C.width - C.cornerX} ${arcY} V0`;
  const bottom = v.y0 + v.h;
  const apronLogo = Math.min(v.apron * 0.72, 4.6);
  const apronCx = (v.apron + 0.3) / 2;

  return (
    <svg viewBox={`${v.x0} ${v.y0} ${v.w} ${v.h}`} className="absolute inset-0 h-full w-full" aria-hidden>
      <defs>
        {/* listelli nel senso della lunghezza del campo (verticali) */}
        <pattern id="parquet" width={TILE_L} height={ROWS * PLANK} patternUnits="userSpaceOnUse" patternTransform="rotate(90)">
          {planks.map((p, i) => (
            <g key={i}>
              <rect x={p.x} y={p.y} width={p.w} height={PLANK} fill={p.c} />
              {p.grain.map((g, k) => (
                <line key={k} x1={p.x + 0.1} x2={p.x + p.w - 0.1} y1={p.y + 0.06 + g * 0.18} y2={p.y + 0.07 + g * 0.17} stroke="#5a3718" strokeWidth={0.012} strokeOpacity={0.35} />
              ))}
              <rect x={p.x} y={p.y} width={0.018} height={PLANK} fill="#3e2510" fillOpacity={0.55} />
              <rect x={p.x} y={p.y} width={p.w} height={0.012} fill="#3e2510" fillOpacity={0.35} />
            </g>
          ))}
        </pattern>
        <linearGradient id="sheen" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity="0.13" />
          <stop offset="0.45" stopColor="#fff" stopOpacity="0.02" />
          <stop offset="1" stopColor="#000" stopOpacity="0.1" />
        </linearGradient>
        <radialGradient id="vignette" cx="0.5" cy="0.35" r="0.8">
          <stop offset="0.55" stopColor="#000" stopOpacity="0" />
          <stop offset="1" stopColor="#000" stopOpacity="0.45" />
        </radialGradient>
        <clipPath id="center-clip">
          <circle cx={C.basketX} cy={C.half} r={C.centerR - 0.04} />
        </clipPath>
      </defs>

      {/* Parquet */}
      <rect x={v.x0} y={v.y0} width={v.w} height={v.h} fill="url(#parquet)" />
      <rect x={v.x0} y={v.y0} width={v.w} height={v.h} fill="#0b0704" fillOpacity={0.3} />
      <rect x={v.x0} y={v.y0} width={v.w} height={v.h} fill="url(#sheen)" />

      {/* Bordo campo nel colore della squadra */}
      <path d={`M${v.x0} ${v.y0} H${v.x0 + v.w} V${bottom} H${v.x0} Z M0 0 V${bottom} H${C.width} V0 Z`} fill="var(--c-bar)" fillOpacity={0.62} fillRule="evenodd" />
      {v.showApronLogos && (
        <g opacity={0.92}>
          <Logo team={team} cx={-apronCx} cy={v.y0 + v.h / 2} size={apronLogo} />
          <Logo team={team} cx={C.width + apronCx} cy={v.y0 + v.h / 2} size={apronLogo} />
        </g>
      )}

      {/* Area da 3 leggermente tinta col colore della squadra */}
      <path d={`${three} Z`} fill="var(--c-bar)" fillOpacity={0.16} />

      {/* Pitturato: colore della squadra con bordo d'accento */}
      <rect x={paintL} y={0} width={C.paintWidth} height={C.paintDepth} fill="var(--c-bar)" fillOpacity={0.88} />
      <rect x={paintL + 0.14} y={0.14} width={C.paintWidth - 0.28} height={C.paintDepth - 0.28} fill="none" stroke="var(--c-brand)" strokeWidth={0.1} strokeOpacity={0.9} />

      {/* Linee */}
      <g {...line}>
        <path d={`M0 ${bottom} V0 H${C.width} V${bottom}`} />
        <path d={`M0 ${C.half} H${C.width}`} />
        <path d={three} />
        <rect x={paintL} y={0} width={C.paintWidth} height={C.paintDepth} />
        <path d={`M${C.basketX - C.ftR} ${C.paintDepth} A${C.ftR} ${C.ftR} 0 0 0 ${C.basketX + C.ftR} ${C.paintDepth}`} />
        <path d={`M${C.basketX - C.ftR} ${C.paintDepth} A${C.ftR} ${C.ftR} 0 0 1 ${C.basketX + C.ftR} ${C.paintDepth}`} strokeDasharray="0.35 0.3" />
        <path d={`M${C.basketX - C.restrictedR} ${C.backboardY} V${C.basketY} A${C.restrictedR} ${C.restrictedR} 0 0 0 ${C.basketX + C.restrictedR} ${C.basketY} V${C.backboardY}`} />
      </g>

      {/* Cerchio di centrocampo con il logo: solo se è visibile per intero */}
      {bottom >= C.half + C.centerR + 0.1 && (
        <g>
          <circle cx={C.basketX} cy={C.half} r={C.centerR} fill={team?.primary ?? 'var(--c-bar)'} />
          <Logo team={team} cx={C.basketX} cy={C.half} size={(C.centerR - 0.12) * 2} clip="url(#center-clip)" />
          <circle cx={C.basketX} cy={C.half} r={C.centerR} {...line} />
        </g>
      )}

      {/* Tabellone e ferro */}
      <path d={`M${C.basketX - 0.9} ${C.backboardY} H${C.basketX + 0.9}`} stroke="#f6eedf" strokeWidth={0.13} strokeLinecap="round" />
      <path d={`M${C.basketX} ${C.backboardY} V${C.basketY - C.rimR}`} stroke="#f6eedf" strokeWidth={0.07} />
      <circle cx={C.basketX} cy={C.basketY} r={C.rimR} fill="none" stroke="#ff7a1a" strokeWidth={0.07} />

      <rect x={v.x0} y={v.y0} width={v.w} height={v.h} fill="url(#vignette)" />
    </svg>
  );
});
