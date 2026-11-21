import { describe, expect, it } from 'vitest';
import { CARD_H, CARD_W, COURT, SLOTS_M, VIEW_H, VIEW_W } from './courtGeometry';

const cw = CARD_W * VIEW_W;
const ch = CARD_H * VIEW_H;
const dist = (x: number, y: number) => Math.hypot(x - COURT.basketX, y - COURT.basketY);
const paint = { x0: COURT.length - COURT.paintDepth, y0: COURT.basketY - COURT.paintWidth / 2, y1: COURT.basketY + COURT.paintWidth / 2 };

describe('posizioni dei 5 in campo', () => {
  it('nessuna sovrapposizione tra card (margine ≥ 10 cm)', () => {
    for (let i = 0; i < 5; i++)
      for (let j = i + 1; j < 5; j++) {
        const [ax, ay] = SLOTS_M[i];
        const [bx, by] = SLOTS_M[j];
        const gapX = Math.abs(ax - bx) - cw;
        const gapY = Math.abs(ay - by) - ch;
        expect(Math.max(gapX, gapY), `card ${i} e ${j}`).toBeGreaterThanOrEqual(0.1);
      }
  });
  it('tutte le card restano dentro la vista del campo', () => {
    for (const [x, y] of SLOTS_M) {
      expect(x - cw / 2).toBeGreaterThanOrEqual(COURT.x0);
      expect(x + cw / 2).toBeLessThanOrEqual(COURT.x1);
      expect(y - ch / 2).toBeGreaterThanOrEqual(COURT.y0);
      expect(y + ch / 2).toBeLessThanOrEqual(COURT.y1);
    }
  });
  it('3 esterni fuori dall\'arco da 3, non negli angoli', () => {
    for (const [x, y] of SLOTS_M.slice(0, 3)) {
      expect(dist(x, y)).toBeGreaterThan(COURT.threeR);
      expect(x).toBeLessThan(COURT.basketX - 3); // lontani dalla linea di fondo
    }
  });
  it('2 lunghi dentro il pitturato', () => {
    for (const [x, y] of SLOTS_M.slice(3)) {
      expect(x).toBeGreaterThan(paint.x0);
      expect(x).toBeLessThan(COURT.length);
      expect(y).toBeGreaterThan(paint.y0);
      expect(y).toBeLessThan(paint.y1);
    }
  });
  it('la punta non copre il logo nel cerchio di centrocampo', () => {
    expect(SLOTS_M[0][0] - cw / 2).toBeGreaterThan(COURT.centerR);
  });
});
