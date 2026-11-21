import { describe, expect, it } from 'vitest';
import { CARD_H, CARD_W, CORE, COURT, SLOTS_M, computeView } from './courtGeometry';

const rect = ([x, y]: [number, number]) => ({ l: x - CARD_W / 2, r: x + CARD_W / 2, t: y - CARD_H / 2, b: y + CARD_H / 2 });
const paint = { l: COURT.basketX - COURT.paintWidth / 2, r: COURT.basketX + COURT.paintWidth / 2, b: COURT.paintDepth };

describe('posizioni dei 5 in campo (campo verticale, canestro in alto)', () => {
  it('nessuna sovrapposizione tra card (margine ≥ 10 cm)', () => {
    for (let i = 0; i < 5; i++)
      for (let j = i + 1; j < 5; j++) {
        const a = rect(SLOTS_M[i]);
        const b = rect(SLOTS_M[j]);
        const gap = Math.max(b.l - a.r, a.l - b.r, b.t - a.b, a.t - b.b);
        expect(gap, `card ${i} e ${j}`).toBeGreaterThanOrEqual(0.1);
      }
  });
  it("tutte le card stanno nell'area sempre visibile", () => {
    for (const p of SLOTS_M) {
      const r = rect(p);
      expect(r.l).toBeGreaterThanOrEqual(CORE.x0);
      expect(r.r).toBeLessThanOrEqual(CORE.x1);
      expect(r.t).toBeGreaterThanOrEqual(CORE.y0);
      expect(r.b).toBeLessThanOrEqual(CORE.y1);
    }
  });
  it("3 esterni fuori dall'arco da 3 e non negli angoli", () => {
    for (const [x, y] of SLOTS_M.slice(0, 3)) {
      expect(Math.hypot(x - COURT.basketX, y - COURT.basketY)).toBeGreaterThan(COURT.threeR);
      expect(y).toBeGreaterThan(5); // lontani dalla linea di fondo (gli angoli sono a y < 3)
    }
  });
  it('2 lunghi dentro il pitturato', () => {
    for (const [x, y] of SLOTS_M.slice(3)) {
      expect(x).toBeGreaterThan(paint.l);
      expect(x).toBeLessThan(paint.r);
      expect(y).toBeLessThan(paint.b);
    }
  });
  it('il ferro resta visibile', () => {
    for (const p of SLOTS_M) {
      const r = rect(p);
      const covers = r.l < COURT.basketX + COURT.rimR && r.r > COURT.basketX - COURT.rimR && r.t < COURT.basketY + COURT.rimR && r.b > COURT.basketY - COURT.rimR;
      expect(covers).toBe(false);
    }
  });
});

describe('vista del campo', () => {
  it('telefono orizzontale: logo sul bordo campo ai lati', () => {
    const v = computeView(610, 300);
    expect(v.showApronLogos).toBe(true);
    expect(v.h).toBeCloseTo(CORE.y1 - CORE.y0, 5);
  });
  it('tablet: se ai lati non c\'è spazio, si vede il cerchio di centrocampo', () => {
    const v = computeView(870, 690);
    expect(v.y0 + v.h).toBeGreaterThanOrEqual(COURT.half + COURT.centerR);
  });
  it('il campo è sempre centrato e interamente visibile', () => {
    for (const [W, H] of [[610, 300], [870, 690], [400, 600], [1200, 300]]) {
      const v = computeView(W, H);
      expect(v.x0).toBeLessThanOrEqual(CORE.x0 + 1e-9);
      expect(v.x0 + v.w).toBeGreaterThanOrEqual(CORE.x1 - 1e-9);
      expect(v.y0 + v.h).toBeGreaterThanOrEqual(CORE.y1 - 1e-9);
    }
  });
});
