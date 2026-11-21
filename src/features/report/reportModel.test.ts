import { describe, expect, it } from 'vitest';
import type { GameReport, Role } from '@/db/types';
import { addScore, createLive, settle, substitute, toggleClock } from '@/features/live/liveModel';
import { summarize } from './reportModel';

const MIN = 60_000;
const T0 = 1_700_000_000_000;
const roles: Record<number, Role> = { 1: 'PG', 2: 'SG', 3: 'SF', 4: 'PF', 5: 'C', 6: 'PG', 7: 'C' };
const snap = [1, 2, 3, 4, 5, 6, 7].map((id) => ({ id, name: `G${id}`, number: String(id), role: roles[id] }));

function game(): GameReport {
  let s = createLive({ teamId: 1, gameId: 9, opponent: 'Avv', home: true, called: [1, 2, 3, 4, 5, 6, 7], starters: [1, 2, 3, 4, 5], roles, now: T0 });
  s = toggleClock(s, T0);
  s = addScore(s, 'us', 3, T0 + MIN);
  s = substitute(s, [5], [7], roles, T0 + 4 * MIN);
  s = addScore(s, 'them', 2, T0 + 5 * MIN);
  s = settle(s, T0 + 10 * MIN); // fine Q1
  const end = T0 + 11 * MIN;
  return { gameId: 9, teamId: 1, finishedAt: end, players: snap, live: { ...settle(s, end), running: false } };
}

describe('resoconto della partita', () => {
  const r = summarize(game());
  it('punteggio ed esito', () => {
    expect([r.us, r.them, r.outcome]).toEqual([3, 2, 'W']);
    expect(r.periods).toBe(1);
    expect(r.overtimes).toBe(0);
    expect(r.durationMs).toBe(11 * MIN);
  });
  it('minuti, ingressi e titolari', () => {
    const p1 = r.players.find((p) => p.id === 1)!;
    const p5 = r.players.find((p) => p.id === 5)!;
    const p7 = r.players.find((p) => p.id === 7)!;
    const p6 = r.players.find((p) => p.id === 6)!;
    expect(p1.playedMs).toBe(10 * MIN);
    expect(p5.playedMs).toBe(4 * MIN);
    expect(p7.playedMs).toBe(6 * MIN);
    expect([p1.entries, p5.entries, p7.entries, p6.entries]).toEqual([1, 1, 1, 0]);
    expect(p1.starter && p5.starter).toBe(true);
    expect(p7.starter || p6.starter).toBe(false);
  });
  it('ordinati per minuti giocati', () => {
    expect(r.players[0].playedMs).toBeGreaterThanOrEqual(r.players[1].playedMs);
    expect(r.players[r.players.length - 1].playedMs).toBe(0);
  });
  it('INT medio, di picco e serie per il grafico', () => {
    const p1 = r.players.find((p) => p.id === 1)!;
    const p6 = r.players.find((p) => p.id === 6)!;
    expect(p1.intPeak).toBeCloseTo(0.67, 2); // 10′ continui
    expect(p1.intAvg).toBeGreaterThan(0.2);
    expect(p1.intAvg).toBeLessThan(p1.intPeak);
    expect(p1.intAvgOnCourt).toBeGreaterThanOrEqual(p1.intAvg - 0.05);
    expect(p6.intPeak).toBe(0);
    expect(p1.series[0]).toEqual({ t: 0, v: 0, on: true });
    expect(p1.series[p1.series.length - 1].t).toBe(11 * MIN);
    expect(p1.series.every((x) => x.v >= 0 && x.v <= 1)).toBe(true);
  });
  it('migliori della partita', () => {
    expect(r.leaders.minutes?.playedMs).toBe(10 * MIN);
    expect(r.leaders.peak?.intPeak).toBeGreaterThan(0.6);
  });
  it('partita terminata senza mai premere Start: tutto a zero', () => {
    const s = createLive({ teamId: 1, gameId: 9, opponent: 'Avv', home: true, called: [1, 2, 3, 4, 5, 6, 7], starters: [1, 2, 3, 4, 5], roles, now: T0 });
    const e = summarize({ gameId: 9, teamId: 1, finishedAt: T0 + MIN, players: snap, live: s });
    expect(e.started).toBe(false);
    expect(e.players.every((p) => p.intAvg === 0 && p.playedMs === 0 && p.series.length === 0)).toBe(true);
  });
});
