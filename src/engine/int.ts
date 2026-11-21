/**
 * Motore INT: funzioni PURE, nessuno stato e nessun timer.
 * Tutti i tempi in ingresso sono in millisecondi; internamente si ragiona in minuti.
 */
import { INT_CONFIG, type IntConfig } from './intConfig';

const MIN = 60_000;
export const clampInt = (v: number, cfg: IntConfig = INT_CONFIG) => Math.min(cfg.max, Math.max(cfg.min, Number.isFinite(v) ? v : 0));

/** Punti al minuto per un giocatore in campo con cronometro in corso. */
export function ratePerMin(consecutiveMs: number, totalMs: number, cfg: IntConfig = INT_CONFIG): number {
  return (cfg.baseRate + cfg.consecutiveCoef * (consecutiveMs / MIN)) * (1 + cfg.totalCoef * (totalMs / MIN));
}

/**
 * (a) Crescita in campo per `gameMs` di gioco, partendo da INT `int0`,
 * con `consecutiveMs` di gioco consecutivo e `totalMs` di gioco totale già accumulati.
 * Integrale esatto della velocità, che cresce con i minuti consecutivi e totali:
 *   ∫ (a + b·u)(p + q·u) du  con  a = base + k·c0,  b = k,  p = 1 + m·T0,  q = m
 */
export function rise(int0: number, consecutiveMs: number, totalMs: number, gameMs: number, cfg: IntConfig = INT_CONFIG): number {
  if (gameMs <= 0) return clampInt(int0, cfg);
  const t = gameMs / MIN;
  const a = cfg.baseRate + cfg.consecutiveCoef * (consecutiveMs / MIN);
  const b = cfg.consecutiveCoef;
  const p = 1 + cfg.totalCoef * (totalMs / MIN);
  const q = cfg.totalCoef;
  const gained = a * p * t + ((a * q + b * p) * t * t) / 2 + (b * q * t * t * t) / 3;
  return clampInt(int0 + gained, cfg);
}

/** Decadimento esponenziale con costante di tempo `tauMin` (minuti reali). */
export function decay(int0: number, realMs: number, tauMin: number, cfg: IntConfig = INT_CONFIG): number {
  if (realMs <= 0) return clampInt(int0, cfg);
  return clampInt(int0 * Math.exp(-realMs / MIN / tauMin), cfg);
}

/** (b) In campo a cronometro fermo: scende piano. */
export const decayCourtStopped = (int0: number, realMs: number, cfg: IntConfig = INT_CONFIG) => decay(int0, realMs, cfg.tauCourtStoppedMin, cfg);

/** (c) In panchina: scende dal valore di uscita, in tempo reale. */
export const decayBench = (intExit: number, realMs: number, cfg: IntConfig = INT_CONFIG) => decay(intExit, realMs, cfg.tauBenchMin, cfg);

/** Minuti di gioco necessari per arrivare a `target` partendo da 0 (ricerca binaria, per test e debug). */
export function minutesToReach(target: number, consecutiveMs = 0, totalMs = 0, cfg: IntConfig = INT_CONFIG): number {
  let lo = 0;
  let hi = 120 * MIN;
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    if (rise(0, consecutiveMs, totalMs, mid, cfg) >= target) hi = mid;
    else lo = mid;
  }
  return hi / MIN;
}
