/**
 * Configurazione generale dell'app.
 * I parametri del motore INT vivono in `engine/intConfig.ts` (Fase 3).
 */
export const APP = {
  name: 'Don Bosco Basket Monitor',
  team: 'Don Bosco',
  club: 'Pallacanestro Don Bosco Livorno',
  version: '1.0.0',
} as const;

export const GAME = {
  /** Durata di un quarto (Q1-Q4) in millisecondi */
  quarterMs: 10 * 60 * 1000,
  /** Durata di un supplementare (OT) in millisecondi */
  overtimeMs: 5 * 60 * 1000,
  quarters: 4,
  /** Numero di giocatori in campo */
  onCourt: 5,
} as const;

/** Durata minima della splash screen (ms) */
export const SPLASH_MIN_MS = 1100;
