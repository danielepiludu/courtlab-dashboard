import { describe, expect, it } from 'vitest';
import type { Role } from '@/db/types';
import { addScore, createLive, mmss, periodOver, restMs, settle, substitute, toggleClock, undoScore, type LiveState } from './liveModel';

const MIN = 60_000;
const roles: Record<number, Role> = { 1: 'PG', 2: 'SG', 3: 'SF', 4: 'PF', 5: 'C', 6: 'PG', 7: 'C', 8: 'SF' };
const T0 = 1_700_000_000_000;
const make = (): LiveState =>
  createLive({ teamId: 1, gameId: 1, opponent: 'Test', home: true, called: [1, 2, 3, 4, 5, 6, 7, 8], starters: [1, 2, 3, 4, 5], roles, now: T0 });

describe('ingresso in partita', () => {
  it('tutti i timer sono fermi finché non si preme Start', () => {
    const s = settle(make(), T0 + 5 * MIN);
    expect(s.remainingMs).toBe(10 * MIN);
    expect(s.players[1].playedMs).toBe(0);
    expect(restMs(s.players[6], T0 + 5 * MIN)).toBe(0);
  });
  it('quintetto disposto per ruolo: C e PF nel pitturato, PG in punta', () => {
    const s = make();
    expect(s.slots[0]).toBe(1); // PG punta
    expect(s.slots[4]).toBe(5); // C vicino al canestro
    expect(s.slots[3]).toBe(4); // PF
    expect(s.players[1].entries).toBe(1);
    expect(s.players[6].entries).toBe(0);
  });
});

describe('cronometro', () => {
  it('conta i minuti giocati solo a cronometro in corso; il REST conta tempo reale', () => {
    let s = toggleClock(make(), T0); // start
    s = toggleClock(s, T0 + 3 * MIN); // stop dopo 3'
    const later = settle(s, T0 + 5 * MIN); // 2' di timeout
    expect(later.players[1].playedMs).toBe(3 * MIN);
    expect(later.remainingMs).toBe(7 * MIN);
    expect(restMs(later.players[6], T0 + 5 * MIN)).toBe(5 * MIN);
  });
  it('a fine periodo si ferma a 00:00; Start passa al periodo successivo già avviato', () => {
    let s = toggleClock(make(), T0);
    s = settle(s, T0 + 12 * MIN);
    expect(s.running).toBe(false);
    expect(s.remainingMs).toBe(0);
    expect(s.players[1].playedMs).toBe(10 * MIN);
    expect(periodOver(s)).toBe(true);
    expect(s.events[s.events.length - 1]).toEqual({ t: T0 + 10 * MIN, type: 'period_end', period: 0 });
    s = toggleClock(s, T0 + 13 * MIN);
    expect(s.period).toBe(1);
    expect(s.running).toBe(true);
    expect(s.remainingMs).toBe(10 * MIN);
  });
  it('dopo Q4 arrivano i supplementari da 5 minuti', () => {
    let s = toggleClock(make(), T0);
    for (let p = 0; p < 4; p++) {
      s = settle(s, s.settledAt + 11 * MIN);
      s = toggleClock(s, s.settledAt + MIN);
    }
    expect(s.period).toBe(4);
    expect(s.remainingMs).toBe(5 * MIN);
  });
  it('ricostruzione dopo chiusura: lo stato salvato + l\'ora attuale danno i valori esatti', () => {
    const saved = JSON.parse(JSON.stringify(toggleClock(make(), T0))) as LiveState;
    const s = settle(saved, T0 + 4 * MIN + 30_000);
    expect(s.players[3].playedMs).toBe(4.5 * MIN);
    expect(mmss(s.remainingMs, 'ceil')).toBe('05:30');
  });
});

describe('cambi', () => {
  it('chi entra prende la posizione di chi esce; minuti consecutivi azzerati; ingressi contati', () => {
    let s = toggleClock(make(), T0);
    s = substitute(s, [5], [7], roles, T0 + 2 * MIN);
    expect(s.slots[4]).toBe(7);
    expect(s.players[5].onCourt).toBe(false);
    expect(s.players[5].playedMs).toBe(2 * MIN);
    expect(s.players[5].stintMs).toBe(0);
    expect(s.players[7].entries).toBe(1);
    expect(restMs(s.players[5], T0 + 3 * MIN)).toBe(MIN);
  });
  it('2-2: le coppie si formano per ruolo (lungo per lungo)', () => {
    const s = substitute(make(), [1, 5], [6, 7], roles, T0);
    expect(s.slots[0]).toBe(6); // PG per PG
    expect(s.slots[4]).toBe(7); // C per C
  });
  it('funziona anche a cronometro fermo; quantità diverse vengono ignorate', () => {
    const s = make();
    expect(substitute(s, [1, 2], [6], roles, T0)).toBe(s);
    expect(substitute(s, [1], [6], roles, T0).players[6].onCourt).toBe(true);
  });
});

describe('punteggio', () => {
  it('+1/+2/+3 e undo dell\'ultimo canestro', () => {
    let s = addScore(make(), 'us', 3, T0);
    s = addScore(s, 'them', 2, T0);
    expect([s.us, s.them]).toEqual([3, 2]);
    s = undoScore(s);
    expect([s.us, s.them]).toEqual([3, 0]);
  });
});
