import { describe, expect, it } from 'vitest';
import { INT_CONFIG } from './intConfig';
import { combineInt, decayBench, decayCourtStopped, fmtInt, intAfterPlay, lambdaPerMin, minutesToReach, residual, riseAcute, stopRecoveryMs, tauBenchMin, unriseAcute } from './int';

const MIN = 60_000;

describe('a) in campo, cronometro in corso', () => {
  it('da riposato: ≈0,37 dopo 5′, ≈0,67 dopo 10′, ≈0,86 dopo 15′', () => {
    expect(intAfterPlay(5 * MIN)).toBeCloseTo(0.37, 2);
    expect(intAfterPlay(10 * MIN)).toBeCloseTo(0.67, 2);
    expect(intAfterPlay(15 * MIN)).toBeCloseTo(0.86, 2);
    expect(minutesToReach(0.5)).toBeGreaterThan(6.5);
    expect(minutesToReach(0.5)).toBeLessThan(8);
  });
  it('cresce sempre: quasi costante nei primi 8 minuti, poi rallenta avvicinandosi a 1 senza raggiungerlo', () => {
    let prev = 0;
    for (let m = 1; m <= 40; m++) {
      const v = intAfterPlay(m * MIN);
      const step = v - prev;
      expect(v).toBeGreaterThan(prev);
      expect(v).toBeLessThan(1);
      if (m <= 8) expect(step).toBeGreaterThan(0.06);
      if (m >= 16) expect(step).toBeLessThan(0.03);
      prev = v;
    }
  });
  it('più minuti consecutivi o totali alle spalle → sale più in fretta', () => {
    expect(lambdaPerMin(6 * MIN, 0)).toBeGreaterThan(lambdaPerMin(0, 0));
    expect(lambdaPerMin(0, 25 * MIN)).toBeGreaterThan(lambdaPerMin(0, 0));
    expect(riseAcute(0, 0, 25 * MIN, 5 * MIN)).toBeGreaterThan(riseAcute(0, 0, 0, 5 * MIN));
  });
  it('spezzare il tempo in tratti dà lo stesso risultato (ricostruzione esatta)', () => {
    const tutto = riseAcute(0.1, 0, 0, 7 * MIN);
    const a = riseAcute(0.1, 0, 0, 3 * MIN);
    expect(riseAcute(a, 3 * MIN, 3 * MIN, 4 * MIN)).toBeCloseTo(tutto, 12);
  });
  it('la correzione all\'indietro (−5 s) annulla quella in avanti', () => {
    const a = riseAcute(0.4, 2 * MIN, 9 * MIN, 5000);
    expect(unriseAcute(a, 2 * MIN + 5000, 9 * MIN + 5000, 5000)).toBeCloseTo(0.4, 12);
  });
});

describe('b) in campo, cronometro fermo (tempi morti)', () => {
  it('le interruzioni brevi (≤ 20 s: fallo, rimessa, liberi) non fanno recuperare', () => {
    expect(stopRecoveryMs(0, 0, 20_000)).toBe(0);
    expect(stopRecoveryMs(0, 0, 60_000)).toBe(40_000); // timeout: 40 s di recupero
    expect(stopRecoveryMs(0, 30_000, 60_000)).toBe(30_000); // spezzato in due tratti: stesso totale
  });
  it('poi scende piano: τ 10 minuti reali', () => {
    expect(decayCourtStopped(0.6, 10 * MIN)).toBeCloseTo(0.6 * Math.exp(-1), 9);
    expect(0.6 - decayCourtStopped(0.6, 40_000)).toBeLessThan(0.05);
  });
});

describe('c) in panchina (recupero)', () => {
  it('da 0,8 con 10 minuti giocati, dopo 6 minuti reali ≈ 0,29', () => {
    expect(tauBenchMin(10 * MIN)).toBeCloseTo(6, 9);
    expect(decayBench(0.8, 6 * MIN, 10 * MIN)).toBeCloseTo(0.294, 3);
  });
  it('chi ha giocato di più recupera più lentamente', () => {
    expect(decayBench(0.8, 4 * MIN, 30 * MIN)).toBeGreaterThan(decayBench(0.8, 4 * MIN, 5 * MIN));
  });
  it('in panchina si recupera più che a cronometro fermo in campo', () => {
    expect(decayBench(0.8, 3 * MIN, 10 * MIN)).toBeLessThan(decayCourtStopped(0.8, 3 * MIN));
  });
});

describe('residuo e regole', () => {
  it('il residuo cresce con i minuti giocati, fino al massimo', () => {
    expect(residual(0)).toBe(0);
    expect(residual(20 * MIN)).toBeCloseTo(0.1, 9);
    expect(residual(200 * MIN)).toBe(INT_CONFIG.residualMax);
  });
  it('a fine recupero l\'INT non torna a 0 se si è giocato molto', () => {
    expect(combineInt(decayBench(0.9, 60 * MIN, 30 * MIN), 30 * MIN)).toBeGreaterThan(0.15);
  });
  it('INT sempre tra 0 e 1', () => {
    expect(combineInt(-3, 0)).toBe(0);
    expect(combineInt(7, 500 * MIN)).toBe(1);
    expect(combineInt(Number.NaN, 0)).toBe(0);
  });
  it('formato italiano a due decimali', () => {
    expect(fmtInt(0.654)).toBe('0,65');
    expect(fmtInt(1.2)).toBe('1,00');
  });
  it('parametri presi dal file di configurazione', () => {
    expect(intAfterPlay(5 * MIN, { ...INT_CONFIG, riseRate: 0.14 })).toBeGreaterThan(intAfterPlay(5 * MIN));
  });
});
