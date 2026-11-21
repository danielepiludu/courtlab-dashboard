import { describe, expect, it } from 'vitest';
import { buildPalette, DEFAULT_PRIMARY, DEFAULT_SECONDARY, MIN_TEXT_CONTRAST, MIN_UI_CONTRAST, TEXT, TEXT_MUTED } from './palette';
import { contrast, hslToHex, luminance } from './color';

// Griglia di colori: tinte ogni 30°, varie saturazioni e luminosità, più bianco/nero/grigi
const SAMPLES: string[] = ['#000000', '#ffffff', '#808080', '#f5f5f5', '#111111', '#ffff00', '#00ffff', '#ff00ff'];
for (let h = 0; h < 360; h += 30) for (const s of [0.3, 0.7, 1]) for (const l of [0.1, 0.3, 0.5, 0.7, 0.9]) SAMPLES.push(hslToHex(h, s, l));

const PAIRS: [string, string][] = [];
for (let i = 0; i < SAMPLES.length; i += 3) for (let j = 1; j < SAMPLES.length; j += 7) PAIRS.push([SAMPLES[i], SAMPLES[j]]);

describe('buildPalette — regole di sicurezza', () => {
  it(`copre ${PAIRS.length} combinazioni`, () => expect(PAIRS.length).toBeGreaterThan(300));

  it.each(PAIRS)('primario %s / secondario %s', (p, s) => {
    const { palette: c } = buildPalette(p, s);
    // sfondi sempre scuri
    for (const layer of [c.bg, c.surface, c.surface2, c.surface3, c.bar]) {
      expect(luminance(layer)).toBeLessThan(0.05);
      expect(contrast(TEXT, layer)).toBeGreaterThanOrEqual(MIN_TEXT_CONTRAST);
      expect(contrast(TEXT_MUTED, layer)).toBeGreaterThanOrEqual(MIN_TEXT_CONTRAST);
    }
    expect(luminance(c.bg)).toBeLessThan(0.015);
    // testo su accento e selezione
    expect(contrast(c.onBrand, c.brand)).toBeGreaterThanOrEqual(MIN_TEXT_CONTRAST);
    expect(contrast(c.onSelect, c.select)).toBeGreaterThanOrEqual(MIN_TEXT_CONTRAST);
    // accenti visibili e varianti testo leggibili
    expect(contrast(c.brand, c.bg)).toBeGreaterThanOrEqual(MIN_UI_CONTRAST);
    expect(contrast(c.select, c.bg)).toBeGreaterThanOrEqual(MIN_UI_CONTRAST);
    expect(contrast(c.brandText, c.surface)).toBeGreaterThanOrEqual(MIN_TEXT_CONTRAST);
    expect(contrast(c.selectText, c.surface)).toBeGreaterThanOrEqual(MIN_TEXT_CONTRAST);
  });
});

describe('buildPalette — squadra predefinita Don Bosco', () => {
  const { palette } = buildPalette(DEFAULT_PRIMARY, DEFAULT_SECONDARY);
  it('header e tab bar restano il navy del logo', () => expect(palette.bar).toBe('#002855'));
  it("l'accento resta rosso, solo leggermente scurito per il testo bianco", () => {
    expect(palette.onBrand).toBe('#ffffff');
    expect(contrast(palette.brand, DEFAULT_SECONDARY)).toBeLessThan(1.15);
  });
  it('la selezione è un azzurro', () => {
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(palette.select.slice(i, i + 2), 16));
    expect(b).toBeGreaterThan(r + 80);
    expect(b).toBeGreaterThan(g);
  });
});

describe('buildPalette — colori troppo simili', () => {
  it("se primario e secondario coincidono, l'accento si distingue dallo sfondo", () => {
    const { palette, adjusted } = buildPalette('#0a2a5c', '#0b2d61');
    expect(adjusted).toBe(true);
    expect(contrast(palette.brand, palette.surface)).toBeGreaterThanOrEqual(MIN_UI_CONTRAST);
  });
});
