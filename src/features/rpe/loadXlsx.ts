/**
 * Export Excel del carico (.xlsx), cinque fogli:
 *  Riepilogo · Giorno per giorno · Squadra · DB (stesso formato del foglio sRPE, reimportabile) · Partite
 */
import { surnameFirst } from '@/db/types';
import type { Sheet, SheetData, Cell } from 'write-excel-file/browser';
import { acwrZone } from '@/engine/load';
import { SESSION_TYPE_LABEL } from '@/db/types';
import type { LoadReport } from './loadReport';

const ZONE_TXT = { high: 'Sopra 1,3', ok: 'In zona', low: 'Sotto 0,8' } as const;
const ZONE_BG = { high: '#FADBD8', ok: '#D5F0E1', low: '#FDEBD0' } as const;
const DATE_FMT = 'dd/mm/yyyy';

const date = (iso: string): Cell => ({ value: new Date(`${iso}T00:00:00Z`), type: Date, format: DATE_FMT });
const num = (v: number | null | undefined, format = '0'): Cell => (v == null || !Number.isFinite(v) ? null : { value: v, type: Number, format });
const head = (labels: string[], bg: string, fg: string): Cell[] =>
  labels.map((l) => ({ value: l, fontWeight: 'bold', backgroundColor: bg, textColor: fg, wrap: true, alignVertical: 'center' }) as Cell);
const zone = (v: number | null | undefined): Cell => {
  const z = acwrZone(v ?? null);
  return z ? { value: ZONE_TXT[z], backgroundColor: ZONE_BG[z] } : null;
};

export function loadXlsxFileName(r: LoadReport): string {
  const slug = r.team.name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40);
  return `carico-${slug}-${r.from}_${r.to}.xlsx`;
}

/** Dati dei fogli (puri, testabili). */
export function buildLoadSheets(r: LoadReport, colors: { bg: string; fg: string } = { bg: '#002855', fg: '#FFFFFF' }): Sheet<never>[] {
  const H = (labels: string[]) => head(labels, colors.bg, colors.fg);
  const title = (t: string): Cell[] => [{ value: t, fontWeight: 'bold', fontSize: 14 }];
  const sub = (t: string): Cell[] => [{ value: t, textColor: '#6E7684' }];
  const period = `Dal ${r.from.split('-').reverse().join('/')} al ${r.to.split('-').reverse().join('/')} · media mobile ${r.windowDays} giorni`;
  const withGames = r.liveGames > 0;

  // 1. Riepilogo
  const riepilogo: SheetData = [
    title(`${r.team.name} · carico interno (sRPE)`),
    sub(period),
    [],
    [{ value: 'Sedute', fontWeight: 'bold' }, num(r.sessions.length), { value: 'di cui partite' }, num(r.matchSessions)],
    [{ value: 'RPE medio', fontWeight: 'bold' }, num(r.rpeAvg, '0.0'), { value: 'TL medio' }, num(r.tlAvg)],
    [{ value: 'Risposte', fontWeight: 'bold' }, num(r.responseRate, '0%'), { value: 'Work Load: sopra / in zona / sotto' }, { value: `${r.zones.high} / ${r.zones.ok} / ${r.zones.low}` }],
    [],
    H([
      'Atleta',
      'N.',
      'Risposte',
      'Sedute',
      'RPE medio',
      'TL totale',
      'TL medio',
      'Media personale',
      'Media squadra',
      'Work Load',
      'Zona',
      'Giorni sopra 1,3',
      'Giorni sotto 0,8',
      ...(withGames ? ['Partite monitorate', 'Minuti giocati', 'INT medio', 'INT picco'] : []),
    ]),
    ...r.athletes.map((a): Cell[] => [
      { value: surnameFirst(a.player.name), fontWeight: 'bold' },
      a.player.number || null,
      num(a.answered),
      num(a.answered + a.missing),
      num(a.rpeAvg, '0.0'),
      num(a.answered ? a.tlTotal : null),
      num(a.tlAvg),
      num(a.last?.rolAvg, '0.0'),
      num(a.last?.teamRol, '0.0'),
      num(a.answered ? a.last?.acwr : null, '0.00'),
      a.answered ? zone(a.last?.acwr) : null,
      num(a.answered ? a.daysHigh : null),
      num(a.answered ? a.daysLow : null),
      ...(withGames
        ? [
            num(a.matches.filter((m) => m.playedMs > 0).length),
            num(a.matches.length ? a.playedMs / 60_000 : null, '0.0'),
            num(a.intAvg, '0.00'),
            num(a.intPeak, '0.00'),
          ]
        : []),
    ]),
    [],
    sub('TL = RPE × minuti · Media personale = media dei TL dell\'atleta nella media mobile · Media squadra = media di tutti i TL della squadra · Work Load = TL ÷ media personale (senza RPE resta il precedente)'),
  ];

  // 2. Giorno per giorno (formato lungo, comodo per filtri e tabelle pivot)
  const typeOf = new Map(r.sessions.map((s) => [s.date, s.type]));
  const giorni: SheetData = [
    H(['Atleta', 'Data', 'Tipo', 'TL', 'Media personale', 'Media squadra', 'Work Load', 'Zona']),
    ...r.athletes.flatMap((a) =>
      a.series.map((d): Cell[] => [
        surnameFirst(a.player.name),
        date(d.date),
        typeOf.has(d.date) ? SESSION_TYPE_LABEL[typeOf.get(d.date)!] : null,
        num(d.tl),
        num(d.rolAvg, '0.0'),
        num(d.teamRol, '0.0'),
        num(d.acwr, '0.00'),
        zone(d.acwr),
      ]),
    ),
  ];

  // 3. Squadra
  const squadra: SheetData = [
    H(['Data', 'Tipo', 'Risposte', 'TL medio', 'TL totale', 'Media squadra']),
    ...r.teamDays.map((d): Cell[] => [date(d.date), d.type === 'misto' ? 'Misto' : SESSION_TYPE_LABEL[d.type], num(d.count), num(d.avg, '0.0'), num(d.total), num(d.teamRol, '0.0')]),
  ];

  // 4. DB: stesse colonne del foglio sRPE (NOME ATLETA, DATA, RPE, TEMPO, TL) + TIPO
  const db: SheetData = [
    H(['NOME ATLETA', 'DATA', 'RPE', 'TEMPO', 'TL', 'TIPO']),
    ...[...r.sessions]
      .sort((a, b) => a.date.localeCompare(b.date))
      .flatMap((s) =>
        r.athletes.map((a): Cell[] => {
          const row = a.rows.find((x) => x.date === s.date && x.type === s.type);
          return [surnameFirst(a.player.name).toUpperCase(), date(s.date), num(row?.rpe ?? null, '0.#'), num(row?.minutes ?? s.minutes), num(row?.tl ?? null), SESSION_TYPE_LABEL[s.type]];
        }),
      ),
  ];

  const sheets: Sheet<never>[] = [
    { sheet: 'Riepilogo', data: riepilogo, columns: [{ width: 26 }, { width: 6 }, ...Array(15).fill({ width: 13 })], stickyRowsCount: 0 },
    { sheet: 'Giorno per giorno', data: giorni, columns: [{ width: 26 }, { width: 12 }, { width: 18 }, ...Array(5).fill({ width: 14 })], stickyRowsCount: 1 },
    { sheet: 'Squadra', data: squadra, columns: [{ width: 12 }, { width: 18 }, ...Array(4).fill({ width: 13 })], stickyRowsCount: 1 },
    { sheet: 'DB', data: db, columns: [{ width: 24 }, { width: 12 }, { width: 8 }, { width: 8 }, { width: 8 }, { width: 18 }], stickyRowsCount: 1 },
  ];

  // 5. Partite monitorate
  if (withGames) {
    const partite: SheetData = [
      H(['Data', 'Avversario', 'Atleta', 'Minuti giocati', 'INT medio', 'INT picco']),
      ...r.athletes
        .flatMap((a) => a.matches.map((m) => ({ a, m })))
        .sort((x, y) => x.m.date.localeCompare(y.m.date) || x.a.player.name.localeCompare(y.a.player.name))
        .map(({ a, m }): Cell[] => [date(m.date), m.opponent, a.player.name, num(m.playedMs / 60_000, '0.0'), num(m.intAvg, '0.00'), num(m.intPeak, '0.00')]),
    ];
    sheets.push({ sheet: 'Partite', data: partite, columns: [{ width: 12 }, { width: 26 }, { width: 26 }, ...Array(3).fill({ width: 13 })], stickyRowsCount: 1 });
  }
  return sheets;
}

/** Crea il file .xlsx nel browser. */
export async function buildLoadXlsx(r: LoadReport, colors?: { bg: string; fg: string }): Promise<Blob> {
  const { default: writeXlsxFile } = await import('write-excel-file/browser');
  return writeXlsxFile(buildLoadSheets(r, colors) as never, { fontFamily: 'Calibri', fontSize: 11 } as never).toBlob();
}
