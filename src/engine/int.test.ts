import { describe, expect, it } from 'vitest';
import { INT_CONFIG } from './intConfig';
import { decayBench, decayCourtStopped, minutesToReach, ratePerMin, rise } from './int';

const MIN = 60_000;

describe('a) in campo, cronometro in corso', () => {
  it('velocità = (4 + 0,5 × min consecutivi) × (1 + 0,01 × min totali)', () => {
    expect(ratePerMin(0, 0)).toBeCloseTo(4, 10);
    expect(ratePerMin(6 * MIN, 20 * MIN)).toBeCloseTo((4 + 0.5 * 6) * (1 + 0.01 * 20), 10);
  });
  it('valori da INT 0 e 0 minuti totali (integrale esatto della formula)', () => {
    // 4t + 0,27t² + 0,005t³/3
    expect(rise(0, 0, 0, 5 * MIN)).toBeCloseTo(26.96, 1);
    expect(rise(0, 0, 0, 10 * MIN)).toBeCloseTo(68.67, 1);
    expect(minutesToReach(100)).toBeCloseTo(12.9, 1);
  });
  it('valori attesi della specifica (~32 a 5′, ~65 a 10′, 100 a 14-15′): stesso ordine di grandezza', () => {
    // La formula indicata dà 27 / 69 / 100 a 12,9′: le stime della specifica sono approssimate.
    expect(rise(0, 0, 0, 5 * MIN)).toBeGreaterThan(25);
    expect(rise(0, 0, 0, 5 * MIN)).toBeLessThan(35);
    expect(rise(0, 0, 0, 10 * MIN)).toBeGreaterThan(60);
    expect(rise(0, 0, 0, 10 * MIN)).toBeLessThan(72);
    expect(minutesToReach(100)).toBeGreaterThan(12);
    expect(minutesToReach(100)).toBeLessThan(15);
  });
  it('mai oltre 100', () => {
    expect(rise(0, 0, 0, 40 * MIN)).toBe(100);
    expect(rise(95, 10 * MIN, 30 * MIN, 5 * MIN)).toBe(100);
  });
  it('spezzare il tempo in più tratti dà lo stesso risultato (ricostruzione esatta dopo una chiusura)', () => {
    const tutto = rise(0, 0, 0, 7 * MIN);
    const a = rise(0, 0, 0, 3 * MIN);
    const b = rise(a, 3 * MIN, 3 * MIN, 4 * MIN);
    expect(b).toBeCloseTo(tutto, 9);
  });
  it('i minuti totali già giocati fanno salire più in fretta', () => {
    expect(rise(0, 0, 20 * MIN, 5 * MIN)).toBeGreaterThan(rise(0, 0, 0, 5 * MIN));
  });
});

describe('b) in campo, cronometro fermo: scende piano (τ = 15 min reali)', () => {
  it('dopo 15 minuti reali resta il 36,8%', () => {
    expect(decayCourtStopped(50, 15 * MIN)).toBeCloseTo(50 * Math.exp(-1), 6);
  });
  it('un minuto di timeout fa scendere poco', () => {
    expect(decayCourtStopped(60, MIN)).toBeCloseTo(60 * Math.exp(-1 / 15), 6);
    expect(60 - decayCourtStopped(60, MIN)).toBeLessThan(4);
  });
});

describe('c) in panchina: scende in tempo reale (τ = 6 min reali)', () => {
  it('da 80, dopo 6 minuti reali ≈ 29', () => {
    expect(decayBench(80, 6 * MIN)).toBeCloseTo(29.43, 1);
    expect(Math.round(decayBench(80, 6 * MIN))).toBe(29);
  });
  it('scende più in fretta che in campo a cronometro fermo', () => {
    expect(decayBench(80, 3 * MIN)).toBeLessThan(decayCourtStopped(80, 3 * MIN));
  });
});

describe('regole', () => {
  it('INT sempre tra 0 e 100', () => {
    expect(rise(-20, 0, 0, 0)).toBe(0);
    expect(rise(150, 0, 0, 0)).toBe(100);
    expect(decayBench(-5, MIN)).toBe(0);
    expect(decayBench(Number.NaN, MIN)).toBe(0);
  });
  it('parametri presi dal file di configurazione', () => {
    const cfg = { ...INT_CONFIG, baseRate: 8 };
    expect(rise(0, 0, 0, MIN, cfg)).toBeGreaterThan(rise(0, 0, 0, MIN));
  });
});
