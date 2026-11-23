import { describe, expect, it } from 'vitest';
import type { AthleteMeasures, MeasureSession, Player } from '@/db/types';
import { buildMeasuresSheets, measuresXlsxFileName } from './measuresXlsx';
import { parseMeasureSheet, sheetDate } from './importMeasures';

const P = (id: number, name: string, birthDate?: string) => ({ id, teamId: 1, name, number: '', role: 'G', status: 'available', birthDate }) as unknown as Player;
const players = [P(1, 'Mario Verdi', '2009-03-14'), P(2, 'Luca Bianchi', '2010-01-02'), P(3, 'Senza Misure')];
const S = (id: number, date: string, label = ''): MeasureSession => ({ id, teamId: 1, date, label, notes: '', createdAt: 0, updatedAt: 0 });
const sessions = [S(10, '2026-07-01', 'Base'), S(11, '2026-11-20')];
const M = (sessionId: number, playerId: number, values: AthleteMeasures['values'], note = ''): AthleteMeasures => ({ teamId: 1, sessionId, playerId, values, note, updatedAt: 0 });
const measures = [
  M(10, 1, { height: 190, weight: 80, thighKneeR: 40, thighKneeL: 38, sj: 30.5, sqTest: 'Buono' }),
  M(11, 1, { height: 191, weight: 82.4, thighKneeR: 41, thighKneeL: 40, sj: 32 }, 'caviglia ok'),
  M(10, 2, { height: 185, weight: 75 }),
];

const raw = (c: unknown) => (c && typeof c === 'object' && !(c instanceof Date) && 'value' in (c as object) ? (c as { value: unknown }).value : c);

describe('export Excel misure', () => {
  const sheets = buildMeasuresSheets({ team: { name: 'Squadra Test' }, players, sessions, measures });
  it('fogli: riepilogo, asimmetrie, una scheda per rilevazione, DB', () => {
    expect(sheets.map((s) => s.sheet)).toEqual(['Riepilogo', 'Asimmetrie', '01-07-2026', '20-11-2026', 'DB']);
    expect(sheetDate('20-11-2026').date).toBe('2026-11-20');
    expect(measuresXlsxFileName({ name: 'Under 17 Èlite' }, '2026-11-23')).toBe('misure-under-17-elite-2026-11-23.xlsx');
  });
  it('riepilogo con ultimo valore e Δ, atleti per cognome, senza chi non ha misure', () => {
    const rows = sheets[0].data as unknown[][];
    const names = rows.slice(4).map((r) => raw(r[0]));
    expect(names).toEqual(['Bianchi Luca', 'Verdi Mario']);
    const head = rows[3].map(raw);
    const verdi = rows[5].map(raw);
    expect(verdi[head.indexOf('Peso (kg)')]).toBe(82.4);
    expect(verdi[head.indexOf('Δ Peso')]).toBeCloseTo(2.4);
  });
  it('asimmetria in percentuale', () => {
    const verdi = (sheets[1].data as unknown[][]).find((r) => raw(r[0]) === 'Verdi Mario')!.map(raw);
    expect(verdi[1]).toBeCloseTo(0.05);
    expect(verdi[2]).toBeCloseTo(1 / 41);
  });
  it('la scheda della rilevazione si reimporta uguale', () => {
    const rows = (sheets[2].data as unknown[][]).map((r) => r.map(raw)) as never;
    const parsed = parseMeasureSheet(sheets[2].sheet!, rows)!;
    expect(parsed.date).toBe('2026-07-01');
    const verdi = parsed.athletes.find((a) => a.name === 'Verdi Mario')!;
    expect(verdi.values).toEqual(measures[0].values);
    expect(verdi.birthDate).toBe('2009-03-14');
    const p2 = parseMeasureSheet(sheets[3].sheet!, (sheets[3].data as unknown[][]).map((r) => r.map(raw)) as never)!;
    expect(p2.athletes[0].note).toBe('caviglia ok');
    expect(p2.unknownRows).toEqual([]);
  });
  it('DB in formato lungo', () => {
    expect((sheets[4].data as unknown[]).length).toBe(1 + 6 + 5 + 2);
  });
});
