/**
 * Geometria del mezzo campo FIBA (metri), VERTICALE con canestro in alto.
 * X = larghezza (0 linea laterale sinistra … 15 destra), Y = profondità (0 linea di fondo … 14 metà campo).
 * Il parquet continua oltre le linee (bordo campo) per riempire lo spazio disponibile:
 * lì, se c'è spazio, compare il logo della squadra; altrimenti è visibile il cerchio di centrocampo col logo.
 */
export const COURT = {
  width: 15,
  half: 14, // linea di metà campo
  basketX: 7.5,
  basketY: 1.575,
  rimR: 0.23,
  backboardY: 1.2,
  threeR: 6.75,
  cornerX: 0.9, // distanza delle linee da 3 dai lati
  paintDepth: 5.8,
  paintWidth: 4.9,
  ftR: 1.8,
  centerR: 1.8,
  restrictedR: 1.25,
} as const;

/** Area minima sempre visibile (con margine attorno alle linee). */
export const CORE = { x0: -0.3, x1: 15.3, y0: -0.3, y1: 13.6, y1WithCenter: 16.3 } as const;

/** Card giocatore in campo (metri). */
export const CARD_W = 3.9;
export const CARD_H = 4.6;

/**
 * Posizioni (centro card, metri): 0 punta, 1 ala sinistra, 2 ala destra (fuori dall'arco, non negli angoli),
 * 3-4 lunghi dentro il pitturato, sotto al ferro così il canestro resta visibile.
 */
export const SLOTS_M: [number, number][] = [
  [7.5, 10.3],
  [2.25, 8.9],
  [12.75, 8.9],
  [5.3, 4.2],
  [9.7, 4.2],
];

export interface CourtView {
  /** pixel per metro */
  s: number;
  x0: number;
  y0: number;
  w: number;
  h: number;
  /** larghezza del bordo campo ai lati (metri) */
  apron: number;
  showApronLogos: boolean;
}

const APRON_LOGO_MIN = 2.6;

/**
 * Vista per un contenitore di W×H pixel: il campo occupa tutta l'altezza disponibile,
 * il parquet riempie i lati. Se ai lati non c'è spazio per il logo, si mostra anche il cerchio di centrocampo.
 */
export function computeView(W: number, H: number): CourtView {
  const coreW = CORE.x1 - CORE.x0;
  const make = (depth: number): CourtView => {
    const s = Math.max(1, Math.min(W / coreW, H / depth));
    const w = W / s;
    const h = H / s;
    const apron = (w - coreW) / 2;
    return { s, x0: COURT.width / 2 - w / 2, y0: CORE.y0, w, h, apron, showApronLogos: apron >= APRON_LOGO_MIN };
  };
  const short = make(CORE.y1 - CORE.y0);
  if (short.showApronLogos) return short;
  return make(CORE.y1WithCenter - CORE.y0);
}
