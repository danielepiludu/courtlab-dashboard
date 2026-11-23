import { describe, expect, it } from 'vitest';
import { ageAt, asymmetry, bmi, deltas, fmtDelta, fmtMeasure } from './anthro';
import { parseMeasureSheet, planMeasureImport, sheetDate } from '@/features/anthro/importMeasures';

describe('calcoli antropometrici', () => {
  it('BMI = peso / altezza²', () => {
    expect(bmi({ weight: 80, height: 200 })).toBeCloseTo(20, 9);
    expect(bmi({ weight: 80 })).toBeNull();
  });
  it('asimmetria dx/sx in %', () => {
    expect(asymmetry(44, 40)).toBeCloseTo((4 / 44) * 100, 9);
    expect(asymmetry(40, 40)).toBe(0);
    expect(asymmetry(null, 40)).toBeNull();
  });
  it('età alla data', () => {
    expect(ageAt('2010-01-15', '2026-01-15')).toBeCloseTo(16, 2);
    expect(ageAt(undefined, '2026-01-15')).toBeNull();
  });
  it('variazioni rispetto alla precedente e alla base (salta i vuoti)', () => {
    const d = deltas([
      { date: '2026-07-01', sessionId: 1, value: 90 },
      { date: '2026-08-20', sessionId: 2, value: null },
      { date: '2026-11-13', sessionId: 3, value: 94.5 },
    ]);
    expect(d).toEqual({ last: 94.5, prev: 90, base: 90, dPrev: 4.5, dBase: 4.5 });
  });
  it('formattazione italiana', () => {
    expect(fmtMeasure(94.5, { decimals: 1 })).toBe('94,5');
    expect(fmtMeasure(null)).toBe('–');
    expect(fmtDelta(-2)).toBe('−2');
    expect(fmtDelta(1.5, { decimals: 1 })).toBe('+1,5');
  });
});

describe('importazione del foglio "Misurazioni"', () => {
  // stessa struttura del foglio reale, con nomi e valori di fantasia
  const rows = [
    [null, 'Rossi', 'Bianchi', 'Verdi'],
    ['data nascita ', new Date(Date.UTC(2010, 7, 17)), new Date(Date.UTC(2011, 0, 11)), null],
    ['altezza con scarpa (cm)', 196, 185, 190],
    ['peso (kg)', 89.6, 79.7, null],
    ['wing span (cm)', null, null, null],
    ['reach con scarpa (cm)', null, 236, null],
    ['circonferenza coscia 3 cm dalla rotula dx', 42, 44, 40],
    ['circonferenza coscia 3 cm dalla rotula sx', 42, 45, 41],
    ['circonferenza coscia sotto piega glutea dx', 62, 60, null],
    ['circonferenza coscia sotto piega glutea sx', 62, 60, null],
    ['circonferenza polpaccio dx', 39, 38, null],
    ['circonferenza polpaccio sx', 39, 37, null],
    ['circonferenza torace', 94, 95, null],
    ['TEST SJ - MANI SU FIANCHI', 36, '27,5', null],
    ['TEST CMJ ', 49, 33, null],
    ['SQ TEST', null, 'INSUFFICIENTE', null],
    ['SQUAT TEST', null, 'BUONO COLLASSA PIEDE SX', null],
    [null, null, null, '16,9dx'],
  ];
  const s = parseMeasureSheet('20082026', rows as never)!;
  it('data dal nome della scheda e mese senza giorno', () => {
    expect(s.date).toBe('2026-08-20');
    expect(sheetDate('LUGLIO')).toEqual({ date: null, month: 7 });
  });
  it('misure, date di nascita, giudizi e note', () => {
    const [rossi, bianchi, verdi] = s.athletes;
    expect(rossi.birthDate).toBe('2010-08-17');
    expect(rossi.values).toMatchObject({ height: 196, weight: 89.6, thighKneeR: 42, thighKneeL: 42, chest: 94, sj: 36, cmj: 49 });
    expect(bianchi.values).toMatchObject({ reach: 236, sj: 27.5, sqTest: 'Insufficiente', squatTest: 'Buono collassa piede sx', calfL: 37 });
    expect(verdi.note).toBe('16,9dx');
    expect(Object.keys(rossi.values)).not.toContain('wingspan');
  });
  it('piano: la scheda senza giorno prende la stagione delle altre', () => {
    const july = parseMeasureSheet('LUGLIO', rows as never)!;
    const plan = planMeasureImport([s, july], [{ id: 7, name: 'Mario Rossi' }]);
    expect(plan.sheets.map((x) => x.chosenDate)).toEqual(['2026-07-01', '2026-08-20']);
    expect(plan.sheets[0].label).toBe('Luglio');
    expect(plan.matches.find((m) => m.sheetName === 'Rossi')?.playerId).toBe(7);
    expect(plan.matches.find((m) => m.sheetName === 'Verdi')?.playerId).toBeNull();
  });
});
