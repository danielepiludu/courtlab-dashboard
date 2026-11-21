/**
 * Geometria del mezzo campo FIBA (metri), orizzontale con canestro a destra.
 * Il campo visibile include tutto il cerchio di centrocampo (con il logo della squadra).
 */
export const COURT = {
  /** bordo sinistro della vista (oltre la linea di metà campo, per mostrare tutto il cerchio centrale) */
  x0: -2.4,
  x1: 14.2,
  y0: -0.2,
  y1: 15.2,
  length: 14, // metà campo
  width: 15,
  basketX: 14 - 1.575,
  basketY: 7.5,
  threeR: 6.75,
  cornerY: 0.9, // distanza delle linee da 3 dai lati
  paintDepth: 5.8,
  paintWidth: 4.9,
  ftR: 1.8,
  centerR: 1.8,
  restrictedR: 1.25,
} as const;

export const VIEW_W = COURT.x1 - COURT.x0;
export const VIEW_H = COURT.y1 - COURT.y0;
export const ASPECT = VIEW_W / VIEW_H;

/** Dimensioni della card giocatore in campo, in frazione della vista. */
export const CARD_W = 0.245;
export const CARD_H = 0.3;

/**
 * Posizioni (centro card, in metri): 0 punta, 1 ala alta, 2 ala bassa (fuori dall'arco, non negli angoli),
 * 3 lungo alto e 4 lungo basso (dentro il pitturato).
 */
export const SLOTS_M: [number, number][] = [
  [3.9, 7.5],
  [6.4, 2.45],
  [6.4, 12.55],
  [10.6, 5.15],
  [12.15, 9.9],
];

/** Posizioni in percentuale della vista (per il posizionamento CSS). */
export const SLOTS_PCT = SLOTS_M.map(([x, y]) => [((x - COURT.x0) / VIEW_W) * 100, ((y - COURT.y0) / VIEW_H) * 100] as [number, number]);
