/**
 * Motore INT (carico di fatica dello stint, scala 0–1): funzioni PURE.
 * Tempi in ingresso in millisecondi; internamente si ragiona in minuti. Modello in `intConfig.ts`.
 */
import { INT_CONFIG, INT_LEVELS, type IntConfig } from './intConfig';

const MIN = 60_000;
const clamp01 = (v: number) => (Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 0);

/** Velocità istantanea λ (per minuto) del carico acuto in campo. */
export function lambdaPerMin(consecutiveMs: number, totalMs: number, cfg: IntConfig = INT_CONFIG): number {
  return cfg.riseRate * (1 + cfg.consecutiveCoef * (consecutiveMs / MIN)) * (1 + cfg.totalCoef * (totalMs / MIN));
}

/** Integrale di λ su `gameMs` di gioco (min consecutivi e totali crescono insieme al tempo). */
function lambdaIntegral(consecutiveMs: number, totalMs: number, gameMs: number, cfg: IntConfig): number {
  const t = gameMs / MIN;
  const a = 1 + cfg.consecutiveCoef * (consecutiveMs / MIN);
  const b = cfg.consecutiveCoef;
  const p = 1 + cfg.totalCoef * (totalMs / MIN);
  const q = cfg.totalCoef;
  return cfg.riseRate * (a * p * t + ((a * q + b * p) * t * t) / 2 + (b * q * t * t * t) / 3);
}

/** a) Carico acuto dopo `gameMs` di gioco in campo (soluzione esatta: 1 − (1 − A0)·e^(−∫λ)). */
export function riseAcute(a0: number, consecutiveMs: number, totalMs: number, gameMs: number, cfg: IntConfig = INT_CONFIG): number {
  if (gameMs <= 0) return clamp01(a0);
  return clamp01(1 - (1 - clamp01(a0)) * Math.exp(-lambdaIntegral(consecutiveMs, totalMs, gameMs, cfg)));
}

/** Inverso di `riseAcute` per una correzione all'indietro di `gameMs` (±5 s). */
export function unriseAcute(a: number, consecutiveMs: number, totalMs: number, gameMs: number, cfg: IntConfig = INT_CONFIG): number {
  if (gameMs <= 0) return clamp01(a);
  const c0 = Math.max(0, consecutiveMs - gameMs);
  const t0 = Math.max(0, totalMs - gameMs);
  return clamp01(1 - (1 - clamp01(a)) * Math.exp(lambdaIntegral(c0, t0, gameMs, cfg)));
}

export function decay(a0: number, realMs: number, tauMin: number): number {
  if (realMs <= 0) return clamp01(a0);
  return clamp01(a0 * Math.exp(-realMs / MIN / tauMin));
}

/** b) In campo a cronometro fermo: il carico acuto scende piano. */
export const decayCourtStopped = (a0: number, realMs: number, cfg: IntConfig = INT_CONFIG) => decay(a0, realMs, cfg.tauCourtStoppedMin);

/** τ del recupero in panchina: più lento se si è giocato tanto. */
export const tauBenchMin = (totalMs: number, cfg: IntConfig = INT_CONFIG) => cfg.tauBenchMin * (1 + cfg.tauBenchTotalCoef * (totalMs / MIN));

/** c) In panchina: il carico acuto scende dal valore di uscita, in tempo reale. */
export const decayBench = (aExit: number, realMs: number, totalMs: number, cfg: IntConfig = INT_CONFIG) => decay(aExit, realMs, tauBenchMin(totalMs, cfg));

/** Fatica residua dovuta ai minuti giocati (non si recupera durante la partita). */
export const residual = (totalMs: number, cfg: IntConfig = INT_CONFIG) => Math.min(cfg.residualMax, cfg.residualPerMin * (totalMs / MIN));

/** INT finale 0–1 = residuo + (1 − residuo) · carico acuto. */
export const combineInt = (acute: number, totalMs: number, cfg: IntConfig = INT_CONFIG) => {
  const r = residual(totalMs, cfg);
  return clamp01(r + (1 - r) * clamp01(acute));
};

/** INT dopo `gameMs` di gioco consecutivo partendo da riposato (per test e taratura). */
export const intAfterPlay = (gameMs: number, cfg: IntConfig = INT_CONFIG) => combineInt(riseAcute(0, 0, 0, gameMs, cfg), gameMs, cfg);

/** Minuti di gioco consecutivo per raggiungere `target` partendo da riposato. */
export function minutesToReach(target: number, cfg: IntConfig = INT_CONFIG): number {
  let lo = 0;
  let hi = 120 * MIN;
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    if (intAfterPlay(mid, cfg) >= target) hi = mid;
    else lo = mid;
  }
  return hi / MIN;
}

/** "0,65" */
export const fmtInt = (v: number) => clamp01(v).toFixed(2).replace('.', ',');

export function intLevel(v: number): string {
  let label: string = INT_LEVELS[0].label;
  for (const l of INT_LEVELS) if (v >= l.from) label = l.label;
  return label;
}
