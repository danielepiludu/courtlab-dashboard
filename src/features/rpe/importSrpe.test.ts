import { describe, expect, it } from 'vitest';
import { parseSrpeRows, planImport } from './importSrpe';

const rows = [
  ['NOME ATLETA', 'DATA', 'RPE', 'TEMPO', 'TL'],
  ['ROSSI ', new Date(Date.UTC(2026, 7, 20)), 6, 90, 540],
  ['BIANCHI', new Date(Date.UTC(2026, 7, 20)), null, 90, null],
  ['VERDI', '21/08/2026', '5', 120, 600],
  ['ROSSI', 46255, 4, 90, 360], // seriale Excel = 21/08/2026
  [null, null, null, null, null],
];

describe('importazione sRPE da Excel', () => {
  it('riconosce colonne, date (anche seriali e testo) e numeri', () => {
    const p = parseSrpeRows(rows);
    expect(p).toHaveLength(4);
    expect(p[0]).toEqual({ name: 'ROSSI', date: '2026-08-20', rpe: 6, minutes: 90 });
    expect(p[1].rpe).toBeNull();
    expect(p[2]).toEqual({ name: 'VERDI', date: '2026-08-21', rpe: 5, minutes: 120 });
    expect(p[3].date).toBe('2026-08-21');
  });
  it('abbina i cognomi ai giocatori della squadra, gli altri vanno creati', () => {
    const plan = planImport(parseSrpeRows(rows), [
      { id: 1, name: 'Mario Rossi' },
      { id: 2, name: 'Luca Bianchi' },
    ]);
    expect(plan.matches.find((m) => m.sheetName === 'ROSSI')?.playerId).toBe(1);
    expect(plan.matches.find((m) => m.sheetName === 'BIANCHI')?.playerId).toBe(2);
    expect(plan.matches.find((m) => m.sheetName === 'VERDI')?.playerId).toBeNull();
    expect(plan.withRpe).toBe(3);
  });
  it('una seduta per data con la durata più frequente', () => {
    const plan = planImport(parseSrpeRows(rows), []);
    expect(plan.sessions).toEqual([
      { date: '2026-08-20', minutes: 90 },
      { date: '2026-08-21', minutes: 120 },
    ]);
  });
  it('file senza le colonne giuste: errore chiaro', () => {
    expect(() => parseSrpeRows([['A', 'B']])).toThrow(/NOME ATLETA/);
  });
});
