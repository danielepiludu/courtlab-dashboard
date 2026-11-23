import { describe, expect, it } from 'vitest';
import type { Player, RpeEntry, TrainingSession } from '@/db/types';
import { buildSessionPdf, sessionPdfFileName } from './sessionPdf';

const player = (id: number, name: string, number: string): Player => ({ id, teamId: 1, name, number, role: 'SF', traits: [], notes: '', status: 'available', statusDate: '', statusDetails: '', createdAt: 0, updatedAt: 0 });
const players = [player(1, 'Marco Bianchi', '4'), player(2, 'Luca Rossi', '7'), player(3, 'Andrea Conti', '9')];
const session: TrainingSession = { id: 10, teamId: 1, date: '2026-11-23', type: 'basket', minutes: 90, notes: '', createdAt: 0, updatedAt: 0 };
const entries: RpeEntry[] = [
  { id: 1, teamId: 1, sessionId: 10, playerId: 1, rpe: 7, minutes: null, source: 'atleta', updatedAt: 0 },
  { id: 2, teamId: 1, sessionId: 10, playerId: 2, rpe: 5, minutes: 60, source: 'staff', updatedAt: 0 },
];

describe('PDF della seduta RPE', () => {
  it('riepilogo, atleti per cognome, TL e chi non ha risposto', async () => {
    const doc = await buildSessionPdf({ session, team: { name: 'Squadra Test', season: '2026/27', primary: '#002855', secondary: '#ee3239' }, players, entries, workLoad: new Map([[1, 1.42], [2, 0.9]]), compress: false });
    const out = doc.output();
    expect(out).toContain('RPE · ALLENAMENTO TECNICO');
    expect(out).toContain('Squadra Test');
    expect(out).toContain('2/3'); // risposte
    expect(out).toContain('Bianchi Marco');
    expect(out).toContain('Rossi Luca');
    expect(out).toContain('630'); // 7 × 90
    expect(out).toContain('300'); // 5 × 60
    expect(out).toContain('Nessuna risposta'); // Conti
    expect(out).toContain('1,42');
    // ordine per cognome: Bianchi, Conti, Rossi
    expect(out.indexOf('Bianchi Marco')).toBeLessThan(out.indexOf('Conti Andrea'));
    expect(out.indexOf('Conti Andrea')).toBeLessThan(out.indexOf('Rossi Luca'));
  });
  it('nome del file', () => {
    expect(sessionPdfFileName(session)).toBe('rpe-allenamento-2026-11-23.pdf');
    expect(sessionPdfFileName({ ...session, type: 'partita' })).toBe('rpe-partita-2026-11-23.pdf');
  });
});
