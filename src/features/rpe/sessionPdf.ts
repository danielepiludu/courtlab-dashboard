/**
 * PDF di una singola seduta RPE (A4 verticale, sfondo bianco):
 * intestazione con squadra, tipo e data; riepilogo; tabella degli atleti in ordine di cognome
 * con RPE (barra colorata), descrizione, minuti, TL e Work Load del giorno.
 */
import type { jsPDF as JsPDF } from 'jspdf';
import { contrast, darken, hexToRgb, normalizeHex } from '@/theme/color';
import { RPE_SCALE, acwrZone, entryTL } from '@/engine/load';
import { APP } from '@/config';
import { SESSION_TYPE_LABEL, compareSurname, surnameFirst, type Player, type RpeEntry, type Team, type TrainingSession } from '@/db/types';
import { fmtLong } from '@/lib/dates';
import { printColor } from '@/features/report/pdf';

type RGB = [number, number, number];
const rgb = (hex: string): RGB => {
  const c = hexToRgb(hex);
  return [c.r, c.g, c.b];
};
const mix = (a: RGB, b: RGB, t: number): RGB => [0, 1, 2].map((i) => Math.round(a[i] + (b[i] - a[i]) * t)) as RGB;
const INK: RGB = [28, 32, 40];
const MUTED: RGB = [110, 118, 132];
const ZONE_RGB = { high: [214, 32, 32] as RGB, ok: [30, 150, 90] as RGB, low: [222, 140, 0] as RGB };
const ZONE_TXT = { high: 'sopra 1,3', ok: 'in zona', low: 'sotto 0,8' } as const;
const n1 = (v: number) => v.toFixed(1).replace('.', ',').replace(',0', '');

export interface SessionPdfInput {
  session: TrainingSession;
  team: Pick<Team, 'name' | 'season' | 'primary' | 'secondary'>;
  players: Player[];
  /** RPE di questa seduta */
  entries: RpeEntry[];
  /** Work Load del giorno per atleta (stesse formule dell'analisi) */
  workLoad?: Map<number, number | null>;
  logo?: string | null;
  generatedAt?: Date;
  compress?: boolean;
}

/** Colori della squadra adatti alla stampa su carta bianca. */
export function sessionPalette(team: Pick<Team, 'primary' | 'secondary'>) {
  const primary = normalizeHex(team.primary) ?? '#002855';
  const secondary = normalizeHex(team.secondary) ?? '#ee3239';
  const accent = contrast(secondary, '#ffffff') >= 2.4 ? secondary : contrast(primary, '#ffffff') >= 2.4 ? primary : darken(secondary, 0.45);
  const onPrimary = contrast('#ffffff', primary) >= contrast('#111111', primary) ? '#ffffff' : '#111111';
  return { primary, accent, onPrimary };
}

/** Righe e totali della seduta (atleti in ordine di cognome), usati da PDF e stampa. */
export function sessionSummary(input: Pick<SessionPdfInput, 'session' | 'players' | 'entries' | 'workLoad'>) {
  const s = input.session;
  const players = [...input.players].sort(compareSurname);
  const byPlayer = new Map(input.entries.filter((e) => e.sessionId === s.id).map((e) => [e.playerId, e]));
  const rows = players.map((p) => {
    const e = byPlayer.get(p.id!);
    const rpe = e?.rpe ?? null;
    const minutes = e?.minutes ?? s.minutes;
    return { p, rpe, minutes, tl: entryTL({ rpe, minutes }), wl: input.workLoad?.get(p.id!) ?? null, label: rpe != null ? (RPE_SCALE.find((v) => v.value === rpe)?.label ?? '') : '' };
  });
  const answered = rows.filter((r) => r.rpe != null);
  const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
  return {
    rows,
    answered,
    rpeAvg: avg(answered.map((r) => r.rpe as number)),
    tlAvg: avg(answered.map((r) => r.tl ?? 0)),
    tlTot: answered.reduce((t, r) => t + (r.tl ?? 0), 0),
    hasWl: rows.some((r) => r.wl != null),
  };
}

export function sessionPdfFileName(s: TrainingSession): string {
  return `rpe-${s.type === 'partita' ? 'partita' : 'allenamento'}-${s.date}.pdf`;
}

export async function buildSessionPdf(input: SessionPdfInput): Promise<JsPDF> {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait', compress: input.compress ?? true });
  const { session: s, team } = input;
  const W = 210;
  const H = 297;
  const M = 12;
  const pal = sessionPalette(team);
  const primary = rgb(pal.primary);
  const accent = rgb(pal.accent);
  const onPrimary = rgb(pal.onPrimary);
  const light = mix(primary, [255, 255, 255], 0.92);

  const text = (t: string, x: number, y: number, o: { size?: number; bold?: boolean; color?: RGB; align?: 'left' | 'right' | 'center' } = {}) => {
    doc.setFont('helvetica', o.bold ? 'bold' : 'normal');
    doc.setFontSize(o.size ?? 9);
    doc.setTextColor(...(o.color ?? INK));
    doc.text(t, x, y, { align: o.align ?? 'left' });
  };

  // ── intestazione ──
  doc.setFillColor(...primary);
  doc.rect(0, 0, W, 30, 'F');
  doc.setFillColor(...accent);
  doc.rect(0, 30, W, 1.4, 'F');
  let tx = M;
  if (input.logo) {
    try {
      doc.addImage(input.logo, /^data:image\/jpe?g/.test(input.logo) ? 'JPEG' : 'PNG', M, 5, 20, 20, undefined, 'FAST');
      tx = M + 25;
    } catch {
      /* logo non valido */
    }
  }
  text(`RPE · ${SESSION_TYPE_LABEL[s.type].toUpperCase()}`, tx, 11, { size: 8.5, bold: true, color: onPrimary });
  text(fmtLong(s.date), tx, 19, { size: 16, bold: true, color: onPrimary });
  text(`${team.name} · durata ${s.minutes} min`, tx, 25.5, { size: 9, color: onPrimary });
  text(APP.name, W - M, 11, { size: 8.5, color: onPrimary, align: 'right' });

  // ── riepilogo ──
  const { rows, answered, rpeAvg, tlAvg, tlTot, hasWl } = sessionSummary(input);

  let y = 38;
  const tiles: [string, string][] = [
    ['Risposte', `${answered.length}/${rows.length}`],
    ['RPE medio', rpeAvg == null ? '–' : rpeAvg.toFixed(1).replace('.', ',')],
    ['TL medio', tlAvg == null ? '–' : String(Math.round(tlAvg))],
    ['TL totale', answered.length ? Math.round(tlTot).toLocaleString('it-IT') : '–'],
  ];
  const gap = 3;
  const tw = (W - 2 * M - gap * (tiles.length - 1)) / tiles.length;
  tiles.forEach(([label, value], k) => {
    const x = M + k * (tw + gap);
    doc.setFillColor(...light);
    doc.roundedRect(x, y, tw, 16, 2, 2, 'F');
    text(label.toUpperCase(), x + 3, y + 5, { size: 6.5, bold: true, color: MUTED });
    text(value, x + 3, y + 12.5, { size: 14, bold: true, color: k === 1 && rpeAvg != null ? printColor(rpeAvg / 10) : INK });
  });
  y += 24;

  // ── tabella ──
  const cols: { h: string; w: number; a: 'left' | 'right' | 'center' }[] = [
    { h: 'N.', w: 10, a: 'center' },
    { h: 'Atleta', w: 50, a: 'left' },
    { h: 'RPE', w: 40, a: 'left' },
    { h: 'Percezione', w: 38, a: 'left' },
    { h: 'Min', w: 12, a: 'right' },
    { h: 'TL', w: 16, a: 'right' },
    ...(hasWl ? [{ h: 'Work Load', w: 20, a: 'right' as const }] : []),
  ];
  const scale = (W - 2 * M) / cols.reduce((t, c) => t + c.w, 0);
  cols.forEach((c) => (c.w *= scale));
  const rowH = 7.2;
  const header = () => {
    doc.setFillColor(...primary);
    doc.rect(M, y, W - 2 * M, 7, 'F');
    let x = M;
    for (const c of cols) {
      text(c.h, c.a === 'left' ? x + 2 : c.a === 'right' ? x + c.w - 2 : x + c.w / 2, y + 4.7, { size: 7.5, bold: true, color: onPrimary, align: c.a });
      x += c.w;
    }
    y += 7;
  };
  header();
  rows.forEach((r, i) => {
    if (y + rowH > H - 22) {
      doc.addPage();
      y = 14;
      header();
    }
    if (i % 2 === 1) {
      doc.setFillColor(246, 247, 249);
      doc.rect(M, y, W - 2 * M, rowH, 'F');
    }
    const mid = y + rowH / 2 + 1.3;
    const muted = r.rpe == null;
    let x = M;
    // numero
    text(r.p.number || '–', x + cols[0].w / 2, mid, { size: 8.5, bold: true, color: muted ? MUTED : accent, align: 'center' });
    x += cols[0].w;
    // atleta
    text(doc.splitTextToSize(surnameFirst(r.p.name), cols[1].w - 3)[0] as string, x + 2, mid, { size: 8.8, bold: !muted, color: muted ? MUTED : INK });
    x += cols[1].w;
    // RPE: barra + valore
    if (r.rpe != null) {
      const bw = cols[2].w - 14;
      doc.setFillColor(232, 235, 240);
      doc.roundedRect(x + 2, y + rowH / 2 - 0.9, bw, 1.8, 0.9, 0.9, 'F');
      doc.setFillColor(...printColor(r.rpe / 10));
      doc.roundedRect(x + 2, y + rowH / 2 - 0.9, Math.max(1.8, (bw * r.rpe) / 10), 1.8, 0.9, 0.9, 'F');
      text(n1(r.rpe), x + cols[2].w - 2, mid, { size: 10, bold: true, color: printColor(r.rpe / 10), align: 'right' });
    } else {
      text('–', x + 2, mid, { color: MUTED });
    }
    x += cols[2].w;
    // percezione
    text(r.rpe != null ? r.label : 'Nessuna risposta', x + 2, mid, { size: 8, color: muted ? MUTED : INK });
    x += cols[3].w;
    // minuti, TL
    text(String(r.minutes), x + cols[4].w - 2, mid, { size: 8.5, color: muted ? MUTED : INK, align: 'right' });
    x += cols[4].w;
    text(r.tl != null ? String(Math.round(r.tl)) : '–', x + cols[5].w - 2, mid, { size: 8.8, bold: !muted, color: muted ? MUTED : INK, align: 'right' });
    x += cols[5].w;
    // Work Load
    if (hasWl) {
      const z = acwrZone(r.wl);
      if (r.wl != null && z && !muted) {
        const v = r.wl.toFixed(2).replace('.', ',');
        text(v, x + cols[6].w - 2, mid, { size: 8.8, bold: true, align: 'right' });
        doc.setFillColor(...ZONE_RGB[z]);
        doc.circle(x + cols[6].w - 2 - doc.getTextWidth(v) - 2.2, mid - 1.1, 1.05, 'F');
      } else text('–', x + cols[6].w - 2, mid, { color: MUTED, align: 'right' });
    }
    y += rowH;
  });

  // ── note ──
  y += 6;
  if (y > H - 30) {
    doc.addPage();
    y = 16;
  }
  const notes = [
    'RPE = fatica percepita (scala CR-10, 0–10). TL = RPE × minuti.',
    ...(hasWl ? [`Work Load = TL del giorno ÷ media personale; punto: rosso ${ZONE_TXT.high}, verde ${ZONE_TXT.ok}, arancio ${ZONE_TXT.low}.`] : []),
  ];
  notes.forEach((l, i) => text(l, M, y + i * 4, { size: 7.5, color: MUTED }));

  // ── piè di pagina ──
  const pages = doc.getNumberOfPages();
  const when = input.generatedAt ?? new Date();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setDrawColor(...accent);
    doc.setLineWidth(0.4);
    doc.line(M, H - 12, W - M, H - 12);
    text(`${APP.name} · ${APP.credit} · generato il ${when.toLocaleDateString('it-IT')} alle ${when.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}`, M, H - 7.5, { size: 7.5, color: MUTED });
    text(`Pagina ${i} di ${pages}`, W - M, H - 7.5, { size: 7.5, color: MUTED, align: 'right' });
  }
  return doc;
}
