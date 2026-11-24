/**
 * Configurazione generale dell'app.
 * I parametri del motore INT vivono in `engine/intConfig.ts` (Fase 3).
 */
export const APP = {
  name: 'Courtlab',
  version: '2.7.3',
  author: 'Daniele Piludu',
  credit: 'powered by Daniele Piludu',
} as const;

/** Squadra presente al primo avvio (generica: nome, colori e logo si cambiano dalle impostazioni) */
export const DEFAULT_TEAM = {
  name: 'La mia squadra',
  season: currentSeason(),
  primary: '#0b2547',
  secondary: '#ff8a1f',
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

/** Stagione sportiva corrente: da agosto in poi "AAAA/AA+1". */
export function currentSeason(d = new Date()): string {
  const y = d.getMonth() >= 7 ? d.getFullYear() : d.getFullYear() - 1;
  return `${y}/${String((y + 1) % 100).padStart(2, '0')}`;
}

/** "2026/27" -> "2027/28"; altrimenti la stagione corrente. */
export function nextSeason(season: string): string {
  const m = season.match(/^(\d{4})\s*[/-]\s*(\d{2}|\d{4})$/);
  if (!m) return currentSeason();
  const y = Number(m[1]) + 1;
  return `${y}/${String((y + 1) % 100).padStart(2, '0')}`;
}
