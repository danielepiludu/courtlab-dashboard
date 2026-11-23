import { describe, expect, it } from 'vitest';
import type { GameReport, Role } from '@/db/types';
import { addScore, createLive, settle, substitute, toggleClock } from '@/features/live/liveModel';
import { summarize } from './reportModel';
import { buildReportPdf, pdfFileName, printColor } from './pdf';

const MIN = 60_000;
const T0 = 1_700_000_000_000;
const roles: Record<number, Role> = { 1: 'PG', 2: 'SG', 3: 'SF', 4: 'PF', 5: 'C', 6: 'PG', 7: 'C' };
const snap = [1, 2, 3, 4, 5, 6, 7].map((id) => ({ id, name: `Giocatore ${id}`, number: String(id), role: roles[id] }));

function report(n = 7): GameReport {
  const ids = Array.from({ length: n }, (_, i) => i + 1);
  const r: Record<number, Role> = Object.fromEntries(ids.map((id) => [id, roles[id] ?? 'SF']));
  let s = createLive({ teamId: 1, gameId: 3, opponent: 'Virtus Siena', home: true, called: ids, starters: [1, 2, 3, 4, 5], roles: r, now: T0 });
  s = toggleClock(s, T0);
  s = addScore(s, 'us', 2, T0 + MIN);
  s = substitute(s, [5], [6], r, T0 + 4 * MIN);
  s = settle(s, T0 + 10 * MIN);
  const players = ids.map((id) => ({ id, name: `Giocatore ${id}`, number: String(id), role: r[id] }));
  return { gameId: 3, teamId: 1, finishedAt: T0 + 11 * MIN, players: n === 7 ? snap : players, live: settle(s, T0 + 11 * MIN) };
}

const input = (n = 7) => ({
  summary: summarize(report(n)),
  team: { name: 'Pallacanestro Don Bosco Livorno', season: '2026/27', primary: '#002855', secondary: '#ee3239' },
  game: { date: '2026-11-21', time: '19:00', opponent: 'Virtus Siena', home: true },
  generatedAt: new Date(T0),
  compress: false,
});

describe('PDF del resoconto', () => {
  it('genera un PDF A4 con squadra, avversario, punteggio e giocatori', async () => {
    const doc = await buildReportPdf(input());
    const out = doc.output();
    expect(out.startsWith('%PDF')).toBe(true);
    expect(doc.getNumberOfPages()).toBe(1);
    expect(out).toContain('Pallacanestro Don Bosco Livorno');
    expect(out).toContain('Virtus Siena');
    expect(out).toContain('RESOCONTO PARTITA');
    expect(out).toContain('1 Giocatore'); // i giocatori compaiono come "Cognome Nome"
    expect(out).toContain('VITTORIA');
  });
  it('compresso di default (file leggero)', async () => {
    const { compress: _c, ...rest } = input();
    void _c;
    const small = (await buildReportPdf(rest)).output();
    const big = (await buildReportPdf(input())).output();
    expect(small.length).toBeLessThan(big.length);
  });
  it('molti convocati: la tabella continua su una nuova pagina', async () => {
    const doc = await buildReportPdf(input(26));
    expect(doc.getNumberOfPages()).toBeGreaterThan(1);
  });
  it('nome del file leggibile', () => {
    expect(pdfFileName(input())).toBe('resoconto-pallacanestro-don-bosco-livorno-vs-virtus-siena-2026-11-21.pdf');
  });
  it('scala colori per la stampa: dal grigio al rosso', () => {
    expect(printColor(0)).toEqual([190, 196, 204]);
    expect(printColor(1)).toEqual([214, 32, 32]);
  });
});
