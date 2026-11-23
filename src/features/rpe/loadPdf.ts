/**
 * Report del carico in PDF (A4 verticale, sfondo bianco per la stampa).
 * Pagina 1: squadra (indicatori, grafico del TL medio, tabella atleti). Poi, a scelta, una pagina per atleta
 * con i due grafici del foglio sRPE (carico; Work Load con la fascia 0,8–1,3) e il dettaglio seduta per seduta.
 */
import { surnameFirst } from '@/db/types';
import type { jsPDF as JsPDF } from 'jspdf';
import { contrast, darken, hexToRgb, normalizeHex } from '@/theme/color';
import { LOAD_CONFIG, acwrZone } from '@/engine/load';
import { fmtInt } from '@/engine/int';
import { mmss } from '@/features/live/liveModel';
import { APP } from '@/config';
import { SESSION_TYPE_LABEL } from '@/db/types';
import type { AthleteLoad, LoadReport } from './loadReport';

type RGB = [number, number, number];
const rgb = (hex: string): RGB => {
  const c = hexToRgb(hex);
  return [c.r, c.g, c.b];
};
const mix = (a: RGB, b: RGB, t: number): RGB => [0, 1, 2].map((i) => Math.round(a[i] + (b[i] - a[i]) * t)) as RGB;

// palette per la stampa (serie validate per sfondo chiaro) e stati
const C = {
  tl: rgb('#2a78d6'),
  personal: rgb('#e0601c'),
  team: rgb('#1baf7a'),
  wl: [90, 98, 112] as RGB,
  high: [214, 32, 32] as RGB,
  ok: [30, 150, 90] as RGB,
  low: [222, 140, 0] as RGB,
  ink: [28, 32, 40] as RGB,
  muted: [110, 118, 132] as RGB,
  grid: [226, 229, 234] as RGB,
};
const ZONE_RGB = { high: C.high, ok: C.ok, low: C.low } as const;
const ZONE_TXT = { high: 'Sopra 1,3', ok: 'In zona', low: 'Sotto 0,8' } as const;

const n0 = (v: number | null | undefined) => (v == null ? '–' : Math.round(v).toLocaleString('it-IT'));
const n1 = (v: number | null | undefined) => (v == null ? '–' : v.toFixed(1).replace('.', ','));
const n2 = (v: number | null | undefined) => (v == null ? '–' : v.toFixed(2).replace('.', ','));
const MONTHS = ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic'];
const dmy = (iso: string) => `${+iso.slice(8, 10)} ${MONTHS[+iso.slice(5, 7) - 1]} ${iso.slice(0, 4)}`;
const dm = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;

export interface LoadPdfInput {
  report: LoadReport;
  logo?: string | null;
  /** una pagina per ogni atleta (con almeno una risposta) */
  athletePages?: boolean;
  /** solo questi atleti nelle pagine dedicate */
  onlyAthletes?: number[];
  generatedAt?: Date;
  compress?: boolean;
}

export function loadPdfFileName(r: LoadReport, athlete?: string): string {
  const slug = (s: string) =>
    s
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 40);
  return `carico-${slug(athlete ?? r.team.name)}-${r.from}_${r.to}.pdf`;
}

export async function buildLoadPdf(input: LoadPdfInput): Promise<JsPDF> {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait', compress: input.compress ?? true });
  const r = input.report;
  const W = 210;
  const H = 297;
  const M = 10;
  const primaryHex = normalizeHex(r.team.primary) ?? '#002855';
  const secondaryHex = normalizeHex(r.team.secondary) ?? '#ee3239';
  const primary = rgb(primaryHex);
  const accentHex = contrast(secondaryHex, '#ffffff') >= 2.4 ? secondaryHex : contrast(primaryHex, '#ffffff') >= 2.4 ? primaryHex : darken(secondaryHex, 0.45);
  const accent = rgb(accentHex);
  const onPrimary: RGB = contrast('#ffffff', primaryHex) >= contrast('#111111', primaryHex) ? [255, 255, 255] : [17, 17, 17];
  const light = mix(primary, [255, 255, 255], 0.92);
  const period = `dal ${dmy(r.from)} al ${dmy(r.to)} · media mobile ${r.windowDays} giorni`;

  const text = (s: string, x: number, y: number, o: { size?: number; bold?: boolean; color?: RGB; align?: 'left' | 'right' | 'center' } = {}) => {
    doc.setFont('helvetica', o.bold ? 'bold' : 'normal');
    doc.setFontSize(o.size ?? 9);
    doc.setTextColor(...(o.color ?? C.ink));
    doc.text(s, x, y, { align: o.align ?? 'left' });
  };

  const header = (title: string, subtitle: string, h = 30) => {
    doc.setFillColor(...primary);
    doc.rect(0, 0, W, h, 'F');
    doc.setFillColor(...accent);
    doc.rect(0, h, W, 1.4, 'F');
    let tx = M;
    if (input.logo) {
      try {
        const fmt = /^data:image\/jpe?g/.test(input.logo) ? 'JPEG' : 'PNG';
        const s = h - 10;
        doc.addImage(input.logo, fmt, M, 5, s, s, undefined, 'FAST');
        tx = M + s + 5;
      } catch {
        /* logo non valido */
      }
    }
    text(title, tx, 11, { size: 8.5, bold: true, color: onPrimary });
    text(doc.splitTextToSize(subtitle, W - tx - M - 24)[0] as string, tx, 19, { size: 16, bold: true, color: onPrimary });
    text(period, tx, 25.5, { size: 9, color: onPrimary });
    text(APP.name, W - M, 11, { size: 8.5, color: onPrimary, align: 'right' });
  };

  const tiles = (y: number, items: [string, string, string?][]) => {
    const gap = 3;
    const w = (W - 2 * M - gap * (items.length - 1)) / items.length;
    items.forEach(([label, value, sub], k) => {
      const x = M + k * (w + gap);
      doc.setFillColor(...light);
      doc.roundedRect(x, y, w, 17, 2, 2, 'F');
      text(label.toUpperCase(), x + 3, y + 5, { size: 6.5, bold: true, color: C.muted });
      text(value, x + 3, y + 12.5, { size: 14, bold: true });
      if (sub) text(sub, x + w - 3, y + 12.5, { size: 7, color: C.muted, align: 'right' });
    });
    return y + 17;
  };

  /** Pannello con griglia, asse sinistro e date. Restituisce le funzioni di scala. */
  const frame = (x: number, y: number, w: number, h: number, max: number, ticks: number[], dates: string[], fmt: (v: number) => string, showDates: boolean) => {
    const step = dates.length ? w / dates.length : w;
    const cx = (i: number) => x + step * (i + 0.5);
    const cy = (v: number) => y + h - (Math.min(v, max) / max) * h;
    doc.setLineWidth(0.15);
    for (const t of ticks) {
      doc.setDrawColor(...(t === 0 ? ([170, 176, 186] as RGB) : C.grid));
      doc.line(x, cy(t), x + w, cy(t));
      text(fmt(t), x - 1.5, cy(t) + 1, { size: 6.5, color: C.muted, align: 'right' });
    }
    if (showDates) {
      const every = Math.max(1, Math.ceil(dates.length / 24));
      dates.forEach((d, i) => {
        if (i % every === 0 || i === dates.length - 1) text(dm(d), cx(i), y + h + 4, { size: 6, color: C.muted, align: 'center' });
      });
    }
    return { cx, cy, step };
  };

  const niceMax = (v: number) => Math.max(100, Math.ceil((v * 1.1) / (v > 800 ? 200 : 100)) * (v > 800 ? 200 : 100));

  const polyline = (pts: ({ x: number; y: number } | null)[], color: RGB, width: number, dash?: number[]) => {
    doc.setDrawColor(...color);
    doc.setLineWidth(width);
    if (dash) doc.setLineDashPattern(dash, 0);
    let prev: { x: number; y: number } | null = null;
    for (const p of pts) {
      if (p && prev) doc.line(prev.x, prev.y, p.x, p.y);
      prev = p;
    }
    if (dash) doc.setLineDashPattern([], 0);
  };

  /** Barra delle partite: stesso blu, tratteggio diagonale (si distingue anche in bianco e nero). */
  const hatchRect = (x: number, y: number, w: number, h: number) => {
    if (h <= 0) return;
    doc.setFillColor(...mix(C.tl, [255, 255, 255], 0.62));
    doc.rect(x, y, w, h, 'F');
    doc.setDrawColor(...C.tl);
    doc.setLineWidth(0.35);
    const gap = 1.3;
    // linee a 45°: x - y = c, tagliate sul rettangolo
    for (let c = -h; c < w; c += gap) {
      const x1 = x + Math.max(c, 0);
      const y1 = y + h - Math.max(-c, 0);
      const len = Math.min(w - Math.max(c, 0), h - Math.max(-c, 0));
      if (len > 0) doc.line(x1, y1, x1 + len, y1 - len);
    }
    doc.setLineWidth(0.3);
    doc.rect(x, y, w, h, 'S');
  };

  const legend = (y: number, items: [RGB, string, 'bar' | 'hatch' | 'line' | 'dash' | 'band' | 'dot'][]) => {
    let x = M;
    for (const [color, label, kind] of items) {
      doc.setFillColor(...color);
      doc.setDrawColor(...color);
      if (kind === 'bar') doc.rect(x, y - 2.4, 2.6, 2.8, 'F');
      if (kind === 'hatch') hatchRect(x, y - 2.4, 2.6, 2.8);
      if (kind === 'line') (doc.setLineWidth(0.6), doc.line(x, y - 1, x + 5, y - 1));
      if (kind === 'dash') (doc.setLineWidth(0.6), doc.setLineDashPattern([1.2, 0.9], 0), doc.line(x, y - 1, x + 5, y - 1), doc.setLineDashPattern([], 0));
      if (kind === 'band') (doc.setFillColor(...mix(color, [255, 255, 255], 0.8)), doc.rect(x, y - 2.4, 5, 2.8, 'F'));
      if (kind === 'dot') doc.circle(x + 1.3, y - 1, 1.1, 'F');
      const w = kind === 'bar' || kind === 'hatch' || kind === 'dot' ? 4 : 6.5;
      text(label, x + w, y, { size: 7.5, color: C.muted });
      x += w + doc.getTextWidth(label) + 6;
    }
  };

  const zoneDot = (x: number, y: number, v: number | null | undefined) => {
    const z = acwrZone(v ?? null);
    if (!z) return;
    doc.setFillColor(...ZONE_RGB[z]);
    doc.circle(x, y, 1.1, 'F');
  };

  // ───────────────────────── Pagina squadra ─────────────────────────
  header('REPORT CARICO INTERNO (sRPE)', r.team.name);
  let y = 37;
  const pct = r.responseRate == null ? '–' : `${Math.round(r.responseRate * 100)}%`;
  y = tiles(y, [
    ['Sedute', String(r.sessions.length), r.matchSessions ? `${r.matchSessions} partite` : undefined],
    ['RPE medio', n1(r.rpeAvg)],
    ['TL medio', n0(r.tlAvg)],
    ['Risposte', pct],
    ['Sopra · zona · sotto', `${r.zones.high} · ${r.zones.ok} · ${r.zones.low}`],
  ]);

  // grafico squadra
  y += 8;
  text('Carico della squadra', M, y, { size: 10.5, bold: true });
  text('TL medio per seduta e media mobile della squadra', M + 44, y, { size: 8, color: C.muted });
  y += 4;
  legend(y + 1, [
    [C.tl, 'Allenamento', 'bar'],
    [C.tl, 'Partita', 'hatch'],
    [C.team, `Media squadra ${r.windowDays} gg`, 'dash'],
  ]);
  y += 5;
  const tDates = r.teamDays.map((d) => d.date);
  const tMax = niceMax(Math.max(0, ...r.teamDays.flatMap((d) => [d.avg ?? 0, d.teamRol ?? 0])));
  const chartX = M + 9;
  const chartW = W - M - chartX;
  if (r.teamDays.length) {
    const f = frame(chartX, y, chartW, 42, tMax, [0, tMax / 2, tMax], tDates, (v) => String(Math.round(v)), true);
    const bw = Math.min(6, f.step * 0.62);
    r.teamDays.forEach((d, i) => {
      if (!d.avg) return;
      if (d.type === 'partita') return hatchRect(f.cx(i) - bw / 2, f.cy(d.avg), bw, f.cy(0) - f.cy(d.avg));
      doc.setFillColor(...C.tl);
      doc.rect(f.cx(i) - bw / 2, f.cy(d.avg), bw, f.cy(0) - f.cy(d.avg), 'F');
    });
    polyline(
      r.teamDays.map((d, i) => (d.teamRol != null ? { x: f.cx(i), y: f.cy(d.teamRol) } : null)),
      C.team,
      0.6,
      [1.2, 0.9],
    );
    y += 50;
  } else {
    text('Nessuna seduta con RPE nel periodo.', M, y + 8, { color: C.muted });
    y += 16;
  }

  // tabella atleti
  y += 4;
  text('Atleti', M, y, { size: 10.5, bold: true });
  text('ordine alfabetico · indicatori all\'ultimo giorno del periodo', M + 14, y, { size: 8, color: C.muted });
  y += 3;
  const withGames = r.liveGames > 0;
  type Col = { h: string; w: number; a?: 'left' | 'right' | 'center'; v: (a: AthleteLoad) => string; dot?: (a: AthleteLoad) => number | null };
  const cols: Col[] = [
    { h: 'Atleta', w: withGames ? 40 : 52, a: 'left', v: (a) => `${a.player.number ? `${a.player.number}  ` : ''}${surnameFirst(a.player.name)}` },
    { h: 'Risposte', w: 15, v: (a) => `${a.answered}/${a.answered + a.missing}` },
    { h: 'RPE m.', w: 13, v: (a) => n1(a.rpeAvg) },
    { h: 'TL tot.', w: 15, v: (a) => n0(a.answered ? a.tlTotal : null) },
    { h: 'TL m.', w: 13, v: (a) => n0(a.tlAvg) },
    { h: 'Media pers.', w: 17, v: (a) => n0(a.last?.rolAvg) },
    { h: 'Work Load', w: 17, v: (a) => (a.answered ? n2(a.last?.acwr) : '–'), dot: (a) => (a.answered ? (a.last?.acwr ?? null) : null) },
    { h: 'Zona', w: 18, a: 'left', v: (a) => {
        const z = a.answered ? acwrZone(a.last?.acwr ?? null) : null;
        return z ? ZONE_TXT[z] : '–';
      } },
    { h: 'Gg >1,3', w: 13, v: (a) => (a.answered ? String(a.daysHigh) : '–') },
  ];
  if (withGames)
    cols.push(
      { h: 'Partite', w: 12, v: (a) => (a.matches.length ? String(a.matches.filter((m) => m.playedMs > 0).length) : '–') },
      { h: 'Minuti', w: 13, v: (a) => (a.matches.length ? mmss(a.playedMs) : '–') },
      { h: 'INT m.', w: 12, v: (a) => (a.intAvg == null ? '–' : fmtInt(a.intAvg)) },
    );
  const totalW = cols.reduce((t, c) => t + c.w, 0);
  const scale = (W - 2 * M) / totalW;
  cols.forEach((c) => (c.w *= scale));

  const tableHeader = () => {
    doc.setFillColor(...primary);
    doc.rect(M, y, W - 2 * M, 7, 'F');
    let x = M;
    for (const c of cols) {
      const a = c.a ?? 'right';
      text(c.h, a === 'left' ? x + 2 : x + c.w - 2, y + 4.7, { size: 7, bold: true, color: onPrimary, align: a });
      x += c.w;
    }
    y += 7;
  };
  tableHeader();
  r.athletes.forEach((a, k) => {
    if (y > H - 30) {
      doc.addPage();
      y = 14;
      tableHeader();
    }
    if (k % 2 === 1) {
      doc.setFillColor(246, 247, 249);
      doc.rect(M, y, W - 2 * M, 6.4, 'F');
    }
    let x = M;
    for (const c of cols) {
      const a2 = c.a ?? 'right';
      const val = c.v(a);
      const zoneColor = c.h === 'Zona' && a.answered ? acwrZone(a.last?.acwr ?? null) : null;
      const label = c.h === 'Atleta' ? (doc.splitTextToSize(val, c.w - 3)[0] as string) : val;
      text(label, a2 === 'left' ? x + 2 : x + c.w - 2, y + 4.4, { size: 7.8, bold: c.h === 'Atleta' || c.h === 'Work Load', color: zoneColor ? ZONE_RGB[zoneColor] : a.answered ? C.ink : C.muted, align: a2 });
      if (c.dot) {
        const v = c.dot(a);
        if (v != null) zoneDot(x + c.w - 2 - doc.getTextWidth(val) - 2.2, y + 3.3, v);
      }
      x += c.w;
    }
    y += 6.4;
  });

  // legenda
  y += 5;
  if (y > H - 34) {
    doc.addPage();
    y = 16;
  }
  const notes = [
    'TL = RPE × minuti. Media personale = media dei TL dell\'atleta negli ultimi giorni della media mobile; Media squadra = media di tutti i TL della squadra',
    `nello stesso periodo; Work Load = TL del giorno ÷ media personale (senza RPE resta il valore precedente). Fascia ideale ${String(LOAD_CONFIG.lowerLimit).replace('.', ',')}–${String(LOAD_CONFIG.upperLimit).replace('.', ',')}.`,
    'Risposte = sedute del periodo con RPE. Gg >1,3 = giorni con RPE e Work Load sopra 1,3.' + (withGames ? ' Partite, minuti e INT medio dalle partite monitorate con Courtlab.' : ''),
  ];
  notes.forEach((l, i) => text(l, M, y + i * 3.8, { size: 7, color: C.muted }));

  // ───────────────────────── Pagine atleta ─────────────────────────
  if (input.athletePages) {
    const only = input.onlyAthletes ? new Set(input.onlyAthletes) : null;
    for (const a of r.athletes) {
      if (only && !only.has(a.player.id!)) continue;
      if (!a.answered && !a.matches.length) continue;
      doc.addPage();
      header('CARICO INTERNO (sRPE) · ATLETA', `${a.player.number ? `#${a.player.number}  ` : ''}${surnameFirst(a.player.name)}`, 28);
      y = 35;
      const z = a.answered ? acwrZone(a.last?.acwr ?? null) : null;
      y = tiles(y, [
        ['Risposte', `${a.answered}/${a.answered + a.missing}`],
        ['RPE medio', n1(a.rpeAvg)],
        ['TL totale', n0(a.answered ? a.tlTotal : null), `medio ${n0(a.tlAvg)}`],
        ['Media personale', n0(a.last?.rolAvg)],
        ['Work Load', a.answered ? n2(a.last?.acwr) : '–', z ? ZONE_TXT[z] : undefined],
      ]);
      if (z) {
        // colore dello stato sul riquadro del Work Load
        const w = (W - 2 * M - 12) / 5;
        doc.setFillColor(...ZONE_RGB[z]);
        doc.rect(M + 4 * (w + 3), y - 17, 1.3, 17, 'F');
      }

      // grafico carico
      const days = a.series;
      const dates = days.map((d) => d.date);
      const typeOf = new Map(a.rows.map((row) => [row.date, row.type]));
      y += 8;
      text('Carico', M, y, { size: 10.5, bold: true });
      legend(y + 5, [
        [C.tl, 'TL allenamento', 'bar'],
        [C.tl, 'TL partita', 'hatch'],
        [C.personal, 'Media personale', 'line'],
        [C.team, 'Media squadra', 'dash'],
      ]);
      y += 9;
      if (days.length) {
        const max = niceMax(Math.max(0, ...days.flatMap((d) => [d.tl ?? 0, d.rolAvg ?? 0, d.teamRol ?? 0])));
        const f = frame(chartX, y, chartW, 46, max, [0, max / 2, max], dates, (v) => String(Math.round(v)), false);
        const bw = Math.min(6, f.step * 0.62);
        days.forEach((d, i) => {
          if (!d.tl) return;
          if (typeOf.get(d.date) === 'partita') return hatchRect(f.cx(i) - bw / 2, f.cy(d.tl), bw, f.cy(0) - f.cy(d.tl));
          doc.setFillColor(...C.tl);
          doc.rect(f.cx(i) - bw / 2, f.cy(d.tl), bw, f.cy(0) - f.cy(d.tl), 'F');
        });
        polyline(days.map((d, i) => (d.teamRol != null ? { x: f.cx(i), y: f.cy(d.teamRol) } : null)), C.team, 0.6, [1.2, 0.9]);
        polyline(days.map((d, i) => (d.rolAvg != null ? { x: f.cx(i), y: f.cy(d.rolAvg) } : null)), C.personal, 0.7);
        y += 52;

        // grafico Work Load
        text('Work Load', M, y, { size: 10.5, bold: true });
        legend(y + 5, [
          [C.ok, `Zona ${String(LOAD_CONFIG.lowerLimit).replace('.', ',')}–${String(LOAD_CONFIG.upperLimit).replace('.', ',')}`, 'band'],
          [C.high, 'Sopra', 'dot'],
          [C.ok, 'In zona', 'dot'],
          [C.low, 'Sotto', 'dot'],
        ]);
        y += 9;
        const wMax = Math.max(2, Math.ceil(Math.max(0, ...days.map((d) => d.acwr ?? 0)) * 2) / 2);
        const g = frame(chartX, y, chartW, 30, wMax, [0, LOAD_CONFIG.lowerLimit, LOAD_CONFIG.upperLimit, wMax], dates, (v) => String(v).replace('.', ','), true);
        doc.setFillColor(...mix(C.ok, [255, 255, 255], 0.86));
        doc.rect(chartX, g.cy(LOAD_CONFIG.upperLimit), chartW, g.cy(LOAD_CONFIG.lowerLimit) - g.cy(LOAD_CONFIG.upperLimit), 'F');
        polyline(days.map((d, i) => (d.acwr != null ? { x: g.cx(i), y: g.cy(d.acwr) } : null)), C.wl, 0.5);
        days.forEach((d, i) => {
          const zz = acwrZone(d.acwr);
          if (!zz) return;
          doc.setFillColor(...(d.tl == null ? ([255, 255, 255] as RGB) : ZONE_RGB[zz]));
          doc.setDrawColor(...ZONE_RGB[zz]);
          doc.setLineWidth(0.35);
          doc.circle(g.cx(i), g.cy(d.acwr!), 0.95, d.tl == null ? 'FD' : 'F');
        });
        y += 38;
      } else {
        text('Nessun RPE nel periodo.', M, y + 6, { color: C.muted });
        y += 12;
      }

      // dettaglio sedute
      text('Seduta per seduta', M, y, { size: 10.5, bold: true });
      y += 3;
      const byDate = new Map(days.map((d) => [d.date, d]));
      const dcols: [string, number, 'left' | 'right'][] = [
        ['Data', 26, 'left'],
        ['Tipo', 34, 'left'],
        ['RPE', 14, 'right'],
        ['Minuti', 16, 'right'],
        ['TL', 18, 'right'],
        ['Media pers.', 24, 'right'],
        ['Media squadra', 26, 'right'],
        ['Work Load', 32, 'right'],
      ];
      const dHeader = () => {
        doc.setFillColor(...light);
        doc.rect(M, y, W - 2 * M, 6, 'F');
        let x = M;
        for (const [h, w, al] of dcols) {
          text(h, al === 'left' ? x + 2 : x + w - 2, y + 4.1, { size: 7, bold: true, color: C.muted, align: al });
          x += w;
        }
        y += 6;
      };
      dHeader();
      for (const row of [...a.rows].reverse()) {
        if (y > H - 22) {
          doc.addPage();
          y = 14;
          dHeader();
        }
        const d = byDate.get(row.date);
        const vals = [dm(row.date) + '/' + row.date.slice(2, 4), SESSION_TYPE_LABEL[row.type], row.rpe == null ? '–' : n1(row.rpe).replace(',0', ''), String(row.minutes), n0(row.tl), n0(d?.rolAvg), n0(d?.teamRol), n2(d?.acwr)];
        let x = M;
        dcols.forEach(([, w, al], k) => {
          text(vals[k], al === 'left' ? x + 2 : x + w - 2, y + 4, { size: 7.6, color: row.rpe == null ? C.muted : C.ink, bold: k === 4, align: al });
          if (k === 7 && d?.acwr != null) zoneDot(x + w - 2 - doc.getTextWidth(vals[k]) - 2.2, y + 2.9, d.acwr);
          x += w;
        });
        doc.setDrawColor(...C.grid);
        doc.setLineWidth(0.1);
        doc.line(M, y + 5.6, W - M, y + 5.6);
        y += 5.6;
      }

      // partite monitorate
      if (a.matches.length) {
        y += 6;
        if (y > H - 30) {
          doc.addPage();
          y = 16;
        }
        text('Partite monitorate', M, y, { size: 10.5, bold: true });
        y += 5;
        for (const m of a.matches) {
          text(`${dm(m.date)}  vs ${m.opponent}`, M, y, { size: 8 });
          text(`${mmss(m.playedMs)} min · INT medio ${m.intAvg == null ? '–' : fmtInt(m.intAvg)} · picco ${fmtInt(m.intPeak)}`, W - M, y, { size: 8, color: C.muted, align: 'right' });
          y += 4.6;
        }
      }
    }
  }

  // piè di pagina
  const pages = doc.getNumberOfPages();
  const when = input.generatedAt ?? new Date();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setDrawColor(...accent);
    doc.setLineWidth(0.4);
    doc.line(M, H - 12, W - M, H - 12);
    text(`${APP.name} · ${APP.credit} · ${r.team.name} · generato il ${when.toLocaleDateString('it-IT')} alle ${when.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}`, M, H - 7.5, { size: 7.5, color: C.muted });
    text(`Pagina ${i} di ${pages}`, W - M, H - 7.5, { size: 7.5, color: C.muted, align: 'right' });
  }
  return doc;
}
