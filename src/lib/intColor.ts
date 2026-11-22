// --- Scala funzionale INT 0–1: bianco → giallo → arancio → rosso (indipendente dal tema) ---
const INT_STOPS: [number, [number, number, number]][] = [
  [0, [255, 255, 255]],
  [0.35, [255, 214, 10]],
  [0.65, [255, 140, 26]],
  [1, [255, 46, 46]],
];
export const INT_GRADIENT = 'linear-gradient(90deg, #ffffff 0%, #ffd60a 35%, #ff8c1a 65%, #ff2e2e 100%)';
export const INT_HOT = 0.8;

export function intColor(v: number): string {
  const x = Math.min(1, Math.max(0, Number.isFinite(v) ? v : 0));
  for (let i = 1; i < INT_STOPS.length; i++) {
    const [b, cb] = INT_STOPS[i];
    const [a, ca] = INT_STOPS[i - 1];
    if (x <= b) {
      const t = (x - a) / (b - a);
      return `rgb(${ca.map((c, k) => Math.round(c + (cb[k] - c) * t)).join(',')})`;
    }
  }
  return 'rgb(255,46,46)';
}
