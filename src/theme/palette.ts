import { contrast, darken, hexToHsl, hslToHex, hueDistance, lighten, luminance, colorDistance, normalizeHex } from './color';

/**
 * Generatore della palette scura dai due colori della squadra.
 *
 * Regole di sicurezza:
 * - gli sfondi (app, card, header) sono SEMPRE scuri, qualunque colore venga scelto;
 * - testo e testo secondario hanno contrasto >= 4.5:1 su tutti gli sfondi;
 * - il testo sui pulsanti (accento) e sulle selezioni ha contrasto >= 4.5:1;
 * - gli accenti restano visibili sullo sfondo (>= 3:1);
 * - se i due colori sono troppo simili, l'accento si ricava dalla variante più luminosa.
 */

export const TEXT = '#e8ecf4';
export const TEXT_MUTED = '#9aa6bf';
export const TEXT_FAINT = '#5e6b88';
const ON_LIGHT = '#05070d';
const WHITE = '#ffffff';

export const MIN_TEXT_CONTRAST = 4.5;
export const MIN_UI_CONTRAST = 3;

export interface Palette {
  bg: string; // sfondo app
  surface: string; // card e pannelli
  surface2: string; // elementi in rilievo
  surface3: string;
  bar: string; // header e tab bar
  line: string; // bordi sottili
  brand: string; // accento primario (pulsanti principali, tab attiva, "Termina partita")
  brandStrong: string; // accento premuto
  brandText: string; // accento usato come colore di testo
  onBrand: string; // testo sopra l'accento
  select: string; // accento di selezione
  selectText: string; // selezione usata come colore di testo
  onSelect: string; // testo sopra la selezione
}

export interface PaletteResult {
  palette: Palette;
  /** true se almeno un colore della squadra è stato corretto per la leggibilità */
  adjusted: boolean;
}

export const DEFAULT_PRIMARY = '#002855';
export const DEFAULT_SECONDARY = '#ee3239';

/** Scurisce uno sfondo finché il testo secondario raggiunge il contrasto minimo. */
function safeLayer(h: number, s: number, l: number): string {
  let hex = hslToHex(h, s, l);
  for (let i = 0; i < 40 && contrast(TEXT_MUTED, hex) < MIN_TEXT_CONTRAST; i++) {
    l = Math.max(0, l - 0.01);
    hex = hslToHex(h, s, l);
  }
  return hex;
}

/** Schiarisce finché il colore è visibile sullo sfondo. */
function ensureVisible(color: string, bg: string, min = MIN_UI_CONTRAST): string {
  let c = color;
  for (let i = 0; i < 50 && contrast(c, bg) < min; i++) c = lighten(c, 0.04);
  return c;
}

/** Variante usabile come colore di testo su `bg` (>= 4.5:1). */
function asText(color: string, bg: string): string {
  let c = color;
  for (let i = 0; i < 60 && contrast(c, bg) < MIN_TEXT_CONTRAST; i++) c = lighten(c, 0.03);
  return c;
}

/**
 * Colore di riempimento + colore del testo sopra, con contrasto >= 4.5:1.
 * I colori medi vengono leggermente scuriti per tenere il testo bianco;
 * quelli chiari tengono la loro tinta e usano testo scuro.
 */
function fillWithText(color: string): { fill: string; on: string } {
  if (luminance(color) > 0.3) return { fill: color, on: ON_LIGHT };
  let c = color;
  for (let i = 0; i < 40 && contrast(WHITE, c) < MIN_TEXT_CONTRAST; i++) c = darken(c, 0.02);
  return { fill: c, on: WHITE };
}

export function buildPalette(primaryIn: string, secondaryIn: string): PaletteResult {
  const primary = normalizeHex(primaryIn) ?? DEFAULT_PRIMARY;
  const secondary = normalizeHex(secondaryIn) ?? DEFAULT_SECONDARY;
  const P = hexToHsl(primary);
  const S = hexToHsl(secondary);
  const grayP = P.s < 0.08;
  const h = P.h;

  // --- Sfondi (sempre scuri) ---
  const bg = safeLayer(h, grayP ? P.s : Math.min(P.s, 0.7), 0.06);
  const surface = safeLayer(h, grayP ? P.s : Math.min(P.s, 0.6), 0.12);
  const surface2 = safeLayer(h, grayP ? P.s : Math.min(P.s, 0.55), 0.155);
  const surface3 = safeLayer(h, grayP ? P.s : Math.min(P.s, 0.5), 0.19);
  const bar = safeLayer(h, P.s, Math.min(0.2, Math.max(0.13, P.l)));
  const line = hslToHex(h, grayP ? P.s : Math.min(P.s, 0.45), 0.22);

  // --- Accento primario: il colore secondario ---
  let base = secondary;
  const tooSimilar = colorDistance(primary, secondary) < 110 || (hueDistance(P.h, S.h) < 18 && Math.abs(P.l - S.l) < 0.18 && !grayP);
  if (tooSimilar) {
    // ricava l'accento dalla variante più luminosa dei due
    const lighter = luminance(primary) > luminance(secondary) ? primary : secondary;
    const L = hexToHsl(lighter);
    base = hslToHex(L.h, Math.max(L.s, 0.55), Math.max(L.l, 0.55));
  }
  const brandFill = fillWithText(ensureVisible(base, bg));
  const brand = brandFill.fill;
  const onBrand = brandFill.on;
  const brandStrong = darken(brand, 0.12);
  const brandText = asText(brand, surface);

  // --- Accento di selezione: variante chiara del primario (o del secondario se il primario è grigio) ---
  const selBase = !grayP && P.s >= 0.25 ? { h: P.h, s: Math.min(0.85, Math.max(P.s, 0.65)) } : { h: S.h, s: S.s < 0.08 ? 0 : Math.min(0.85, Math.max(S.s, 0.6)) };
  const B = hexToHsl(brand);
  const clashes = selBase.s > 0.1 && B.s > 0.1 && hueDistance(selBase.h, B.h) < 30;
  let select = hslToHex(selBase.h, selBase.s, clashes ? 0.64 : 0.46);
  select = ensureVisible(select, bg);
  const selFill = fillWithText(select);
  select = selFill.fill;
  const onSelect = selFill.on;
  const selectText = asText(select, surface);

  const palette: Palette = { bg, surface, surface2, surface3, bar, line, brand, brandStrong, brandText, onBrand, select, selectText, onSelect };
  return { palette, adjusted: tooSimilar || colorDistance(brand, secondary) > 25 };
}

/** Nomi delle variabili CSS (registrate in index.css con @property per le transizioni). */
export const CSS_VARS: Record<keyof Palette, string> = {
  bg: '--c-bg',
  surface: '--c-surface',
  surface2: '--c-surface-2',
  surface3: '--c-surface-3',
  bar: '--c-bar',
  line: '--c-line',
  brand: '--c-brand',
  brandStrong: '--c-brand-strong',
  brandText: '--c-brand-text',
  onBrand: '--c-on-brand',
  select: '--c-select',
  selectText: '--c-select-text',
  onSelect: '--c-on-select',
};

export function paletteToVars(p: Palette): Record<string, string> {
  const out: Record<string, string> = {};
  (Object.keys(CSS_VARS) as (keyof Palette)[]).forEach((k) => (out[CSS_VARS[k]] = p[k]));
  return out;
}
