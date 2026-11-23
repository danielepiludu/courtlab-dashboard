/**
 * Resoconto in PDF (A4 verticale, sfondo bianco per la stampa):
 * intestazione nel colore primario della squadra con il logo, dettagli nel colore secondario,
 * punteggio, migliori della partita, tabella dei convocati con mini-grafico dell'INT.
 */
import { surnameFirst } from '@/db/types';
import type { jsPDF as JsPDF } from 'jspdf';
import type { Game, Team } from '@/db/types';
import { contrast, hexToRgb, normalizeHex, darken } from '@/theme/color';
import { fmtInt } from '@/engine/int';
import { fmtLong } from '@/lib/dates';
import { mmss } from '@/features/live/liveModel';
import { APP } from '@/config';
import type { PlayerSummary, ReportSummary } from './reportModel';

export interface PdfInput {
  summary: ReportSummary;
  team: Pick<Team, 'name' | 'season' | 'primary' | 'secondary'>;
  game: Pick<Game, 'date' | 'time' | 'opponent' | 'home'>;
  /** logo come data URL PNG/JPEG (facoltativo) */
  logo?: string | null;
  generatedAt?: Date;
  /** compressione dei contenuti (default sì; i test la disattivano per leggere il testo) */
  compress?: boolean;
}

type RGB = [number, number, number];
const rgb = (hex: string): RGB => {
  const c = hexToRgb(hex);
  return [c.r, c.g, c.b];
};
const mixRgb = (a: RGB, b: RGB, t: number): RGB => [0, 1, 2].map((i) => Math.round(a[i] + (b[i] - a[i]) * t)) as RGB;

/** Scala INT per la stampa (su carta bianca il bianco non si vedrebbe): grigio → giallo → arancio → rosso. */
const PRINT_STOPS: [number, RGB][] = [
  [0, [190, 196, 204]],
  [0.35, [235, 185, 0]],
  [0.65, [240, 124, 0]],
  [1, [214, 32, 32]],
];
export function printColor(v: number): RGB {
  const x = Math.min(1, Math.max(0, v));
  for (let i = 1; i < PRINT_STOPS.length; i++) {
    const [b, cb] = PRINT_STOPS[i];
    const [a, ca] = PRINT_STOPS[i - 1];
    if (x <= b) return mixRgb(ca, cb, (x - a) / (b - a));
  }
  return PRINT_STOPS[PRINT_STOPS.length - 1][1];
}

const OUTCOME = { W: 'Vittoria', L: 'Sconfitta', D: 'Pareggio' } as const;

export function pdfFileName(input: PdfInput): string {
  const slug = (s: string) =>
    s
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 40);
  return `resoconto-${slug(input.team.name)}-vs-${slug(input.game.opponent)}-${input.game.date}.pdf`;
}

/** Crea il documento PDF (funziona anche fuori dal browser, utile per i test). */
export async function buildReportPdf(input: PdfInput): Promise<JsPDF> {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait', compress: input.compress ?? true });
  const { summary: s, team, game } = input;
  const W = 210;
  const M = 10;
  const primaryHex = normalizeHex(team.primary) ?? '#002855';
  const secondaryHex = normalizeHex(team.secondary) ?? '#ee3239';
  const primary = rgb(primaryHex);
  // dettagli: secondario, ma se è troppo chiaro sul bianco si usa il primario (o un secondario scurito)
  const accentHex = contrast(secondaryHex, '#ffffff') >= 2.4 ? secondaryHex : contrast(primaryHex, '#ffffff') >= 2.4 ? primaryHex : darken(secondaryHex, 0.45);
  const accent = rgb(accentHex);
  const onPrimary: RGB = contrast('#ffffff', primaryHex) >= contrast('#111111', primaryHex) ? [255, 255, 255] : [17, 17, 17];
  const ink: RGB = [28, 32, 40];
  const muted: RGB = [110, 118, 132];
  const light: RGB = mixRgb(primary, [255, 255, 255], 0.9);

  // ---------- Intestazione ----------
  doc.setFillColor(...primary);
  doc.rect(0, 0, W, 34, 'F');
  doc.setFillColor(...accent);
  doc.rect(0, 34, W, 1.6, 'F');
  let tx = M;
  if (input.logo) {
    try {
      const fmt = input.logo.startsWith('data:image/jpeg') || input.logo.startsWith('data:image/jpg') ? 'JPEG' : 'PNG';
      doc.addImage(input.logo, fmt, M, 5, 24, 24, undefined, 'FAST');
      tx = M + 29;
    } catch {
      /* logo non valido: si prosegue senza */
    }
  }
  doc.setTextColor(...onPrimary);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('RESOCONTO PARTITA', tx, 12);
  doc.setFontSize(17);
  doc.text(doc.splitTextToSize(team.name, W - tx - M - 30)[0] as string, tx, 20);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(`Stagione ${team.season}`, tx, 26.5);
  doc.setFontSize(9);
  doc.text(APP.name, W - M, 12, { align: 'right' });

  // ---------- Punteggio ----------
  let y = 47;
  const us = team.name.length > 26 ? `${team.name.slice(0, 25)}…` : team.name;
  const them = game.opponent.length > 26 ? `${game.opponent.slice(0, 25)}…` : game.opponent;
  doc.setTextColor(...ink);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text(game.home ? us : them, W / 2 - 22, y, { align: 'right' });
  doc.text(game.home ? them : us, W / 2 + 22, y, { align: 'left' });
  doc.setFontSize(26);
  const left = game.home ? s.us : s.them;
  const right = game.home ? s.them : s.us;
  doc.text(`${left} – ${right}`, W / 2, y + 2, { align: 'center' });
  y += 9;
  const outColor: RGB = s.outcome === 'W' ? [30, 150, 90] : s.outcome === 'L' ? [200, 40, 45] : muted;
  doc.setFontSize(11);
  doc.setTextColor(...outColor);
  doc.text(OUTCOME[s.outcome].toUpperCase(), W / 2, y, { align: 'center' });
  y += 6;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(...muted);
  const periodi = s.overtimes ? `${Math.min(s.periods, 4)} quarti + ${s.overtimes} supplementar${s.overtimes === 1 ? 'e' : 'i'}` : `${s.periods} ${s.periods === 1 ? 'quarto' : 'quarti'}`;
  const durata = `durata ${Math.floor(s.durationMs / 3_600_000) ? `${Math.floor(s.durationMs / 3_600_000)} h ` : ''}${Math.round((s.durationMs % 3_600_000) / 60_000)} min`;
  doc.text(`${fmtLong(game.date)} · ore ${game.time} · ${game.home ? 'in casa' : 'in trasferta'} · ${periodi} · ${durata}`, W / 2, y, { align: 'center' });

  // ---------- Migliori ----------
  y += 7;
  const boxes: [string, PlayerSummary | undefined, string][] = [
    ['Più minuti', s.leaders.minutes, s.leaders.minutes ? mmss(s.leaders.minutes.playedMs) : '–'],
    ['INT di picco', s.leaders.peak, s.leaders.peak ? fmtInt(s.leaders.peak.intPeak) : '–'],
    ['Più ingressi', s.leaders.entries, s.leaders.entries ? String(s.leaders.entries.entries) : '–'],
  ];
  const bw = (W - 2 * M - 8) / 3;
  boxes.forEach(([label, p, value], i) => {
    const bx = M + i * (bw + 4);
    doc.setFillColor(...light);
    doc.roundedRect(bx, y, bw, 15, 2, 2, 'F');
    doc.setFillColor(...accent);
    doc.rect(bx, y + 2, 1.2, 11, 'F');
    doc.setFontSize(8);
    doc.setTextColor(...muted);
    doc.setFont('helvetica', 'bold');
    doc.text(label.toUpperCase(), bx + 4, y + 5.2);
    doc.setTextColor(...ink);
    doc.setFontSize(10);
    doc.text(p ? `#${p.number} ${surnameFirst(p.name)}`.slice(0, 30) : '–', bx + 4, y + 11);
    doc.setFontSize(13);
    doc.text(value, bx + bw - 3, y + 11, { align: 'right' });
  });
  y += 22;

  // ---------- Tabella ----------
  const cols = [
    { k: '#', w: 10, a: 'center' as const },
    { k: 'Giocatore', w: 50, a: 'left' as const },
    { k: 'Ruolo', w: 13, a: 'center' as const },
    { k: 'Minuti', w: 17, a: 'center' as const },
    { k: 'Ingr.', w: 13, a: 'center' as const },
    { k: 'INT medio', w: 22, a: 'center' as const },
    { k: 'INT picco', w: 22, a: 'center' as const },
    { k: 'Andamento INT', w: 43, a: 'center' as const },
  ];
  const rowH = 9;
  const header = () => {
    doc.setFillColor(...primary);
    doc.rect(M, y, W - 2 * M, 7.5, 'F');
    doc.setTextColor(...onPrimary);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    let cx = M;
    for (const c of cols) {
      const xx = c.a === 'left' ? cx + 2 : cx + c.w / 2;
      if (c.k === 'Andamento INT' && s.periodSpans.length) {
        // al posto del titolo: Q1, Q2… sopra ciascun quarto
        const gx = cx + 2;
        const gw = c.w - 4;
        const dur = Math.max(1, s.durationMs);
        doc.setFontSize(7.5);
        for (const sp of s.periodSpans) doc.text(sp.label, gx + (((sp.from + sp.to) / 2) / dur) * gw, y + 5, { align: 'center' });
        doc.setFontSize(8.5);
      } else doc.text(c.k, xx, y + 5, { align: c.a });
      cx += c.w;
    }
    y += 7.5;
  };
  header();

  const intCell = (v: number, cx: number, w: number) => {
    if (Number.isNaN(v)) {
      doc.setTextColor(...muted);
      doc.setFont('helvetica', 'normal');
      doc.text('–', cx + w / 2, y + rowH / 2 + 1.3, { align: 'center' });
      return;
    }
    const bwid = w - 12;
    doc.setFillColor(232, 235, 240);
    doc.roundedRect(cx + 2, y + rowH / 2 + 1.2, bwid, 1.6, 0.8, 0.8, 'F');
    if (v > 0.005) {
      doc.setFillColor(...printColor(v));
      doc.roundedRect(cx + 2, y + rowH / 2 + 1.2, Math.max(1.6, bwid * v), 1.6, 0.8, 0.8, 'F');
    }
    doc.setTextColor(...ink);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.text(fmtInt(v), cx + w - 2, y + rowH / 2 + 0.6, { align: 'right' });
  };

  s.players.forEach((p, i) => {
    if (y + rowH > 297 - 22) {
      doc.addPage();
      y = 14;
      header();
    }
    if (i % 2 === 0) {
      doc.setFillColor(246, 247, 250);
      doc.rect(M, y, W - 2 * M, rowH, 'F');
    }
    let cx = M;
    const mid = y + rowH / 2 + 1.3;
    doc.setTextColor(...ink);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(...accent);
    doc.text(p.number || '–', cx + cols[0].w / 2, mid, { align: 'center' });
    cx += cols[0].w;
    doc.setTextColor(...ink);
    doc.setFont('helvetica', p.starter ? 'bold' : 'normal');
    doc.text((doc.splitTextToSize(surnameFirst(p.name), cols[1].w - 9)[0] as string) ?? '', cx + 2, mid);
    if (p.starter) {
      doc.setFontSize(6.5);
      doc.setTextColor(...muted);
      doc.text('T', cx + cols[1].w - 3, mid, { align: 'right' });
    }
    cx += cols[1].w;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    doc.setTextColor(...muted);
    doc.text(p.role, cx + cols[2].w / 2, mid, { align: 'center' });
    cx += cols[2].w;
    doc.setTextColor(...ink);
    doc.setFont('helvetica', 'bold');
    doc.text(mmss(p.playedMs), cx + cols[3].w / 2, mid, { align: 'center' });
    cx += cols[3].w;
    doc.setFont('helvetica', 'normal');
    doc.text(String(p.entries), cx + cols[4].w / 2, mid, { align: 'center' });
    cx += cols[4].w;
    intCell(p.intAvg, cx, cols[5].w);
    cx += cols[5].w;
    intCell(p.intPeak, cx, cols[6].w);
    cx += cols[6].w;
    // mini-grafico
    const gx = cx + 2;
    const gw = cols[7].w - 4;
    const gy = y + 1.2;
    const gh = rowH - 2.4;
    doc.setFillColor(238, 240, 244);
    doc.rect(gx, gy, gw, gh, 'F');
    const dur = Math.max(1, s.durationMs);
    const px = (t: number) => gx + (t / dur) * gw;
    const py = (v: number) => gy + gh - v * gh;
    // quarti: alterni più scuri, pause tra i quarti grigie
    s.periodSpans.forEach((sp, k) => {
      if (k % 2 === 1) {
        doc.setFillColor(228, 231, 236);
        doc.rect(px(sp.from), gy, Math.max(0.2, px(sp.to) - px(sp.from)), gh, 'F');
      }
      const next = s.periodSpans[k + 1];
      if (next && next.from - sp.to > 1000) {
        doc.setFillColor(205, 209, 216);
        doc.rect(px(sp.to), gy, Math.max(0.2, px(next.from) - px(sp.to)), gh, 'F');
      }
    });
    // fasce in campo
    doc.setFillColor(...mixRgb(primary, [255, 255, 255], 0.78));
    for (let k = 0; k < p.series.length - 1; k++) {
      if (p.series[k].on) doc.rect(px(p.series[k].t), gy, Math.max(0.2, px(p.series[k + 1].t) - px(p.series[k].t)), gh, 'F');
    }
    // separatori dei quarti
    doc.setDrawColor(150, 156, 166);
    doc.setLineWidth(0.25);
    for (const sp of s.periodSpans.slice(1)) doc.line(px(sp.from), gy, px(sp.from), gy + gh);
    doc.setLineWidth(0.45);
    for (let k = 0; k < p.series.length - 1; k++) {
      const a = p.series[k];
      const b = p.series[k + 1];
      doc.setDrawColor(...printColor((a.v + b.v) / 2));
      doc.line(px(a.t), py(a.v), px(b.t), py(b.v));
    }
    y += rowH;
  });

  // ---------- Legenda e piè di pagina ----------
  y += 5;
  if (y > 297 - 28) {
    doc.addPage();
    y = 16;
  }
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...muted);
  const legend = [
    'INT: carico di fatica dello stint su scala 0–1 (0 = fresco, 1 = massimo). Sale con il tempo di gioco consecutivo e totale,',
    'cala nelle interruzioni lunghe e recupera in panchina. INT medio = media sull\'intera partita; INT picco = valore massimo raggiunto.',
    'Andamento INT: Q1, Q2… = quarti (OT = supplementari), grigio scuro = pausa tra i quarti; fasce colorate = in campo;',
    'linea dal grigio (fresco) al rosso (da cambiare). T = titolare.',
  ];
  legend.forEach((l, i) => doc.text(l, M, y + i * 4));
  // scala colori
  const sy = y + legend.length * 4 + 1.5;
  for (let k = 0; k < 40; k++) {
    doc.setFillColor(...printColor(k / 39));
    doc.rect(M + k * 1.5, sy, 1.55, 2.2, 'F');
  }
  doc.text('0', M, sy + 5.5);
  doc.text('1', M + 60, sy + 5.5, { align: 'right' });

  const pages = doc.getNumberOfPages();
  const when = input.generatedAt ?? new Date();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setDrawColor(...accent);
    doc.setLineWidth(0.4);
    doc.line(M, 297 - 12, W - M, 297 - 12);
    doc.setFontSize(7.5);
    doc.setTextColor(...muted);
    doc.text(`${APP.name} · ${APP.credit} · generato il ${when.toLocaleDateString('it-IT')} alle ${when.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}`, M, 297 - 7.5);
    doc.text(`Pagina ${i} di ${pages}`, W - M, 297 - 7.5, { align: 'right' });
  }
  return doc;
}

/** Converte il logo (data URL o file incluso nell'app) in PNG per il PDF. */
export async function logoForPdf(src: string | undefined): Promise<string | null> {
  if (!src) return null;
  try {
    const img = await new Promise<HTMLImageElement>((res, rej) => {
      const i = new Image();
      i.crossOrigin = 'anonymous';
      i.onload = () => res(i);
      i.onerror = rej;
      i.src = src;
    });
    const size = 256;
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const ctx = c.getContext('2d')!;
    const k = Math.min(size / img.naturalWidth, size / img.naturalHeight);
    const w = img.naturalWidth * k;
    const h = img.naturalHeight * k;
    ctx.drawImage(img, (size - w) / 2, (size - h) / 2, w, h);
    return c.toDataURL('image/png');
  } catch {
    return null;
  }
}

/** Esporta: condivide il file se il dispositivo lo permette (WhatsApp, Drive…), altrimenti lo scarica. */
export async function exportReportPdf(input: PdfInput, mode: 'download' | 'share' = 'download'): Promise<'shared' | 'downloaded'> {
  const doc = await buildReportPdf(input);
  const name = pdfFileName(input);
  if (mode === 'share') {
    const file = new File([doc.output('blob')], name, { type: 'application/pdf' });
    if (navigator.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file], title: name });
      return 'shared';
    }
  }
  doc.save(name);
  return 'downloaded';
}
