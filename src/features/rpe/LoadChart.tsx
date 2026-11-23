import { useLayoutEffect, useRef, type ReactNode } from 'react';
import { LOAD_CONFIG, acwrZone } from '@/engine/load';

/** Colori delle serie (palette categoriale validata per sfondi scuri) e degli stati. */
export const SERIES = { tl: '#3987e5', personal: '#d95926', team: '#199e70' } as const;
export const ZONE_COLOR = { ok: '#2BB673', low: '#F5A524', high: '#FF5A5F' } as const;
const INK = '#E8ECF4';
const MUTED = '#9AA6BF';
const GRID = 'rgba(255,255,255,.07)';

export interface ChartDay {
  date: string;
  /** barre: TL dell'atleta o TL medio della squadra */
  bar: number | null;
  /** partita: barra tratteggiata */
  match?: boolean;
  personal?: number | null;
  team?: number | null;
  wl?: number | null;
}

const STEP = 32;
const PAD_L = 44;
const PAD_R = 18;
const BAR_W = 16;
const TITLE_H = 26;

function niceMax(v: number) {
  if (v <= 0) return 100;
  const step = v > 800 ? 200 : 100;
  return Math.ceil((v * 1.08) / step) * step;
}

/** Percorso di una barra con gli angoli superiori arrotondati e base sulla linea dello zero. */
function barPath(x: number, y: number, w: number, h: number, r = 4) {
  if (h <= 0) return '';
  const rr = Math.min(r, h, w / 2);
  return `M${x},${y + h}V${y + rr}Q${x},${y} ${x + rr},${y}H${x + w - rr}Q${x + w},${y} ${x + w},${y + rr}V${y + h}Z`;
}

/** Linea spezzata nei punti mancanti. */
function linePath(pts: ({ x: number; y: number } | null)[]) {
  let d = '';
  let pen = false;
  for (const p of pts) {
    if (!p) {
      pen = false;
      continue;
    }
    d += `${pen ? 'L' : 'M'}${p.x.toFixed(1)},${p.y.toFixed(1)}`;
    pen = true;
  }
  return d;
}

const fmtTick = (v: number) => String(Math.round(v * 10) / 10).replace('.', ',');

/**
 * Due pannelli con lo stesso asse dei giorni (niente doppio asse):
 *  - sopra il carico (TL) con media personale e media squadra
 *  - sotto il Work Load con la fascia 0,8–1,3
 * Scorre in orizzontale (parte dalle date più recenti); un tocco seleziona il giorno.
 */
export function LoadPanels({ days, selected, onSelect, barTitle = 'Carico (TL)', wlTitle = 'Work Load' }: { days: ChartDay[]; selected: number; onSelect: (i: number) => void; barTitle?: string; wlTitle?: string }) {
  const scroller = useRef<HTMLDivElement>(null);
  const n = days.length;
  useLayoutEffect(() => {
    const el = scroller.current;
    if (el) el.scrollLeft = el.scrollWidth;
  }, [n]);
  if (!n) return <div className="grid h-40 place-items-center rounded-2xl border border-dashed border-line text-sm text-ink-muted">Nessun dato</div>;

  const hasWl = days.some((d) => d.wl !== undefined);
  const W = PAD_L + n * STEP + PAD_R;
  // pannello TL
  const aTop = TITLE_H;
  const aH = 168;
  const tlMax = niceMax(Math.max(...days.flatMap((d) => [d.bar ?? 0, d.personal ?? 0, d.team ?? 0])));
  const yA = (v: number) => aTop + aH - (v / tlMax) * aH;
  // pannello Work Load
  const bTop = aTop + aH + 22 + TITLE_H;
  const bH = hasWl ? 112 : 0;
  const wlMax = Math.max(2, Math.ceil(Math.max(...days.map((d) => d.wl ?? 0)) * 2) / 2);
  const yB = (v: number) => bTop + bH - (Math.min(v, wlMax) / wlMax) * bH;
  const axisY = hasWl ? bTop + bH : aTop + aH;
  const H = axisY + 30;
  const cx = (i: number) => PAD_L + i * STEP + STEP / 2;

  const ticksA = [0, tlMax / 2, tlMax];
  const ticksB = [0, LOAD_CONFIG.lowerLimit, LOAD_CONFIG.upperLimit, wlMax];
  const pers = linePath(days.map((d, i) => (d.personal != null ? { x: cx(i), y: yA(d.personal) } : null)));
  const team = linePath(days.map((d, i) => (d.team != null ? { x: cx(i), y: yA(d.team) } : null)));
  const wl = linePath(days.map((d, i) => (d.wl != null ? { x: cx(i), y: yB(d.wl) } : null)));
  const sel = days[selected];

  const title = (y: number, text: ReactNode) => (
    <div className="pointer-events-none absolute left-2 rounded-md bg-surface/90 px-1.5 text-[11px] font-bold uppercase tracking-widest text-ink-muted" style={{ top: y - TITLE_H + 4 }}>
      {text}
    </div>
  );

  return (
    <div className="relative overflow-hidden rounded-2xl border border-line bg-night/40">
      <div ref={scroller} className="no-scrollbar overflow-x-auto">
        <svg width={Math.max(W, 300)} height={H} className="block select-none" role="img" aria-label="Grafico del carico giorno per giorno">
          <defs>
            <pattern id="cl-hatch" patternUnits="userSpaceOnUse" width="5" height="5" patternTransform="rotate(45)">
              <rect width="5" height="5" fill={SERIES.tl} opacity={0.35} />
              <rect width="2.4" height="5" fill={SERIES.tl} />
            </pattern>
          </defs>
          {/* giorno selezionato */}
          {sel && <rect x={cx(selected) - STEP / 2 + 1} y={aTop - 4} width={STEP - 2} height={axisY - aTop + 26} rx={8} fill="rgba(255,255,255,.07)" />}
          {/* griglia */}
          {ticksA.map((t) => (
            <line key={`a${t}`} x1={PAD_L - 6} x2={W - PAD_R + 6} y1={yA(t)} y2={yA(t)} stroke={t === 0 ? 'rgba(255,255,255,.18)' : GRID} />
          ))}
          {/* barre TL */}
          {days.map((d, i) =>
            d.bar != null && d.bar > 0 ? (
              <path
                key={`b${d.date}`}
                d={barPath(cx(i) - BAR_W / 2, yA(d.bar), BAR_W, yA(0) - yA(d.bar))}
                fill={d.match ? 'url(#cl-hatch)' : SERIES.tl}
                stroke={d.match ? SERIES.tl : undefined}
                strokeWidth={d.match ? 1.2 : undefined}
                opacity={i === selected ? 1 : 0.82}
              />
            ) : null,
          )}
          {team && <path d={team} fill="none" stroke={SERIES.team} strokeWidth={2} strokeDasharray="5 4" strokeLinejoin="round" strokeLinecap="round" />}
          {pers && <path d={pers} fill="none" stroke={SERIES.personal} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />}
          {sel?.personal != null && <circle cx={cx(selected)} cy={yA(sel.personal)} r={4.5} fill={SERIES.personal} stroke="var(--c-surface)" strokeWidth={2} />}
          {sel?.team != null && <circle cx={cx(selected)} cy={yA(sel.team)} r={4.5} fill={SERIES.team} stroke="var(--c-surface)" strokeWidth={2} />}

          {hasWl && (
            <>
              {/* fascia ideale 0,8–1,3 */}
              <rect x={PAD_L - 6} width={W - PAD_L - PAD_R + 12} y={yB(LOAD_CONFIG.upperLimit)} height={yB(LOAD_CONFIG.lowerLimit) - yB(LOAD_CONFIG.upperLimit)} fill={ZONE_COLOR.ok} opacity={0.1} />
              <line x1={PAD_L - 6} x2={W - PAD_R + 6} y1={yB(LOAD_CONFIG.upperLimit)} y2={yB(LOAD_CONFIG.upperLimit)} stroke={ZONE_COLOR.high} strokeOpacity={0.7} strokeDasharray="3 4" />
              <line x1={PAD_L - 6} x2={W - PAD_R + 6} y1={yB(LOAD_CONFIG.lowerLimit)} y2={yB(LOAD_CONFIG.lowerLimit)} stroke={ZONE_COLOR.low} strokeOpacity={0.7} strokeDasharray="3 4" />
              <line x1={PAD_L - 6} x2={W - PAD_R + 6} y1={yB(0)} y2={yB(0)} stroke="rgba(255,255,255,.18)" />
              <line x1={PAD_L - 6} x2={W - PAD_R + 6} y1={yB(wlMax)} y2={yB(wlMax)} stroke={GRID} />
              {wl && <path d={wl} fill="none" stroke={MUTED} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />}
              {days.map((d, i) => {
                const z = acwrZone(d.wl ?? null);
                if (!z) return null;
                // senza RPE quel giorno il valore è riportato dal precedente: punto vuoto
                const carried = d.bar == null;
                return carried ? (
                  <circle key={`w${d.date}`} cx={cx(i)} cy={yB(d.wl!)} r={i === selected ? 5 : 3.5} fill="var(--c-surface)" stroke={ZONE_COLOR[z]} strokeWidth={2} />
                ) : (
                  <circle key={`w${d.date}`} cx={cx(i)} cy={yB(d.wl!)} r={i === selected ? 6 : 4} fill={ZONE_COLOR[z]} stroke="var(--c-surface)" strokeWidth={2} />
                );
              })}
            </>
          )}

          {/* date */}
          {days.map((d, i) => {
            const first = i === 0 || d.date.slice(5, 7) !== days[i - 1].date.slice(5, 7);
            return (
              <g key={`x${d.date}`}>
                <text x={cx(i)} y={axisY + 16} textAnchor="middle" fontSize={11} fontWeight={i === selected ? 700 : 500} fill={i === selected ? INK : MUTED} style={{ fontVariantNumeric: 'tabular-nums' }}>
                  {+d.date.slice(8, 10)}
                </text>
                {first && (
                  <text x={cx(i)} y={axisY + 28} textAnchor="middle" fontSize={9} fontWeight={700} fill={MUTED} letterSpacing={0.5}>
                    {['GEN', 'FEB', 'MAR', 'APR', 'MAG', 'GIU', 'LUG', 'AGO', 'SET', 'OTT', 'NOV', 'DIC'][+d.date.slice(5, 7) - 1]}
                  </text>
                )}
              </g>
            );
          })}
          {/* aree di tocco: tutta la colonna del giorno */}
          {days.map((d, i) => (
            <rect key={`t${d.date}`} x={cx(i) - STEP / 2} y={0} width={STEP} height={H} fill="transparent" onClick={() => onSelect(i)} style={{ cursor: 'pointer' }} />
          ))}
        </svg>
      </div>
      {/* assi fissi a sinistra: restano visibili mentre il grafico scorre */}
      <div className="pointer-events-none absolute inset-y-0 left-0 w-[42px] bg-gradient-to-r from-surface via-surface/90 to-transparent" />
      <svg className="pointer-events-none absolute left-0 top-0" width={40} height={H}>
        {ticksA.map((t) => (
          <text key={`la${t}`} x={34} y={yA(t) + 4} textAnchor="end" fontSize={10} fill={MUTED} style={{ fontVariantNumeric: 'tabular-nums' }}>
            {Math.round(t)}
          </text>
        ))}
        {hasWl &&
          ticksB.map((t) => (
            <text
              key={`lb${t}`}
              x={34}
              y={yB(t) + 4}
              textAnchor="end"
              fontSize={10}
              fontWeight={t === LOAD_CONFIG.upperLimit || t === LOAD_CONFIG.lowerLimit ? 700 : 400}
              fill={t === LOAD_CONFIG.upperLimit ? ZONE_COLOR.high : t === LOAD_CONFIG.lowerLimit ? ZONE_COLOR.low : MUTED}
            >
              {fmtTick(t)}
            </text>
          ))}
      </svg>
      {title(aTop, barTitle)}
      {hasWl && title(bTop, wlTitle)}
    </div>
  );
}

/** Legenda: il colore accompagna sempre il nome della serie. */
export function Legend({ items }: { items: { color: string; label: string; kind: 'bar' | 'hatch' | 'line' | 'dash' | 'dot' | 'band' }[] }) {
  return (
    <div className="mb-2 flex flex-wrap gap-x-4 gap-y-1.5 text-[12px] font-semibold text-ink-muted">
      {items.map((it) => (
        <span key={it.label} className="flex items-center gap-1.5">
          {it.kind === 'bar' && <i className="h-3 w-2.5 rounded-t-[3px]" style={{ background: it.color }} />}
          {it.kind === 'hatch' && (
            <i className="h-3 w-2.5 rounded-t-[3px]" style={{ border: `1px solid ${it.color}`, background: `repeating-linear-gradient(45deg, ${it.color} 0 2px, transparent 2px 4px)` }} />
          )}
          {it.kind === 'line' && <i className="h-[2px] w-4 rounded" style={{ background: it.color }} />}
          {it.kind === 'dash' && <i className="w-4 border-t-2 border-dashed" style={{ borderColor: it.color }} />}
          {it.kind === 'dot' && <i className="h-2.5 w-2.5 rounded-full" style={{ background: it.color }} />}
          {it.kind === 'band' && <i className="h-3 w-4 rounded-sm" style={{ background: it.color, opacity: 0.35 }} />}
          {it.label}
        </span>
      ))}
    </div>
  );
}

/** Indicatore orizzontale del Work Load (0–2,5) con la fascia ideale. */
export function WlGauge({ value }: { value: number | null }) {
  const max = 2.5;
  const pct = (v: number) => `${(Math.min(v, max) / max) * 100}%`;
  const z = acwrZone(value);
  return (
    <div className="relative mt-1.5 h-2 w-full rounded-full bg-white/[.07]">
      <div className="absolute inset-y-0 rounded-full" style={{ left: pct(LOAD_CONFIG.lowerLimit), width: `calc(${pct(LOAD_CONFIG.upperLimit)} - ${pct(LOAD_CONFIG.lowerLimit)})`, background: ZONE_COLOR.ok, opacity: 0.28 }} />
      {value != null && z && (
        <div className="absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2" style={{ left: pct(value), background: ZONE_COLOR[z], borderColor: 'var(--c-surface)' }} />
      )}
    </div>
  );
}
