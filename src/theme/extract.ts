import { colorDistance, hexToHsl, rgbToHex } from './color';
import { loadImageUrl } from '@/lib/image';

export interface Swatch {
  hex: string;
  /** frazione dei pixel visibili (0-1) */
  share: number;
}

/** Colori dominanti di un'immagine (pixel opachi, quantizzati e raggruppati). */
export async function extractSwatches(src: string, max = 6): Promise<Swatch[]> {
  const img = await loadImageUrl(src);
  const S = 72;
  const k = S / Math.max(img.naturalWidth, img.naturalHeight);
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(img.naturalWidth * k));
  c.height = Math.max(1, Math.round(img.naturalHeight * k));
  const ctx = c.getContext('2d', { willReadFrequently: true })!;
  ctx.drawImage(img, 0, 0, c.width, c.height);
  const { data } = ctx.getImageData(0, 0, c.width, c.height);

  const bins = new Map<number, { n: number; r: number; g: number; b: number }>();
  let total = 0;
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 200) continue;
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const key = ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4);
    const e = bins.get(key) ?? { n: 0, r: 0, g: 0, b: 0 };
    e.n++;
    e.r += r;
    e.g += g;
    e.b += b;
    bins.set(key, e);
    total++;
  }
  if (!total) return [];
  const raw = [...bins.values()].map((e) => ({ hex: rgbToHex({ r: e.r / e.n, g: e.g / e.n, b: e.b / e.n }), n: e.n })).sort((a, b) => b.n - a.n);

  // raggruppa colori vicini
  const groups: { hex: string; n: number }[] = [];
  for (const c of raw) {
    const g = groups.find((x) => colorDistance(x.hex, c.hex) < 70);
    if (g) g.n += c.n;
    else groups.push({ ...c });
  }
  return groups
    .map((g) => ({ hex: g.hex, share: g.n / total }))
    .filter((s) => s.share >= 0.015)
    .sort((a, b) => b.share - a.share)
    .slice(0, max);
}

/** Proposta di colori squadra: primario = colore di base più esteso, secondario = colore più vivace e distinto. */
export function proposeTeamColors(swatches: Swatch[]): { primary: string; secondary: string } | null {
  const usable = swatches.filter((s) => {
    const h = hexToHsl(s.hex);
    return !(h.l > 0.9 || (h.s < 0.12 && h.l > 0.72)); // scarta bianchi e grigi chiari (sfondi, scritte)
  });
  if (!usable.length) return null;
  const primary = usable.find((s) => hexToHsl(s.hex).l <= 0.6) ?? usable[0];
  const rest = usable.filter((s) => s !== primary && colorDistance(s.hex, primary.hex) > 90);
  const score = (s: Swatch) => {
    const h = hexToHsl(s.hex);
    return Math.sqrt(s.share) * (0.25 + h.s) * (h.l > 0.15 ? 1 : 0.4);
  };
  const secondary = rest.sort((a, b) => score(b) - score(a))[0];
  return { primary: primary.hex, secondary: secondary?.hex ?? swatches.find((s) => s !== primary)?.hex ?? '#f2a900' };
}
