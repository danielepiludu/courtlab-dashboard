/**
 * Export Excel delle misure (.xlsx) per il Drive della società:
 *  Riepilogo (ultimo valore e Δ dalla prima) · Asimmetrie · una scheda per rilevazione
 *  (stesso formato del foglio "Misurazioni": atleti in colonna, misure in riga, reimportabile) · DB (formato lungo).
 */
import type { Cell, Sheet, SheetData } from 'write-excel-file/browser';
import { compareSurname, surnameFirst, type AthleteMeasures, type MeasureSession, type Player, type Team } from '@/db/types';
import { MEASURES, NUMERIC_MEASURES, PAIRS, ageAt, asymmetry, bmi, deltas } from '@/engine/anthro';
import { sessionLabel } from './measuresRepo';

const DATE_FMT = 'dd/mm/yyyy';
const date = (iso: string | undefined): Cell => (iso ? { value: new Date(`${iso}T00:00:00Z`), type: Date, format: DATE_FMT } : null);
const fmtOf = (decimals?: number) => (decimals ? `0.${'0'.repeat(decimals)}` : '0');
const num = (v: number | null | undefined, format = '0'): Cell => {
  if (v == null || !Number.isFinite(v)) return null;
  // arrotonda ai decimali mostrati (niente 7,1999999 nel file)
  const d = format.includes('%') ? 4 : (format.split(';')[0].split('.')[1]?.length ?? 0);
  return { value: Math.round(v * 10 ** d) / 10 ** d, type: Number, format };
};
const itDate = (iso: string) => iso.split('-').reverse().join('-');

export interface MeasuresExport {
  team: Pick<Team, 'name'>;
  players: Player[];
  sessions: MeasureSession[];
  measures: AthleteMeasures[];
}

export function measuresXlsxFileName(team: Pick<Team, 'name'>, today = new Date().toISOString().slice(0, 10)): string {
  const slug = team.name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40);
  return `misure-${slug}-${today}.xlsx`;
}

/** Nomi delle schede: la data (gg-mm-aaaa), così il file si può reimportare. */
function sheetNames(sessions: MeasureSession[]): string[] {
  const used = new Map<string, number>();
  return sessions.map((s) => {
    const base = itDate(s.date);
    const n = (used.get(base) ?? 0) + 1;
    used.set(base, n);
    return n === 1 ? base : `${base} (${n})`;
  });
}

/** Dati dei fogli (puri, testabili). */
export function buildMeasuresSheets(x: MeasuresExport, colors: { bg: string; fg: string } = { bg: '#1F2937', fg: '#FFFFFF' }): Sheet<never>[] {
  const H = (labels: string[]): Cell[] => labels.map((l) => ({ value: l, fontWeight: 'bold', backgroundColor: colors.bg, textColor: colors.fg, wrap: true, alignVertical: 'center' }) as Cell);
  const asc = [...x.sessions].sort((a, b) => a.date.localeCompare(b.date));
  const byKey = new Map(x.measures.map((m) => [`${m.sessionId}:${m.playerId}`, m]));
  const roster = [...x.players].sort(compareSurname);
  const measured = roster.filter((p) => asc.some((s) => byKey.has(`${s.id}:${p.id}`)));
  const used = NUMERIC_MEASURES.filter((d) => x.measures.some((m) => typeof m.values[d.id] === 'number'));
  const numAt = (s: MeasureSession, p: Player, id: string) => {
    const m = byKey.get(`${s.id}:${p.id}`);
    if (!m) return null;
    if (id === 'bmi') return bmi(m.values);
    const v = m.values[id];
    return typeof v === 'number' ? v : null;
  };
  const last = asc[asc.length - 1];

  // 1. Riepilogo: ultimo valore e variazione dalla prima rilevazione
  const series = [...used.slice(0, 2), { id: 'bmi', short: 'BMI', unit: 'kg/m²', decimals: 1 }, ...used.slice(2)];
  const riepilogo: SheetData = [
    [{ value: `${x.team.name} · misure`, fontWeight: 'bold', fontSize: 14 }],
    [{ value: `${asc.length} rilevazioni${last ? ` · ultima il ${last.date.split('-').reverse().join('/')}` : ''} · Δ = ultima misura rispetto alla prima`, textColor: '#6E7684' }],
    [],
    H(['Atleta', 'Data di nascita', 'Età', ...series.flatMap((d) => [`${d.short}${d.unit ? ` (${d.unit})` : ''}`, `Δ ${d.short}`])]),
    ...measured.map((p) => [
      { value: surnameFirst(p.name), fontWeight: 'bold' } as Cell,
      date(p.birthDate),
      num(last ? ageAt(p.birthDate, last.date) : null, '0.0'),
      ...series.flatMap((d) => {
        const dl = deltas(asc.map((s) => ({ date: s.date, sessionId: s.id!, value: numAt(s, p, d.id) })));
        const f = fmtOf(d.decimals);
        return [num(dl.last, f), num(dl.dBase, `+${f};-${f};0`)];
      }),
    ]),
  ];

  // 2. Asimmetrie dx/sx per rilevazione
  const pairs = PAIRS.filter((pr) => used.some((d) => d.id === pr.dx));
  const asimmetrie: SheetData = [
    [{ value: 'Asimmetria dx/sx (%) = |dx − sx| / valore maggiore', fontWeight: 'bold' }],
    [],
    H(['Atleta', ...pairs.flatMap((pr) => asc.map((s) => `${pr.label} · ${sessionLabel(s, true)}`))]),
    ...measured.map((p) => [
      { value: surnameFirst(p.name), fontWeight: 'bold' } as Cell,
      ...pairs.flatMap((pr) =>
        asc.map((s) => {
          const a = asymmetry(numAt(s, p, pr.dx), numAt(s, p, pr.sx));
          return a == null ? null : ({ value: a / 100, type: Number, format: '0.0%', ...(a >= 5 ? { backgroundColor: '#FDEBD0' } : {}) } as Cell);
        }),
      ),
    ]),
  ];

  // 3. Una scheda per rilevazione, come il foglio originale
  const names = sheetNames(asc);
  const perSession = asc.map((s, i) => {
    const athletes = roster.filter((p) => byKey.has(`${s.id}:${p.id}`));
    const rows = MEASURES.filter((d) => athletes.some((p) => byKey.get(`${s.id}:${p.id}`)!.values[d.id] != null));
    const data: SheetData = [
      H([s.label ? `${s.label} (${s.date.split('-').reverse().join('/')})` : 'Misura', ...athletes.map((p) => surnameFirst(p.name))]),
      [{ value: 'Data di nascita', fontWeight: 'bold' }, ...athletes.map((p) => date(p.birthDate))],
      ...rows.map((d) => [
        { value: `${d.label}${d.unit ? ` (${d.unit})` : ''}`, fontWeight: 'bold' } as Cell,
        ...athletes.map((p) => {
          const v = byKey.get(`${s.id}:${p.id}`)!.values[d.id];
          return typeof v === 'number' ? num(v, fmtOf(d.decimals)) : v ? ({ value: String(v) } as Cell) : null;
        }),
      ]),
      [{ value: 'Note', fontWeight: 'bold' }, ...athletes.map((p) => (byKey.get(`${s.id}:${p.id}`)!.note ? ({ value: byKey.get(`${s.id}:${p.id}`)!.note, wrap: true } as Cell) : null))],
    ];
    return { sheet: names[i], data, columns: [{ width: 34 }, ...athletes.map(() => ({ width: 15 }))], stickyRowsCount: 1, stickyColumnsCount: 1 };
  });

  // 4. DB: una riga per misura (comodo per filtri e tabelle pivot)
  const db: SheetData = [H(['Data', 'Rilevazione', 'Atleta', 'Misura', 'Valore', 'Unità'])];
  for (const s of asc)
    for (const p of roster) {
      const m = byKey.get(`${s.id}:${p.id}`);
      if (!m) continue;
      for (const d of MEASURES) {
        const v = m.values[d.id];
        if (v == null || v === '') continue;
        db.push([date(s.date), { value: sessionLabel(s) }, { value: surnameFirst(p.name) }, { value: d.label }, typeof v === 'number' ? num(v, fmtOf(d.decimals)) : { value: String(v) }, d.unit ? { value: d.unit } : null]);
      }
    }

  return [
    { sheet: 'Riepilogo', data: riepilogo, columns: [{ width: 24 }, { width: 14 }, { width: 7 }, ...series.flatMap(() => [{ width: 12 }, { width: 9 }])], stickyRowsCount: 4, stickyColumnsCount: 1 },
    ...(pairs.length ? [{ sheet: 'Asimmetrie', data: asimmetrie, columns: [{ width: 24 }, ...pairs.flatMap(() => asc.map(() => ({ width: 16 })))], stickyRowsCount: 3, stickyColumnsCount: 1 }] : []),
    ...perSession,
    { sheet: 'DB', data: db, columns: [{ width: 12 }, { width: 18 }, { width: 24 }, { width: 34 }, { width: 10 }, { width: 8 }], stickyRowsCount: 1 },
  ] as Sheet<never>[];
}

export async function buildMeasuresXlsx(x: MeasuresExport, colors?: { bg: string; fg: string }): Promise<Blob> {
  const { default: writeXlsxFile } = await import('write-excel-file/browser');
  return writeXlsxFile(buildMeasuresSheets(x, colors) as never, { fontFamily: 'Calibri', fontSize: 11 } as never).toBlob();
}
