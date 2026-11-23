import { describe, expect, it } from 'vitest';
import fixture from '@/engine/fixtures/srpe-2026-27.json';
import { athleteSeries } from '@/engine/load';
import { toLoadEntries } from '@/db/rpeRepo';
import type { Game, GameReport, Player, RpeEntry, Role, TrainingSession } from '@/db/types';
import { createLive, settle, substitute, toggleClock } from '@/features/live/liveModel';
import { buildLoadReport, presetRange } from './loadReport';

// dal fixture (foglio reale anonimizzato): giocatori, sedute per data, RPE
const names = [...new Set(fixture.rows.map((r) => r.name))];
const players: Player[] = names.map((name, k) => ({ id: k + 1, teamId: 1, name, number: String(k + 1), role: 'SF', traits: [], notes: '', status: 'available', statusDate: '', statusDetails: '', createdAt: 0, updatedAt: 0 }));
const dates = [...new Set(fixture.rows.map((r) => r.date))].sort();
const sessions: TrainingSession[] = dates.map((date, k) => ({ id: 100 + k, teamId: 1, date, type: k % 5 === 4 ? 'partita' : 'basket', minutes: 90, notes: '', createdAt: 0, updatedAt: 0 }));
const entries: RpeEntry[] = fixture.rows
  .filter((r) => r.rpe != null)
  .map((r, k) => ({ id: k + 1, teamId: 1, sessionId: 100 + dates.indexOf(r.date), playerId: names.indexOf(r.name) + 1, rpe: r.rpe, minutes: r.min === 90 ? null : r.min, source: 'import', updatedAt: 0 }));
const team = { name: 'Squadra', season: '2026/27', primary: '#002855', secondary: '#ee3239' };

describe('report del carico', () => {
  const from = dates[10];
  const to = dates[30];
  const rep = buildLoadReport({ team, players, sessions, entries, from, to, windowDays: 7 });

  it('limita le sedute al periodo', () => {
    expect(rep.sessions.every((s) => s.date >= from && s.date <= to)).toBe(true);
    expect(rep.sessions.length).toBe(21);
    expect(rep.matchSessions).toBe(rep.sessions.filter((s) => s.type === 'partita').length);
  });

  it('gli indicatori del periodo usano tutto lo storico (come il foglio)', () => {
    const load = toLoadEntries(sessions, entries, players);
    for (const a of rep.athletes) {
      const full = athleteSeries(load, a.player.id!, 7).filter((d) => d.date >= from && d.date <= to);
      expect(a.series).toEqual(full);
    }
    const ref = rep.athletes.find((a) => a.player.name === fixture.athlete)!;
    for (const d of ref.series) {
      const e = fixture.expected.find((x) => x.date === d.date)!;
      expect(d.tl).toBe(e.tl);
      if (e.acwr == null) expect(d.acwr).toBeNull();
      else expect(d.acwr).toBeCloseTo(e.acwr, 9);
    }
  });

  it('totali per atleta coerenti con gli RPE del periodo', () => {
    for (const a of rep.athletes) {
      const mine = entries.filter((e) => e.playerId === a.player.id && rep.sessions.some((s) => s.id === e.sessionId));
      expect(a.answered).toBe(mine.length);
      expect(a.answered + a.missing).toBe(rep.sessions.length);
      expect(a.tlTotal).toBe(mine.reduce((t, e) => t + (e.rpe as number) * (e.minutes ?? 90), 0));
    }
  });

  it('atleti in ordine di cognome e zone contate una volta', () => {
    const z = rep.zones.high + rep.zones.ok + rep.zones.low;
    expect(z).toBeLessThanOrEqual(rep.athletes.length);
    expect(rep.responseRate).toBeGreaterThan(0);
    expect(rep.responseRate).toBeLessThanOrEqual(1);
  });

  it('periodi predefiniti', () => {
    expect(presetRange('week', '2026-11-23')).toEqual({ from: '2026-11-17', to: '2026-11-23' });
    expect(presetRange('month', '2026-11-23')).toEqual({ from: '2026-10-27', to: '2026-11-23' });
    expect(presetRange('season', '2026-11-23', '2026-08-20')).toEqual({ from: '2026-08-20', to: '2026-11-23' });
  });
});

describe('partite monitorate nel report', () => {
  const MIN = 60_000;
  const T0 = Date.UTC(2026, 9, 20, 18);
  const ids = players.slice(0, 7).map((p) => p.id!);
  const roles = Object.fromEntries(ids.map((id, k) => [id, (['PG', 'SG', 'SF', 'PF', 'C', 'PG', 'C'] as Role[])[k]]));
  let st = createLive({ teamId: 1, gameId: 900, opponent: 'Avversari', home: true, called: ids, starters: ids.slice(0, 5), roles, now: T0 });
  st = toggleClock(st, T0);
  st = substitute(st, [ids[4]], [ids[6]], roles, T0 + 4 * MIN);
  st = settle(st, T0 + 10 * MIN);
  const end = T0 + 11 * MIN;
  const report: GameReport = { gameId: 900, teamId: 1, finishedAt: end, players: players.slice(0, 7).map((p) => ({ id: p.id!, name: p.name, number: p.number, role: 'SF' })), live: { ...settle(st, end), running: false } };
  const game: Game = { id: 900, teamId: 1, date: dates[20], time: '18:00', opponent: 'Avversari', home: true, notes: '', status: 'finished', createdAt: 0, updatedAt: 0 };

  it('minuti e INT per atleta solo se la partita è nel periodo', () => {
    const inside = buildLoadReport({ team, players, sessions, entries, games: [game], reports: [report], from: dates[10], to: dates[30], windowDays: 7 });
    expect(inside.liveGames).toBe(1);
    const a1 = inside.athletes.find((a) => a.player.id === ids[0])!;
    const a5 = inside.athletes.find((a) => a.player.id === ids[4])!;
    expect(a1.playedMs).toBe(10 * MIN);
    expect(a5.playedMs).toBe(4 * MIN);
    expect(a1.matches[0].opponent).toBe('Avversari');
    expect(a1.intPeak).toBeGreaterThan(0);
    const outside = buildLoadReport({ team, players, sessions, entries, games: [game], reports: [report], from: dates[25], to: dates[30], windowDays: 7 });
    expect(outside.liveGames).toBe(0);
    expect(outside.athletes[0].matches).toEqual([]);
  });
});
