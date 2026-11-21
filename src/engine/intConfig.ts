/**
 * Parametri del motore INT (carico di fatica 0-100).
 *
 *  a) In campo, cronometro in corso (sale):
 *       punti_al_minuto = (baseRate + consecutiveCoef × minuti_consecutivi) × (1 + totalCoef × minuti_totali_giocati)
 *  b) In campo, cronometro fermo (scende piano):  INT × exp(−t / tauCourtStoppedMin)   [t = minuti reali]
 *  c) In panchina (scende, tempo reale):          INT_uscita × exp(−t / tauBenchMin)   [t = minuti reali]
 */
export interface IntConfig {
  baseRate: number;
  consecutiveCoef: number;
  totalCoef: number;
  tauCourtStoppedMin: number;
  tauBenchMin: number;
  min: number;
  max: number;
  sampleEveryMs: number;
}

export const INT_CONFIG: Readonly<IntConfig> = {
  baseRate: 4,
  consecutiveCoef: 0.5,
  totalCoef: 0.01,
  tauCourtStoppedMin: 15,
  tauBenchMin: 6,
  min: 0,
  max: 100,
  /** intervallo dei campioni per il grafico dell'INT nel tempo (ms reali) */
  sampleEveryMs: 30_000,
};
