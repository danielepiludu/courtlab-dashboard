/**
 * Parametri del modello INT (carico di fatica di uno "stint", scala 0–1).
 *
 * Idea (dalla letteratura sul basket):
 *  - lo stint dice quanto un giocatore resta in campo, non quanto quel tempo gli è costato:
 *    il carico sale col tempo di gioco EFFETTIVO (cronometro in corso), non con i tempi morti
 *    [Stojanović et al., 2018 — domande e risposte fisiologiche nel basket: attività intermittente];
 *  - più a lungo si resta in campo di fila, più il carico cresce in fretta (fatica acuta dello stint);
 *  - il tempo accumulato nella partita riduce i picchi di prestazione: chi ha già giocato molto
 *    si affatica prima e recupera più lentamente
 *    [Pérez-Chao et al., 2021 — più minuti accumulati riducono i picchi di richiesta];
 *  - il cambio serve a recuperare: in panchina il carico acuto scende in modo esponenziale
 *    [Gómez et al., 2016 — effetti delle sostituzioni].
 *
 * Modello:
 *   carico acuto A ∈ [0,1):
 *     a) in campo, cronometro in corso:   dA/dt = k · (1 + aC·min_consecutivi) · (1 + aT·min_totali) · (1 − A)
 *     b) in campo, cronometro fermo:      A · exp(−t / τ_fermo)                       (tempo reale)
 *     c) in panchina:                     A_uscita · exp(−t / τ_panchina)              (tempo reale)
 *                                          τ_panchina = τ0 · (1 + bT·min_totali)       (recupero più lento a fine gara)
 *   residuo R = min(Rmax, r · min_totali)       — fatica accumulata che non si recupera durante la partita
 *   INT = R + (1 − R) · A                       — sempre tra 0 e 1
 *
 * Da riposato (0 minuti): INT ≈ 0,37 dopo 5′, ≈ 0,67 dopo 10′, ≈ 0,86 dopo 15′ di gioco consecutivo.
 */
export interface IntConfig {
  /** k: velocità di salita base (per minuto di gioco) */
  riseRate: number;
  /** aC: quanto accelera per ogni minuto consecutivo */
  consecutiveCoef: number;
  /** aT: quanto accelera per ogni minuto giocato in totale */
  totalCoef: number;
  /** τ in campo a cronometro fermo (minuti reali) */
  tauCourtStoppedMin: number;
  /** τ0 in panchina (minuti reali) */
  tauBenchMin: number;
  /** bT: quanto rallenta il recupero per ogni minuto giocato in totale */
  tauBenchTotalCoef: number;
  /** r: residuo per minuto giocato */
  residualPerMin: number;
  /** Rmax: residuo massimo */
  residualMax: number;
  /** intervallo dei campioni per il grafico (ms reali) */
  sampleEveryMs: number;
}

export const INT_CONFIG: Readonly<IntConfig> = {
  riseRate: 0.07,
  consecutiveCoef: 0.08,
  totalCoef: 0.015,
  tauCourtStoppedMin: 15,
  tauBenchMin: 5,
  tauBenchTotalCoef: 0.02,
  residualPerMin: 0.005,
  residualMax: 0.3,
  sampleEveryMs: 30_000,
};

/** Soglie per colori ed etichette */
export const INT_LEVELS = [
  { from: 0, label: 'Fresco' },
  { from: 0.35, label: 'Attivo' },
  { from: 0.6, label: 'Affaticato' },
  { from: 0.8, label: 'Da cambiare' },
] as const;
