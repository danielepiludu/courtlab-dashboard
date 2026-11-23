/**
 * Antropometria e test fisici: catalogo delle misure (come nel foglio "Misurazioni") e calcoli derivati.
 * Funzioni pure.
 */

export type MeasureGroup = 'generali' | 'circonferenze' | 'salti' | 'valutazioni';

export interface MeasureDef {
  id: string;
  label: string;
  /** etichetta corta per tabelle e grafici */
  short: string;
  unit: string;
  group: MeasureGroup;
  kind: 'number' | 'text';
  decimals?: number;
  /** misure bilaterali: coppia dx/sx */
  pair?: string;
  side?: 'dx' | 'sx';
  /** parole chiave per riconoscere la riga nel foglio Excel */
  match: RegExp;
}

export const MEASURE_GROUP_LABEL: Record<MeasureGroup, string> = {
  generali: 'Generali',
  circonferenze: 'Circonferenze',
  salti: 'Test di salto',
  valutazioni: 'Valutazioni',
};

export const MEASURES: MeasureDef[] = [
  { id: 'height', label: 'Altezza con scarpa', short: 'Altezza', unit: 'cm', group: 'generali', kind: 'number', match: /altezza/ },
  { id: 'weight', label: 'Peso', short: 'Peso', unit: 'kg', group: 'generali', kind: 'number', decimals: 1, match: /peso/ },
  { id: 'wingspan', label: 'Apertura braccia (wing span)', short: 'Wing span', unit: 'cm', group: 'generali', kind: 'number', match: /wing ?span|apertura/ },
  { id: 'reach', label: 'Reach con scarpa', short: 'Reach', unit: 'cm', group: 'generali', kind: 'number', match: /reach/ },
  { id: 'thighKneeR', label: 'Coscia 3 cm dalla rotula dx', short: 'Rotula dx', unit: 'cm', group: 'circonferenze', kind: 'number', decimals: 1, pair: 'thighKnee', side: 'dx', match: /coscia.*rotula.*\bdx\b/ },
  { id: 'thighKneeL', label: 'Coscia 3 cm dalla rotula sx', short: 'Rotula sx', unit: 'cm', group: 'circonferenze', kind: 'number', decimals: 1, pair: 'thighKnee', side: 'sx', match: /coscia.*rotula.*\bsx\b/ },
  { id: 'thighGlutealR', label: 'Coscia sotto piega glutea dx', short: 'Gluteo dx', unit: 'cm', group: 'circonferenze', kind: 'number', decimals: 1, pair: 'thighGluteal', side: 'dx', match: /coscia.*glute.*\bdx\b/ },
  { id: 'thighGlutealL', label: 'Coscia sotto piega glutea sx', short: 'Gluteo sx', unit: 'cm', group: 'circonferenze', kind: 'number', decimals: 1, pair: 'thighGluteal', side: 'sx', match: /coscia.*glute.*\bsx\b/ },
  { id: 'calfR', label: 'Polpaccio dx', short: 'Polp. dx', unit: 'cm', group: 'circonferenze', kind: 'number', decimals: 1, pair: 'calf', side: 'dx', match: /polpaccio.*\bdx\b/ },
  { id: 'calfL', label: 'Polpaccio sx', short: 'Polp. sx', unit: 'cm', group: 'circonferenze', kind: 'number', decimals: 1, pair: 'calf', side: 'sx', match: /polpaccio.*\bsx\b/ },
  { id: 'chest', label: 'Torace', short: 'Torace', unit: 'cm', group: 'circonferenze', kind: 'number', decimals: 1, match: /torace/ },
  { id: 'sj', label: 'SJ – mani sui fianchi', short: 'SJ', unit: 'cm', group: 'salti', kind: 'number', decimals: 1, match: /\bsj\b|squat jump/ },
  { id: 'cmj', label: 'CMJ', short: 'CMJ', unit: 'cm', group: 'salti', kind: 'number', decimals: 1, match: /\bcmj\b|counter ?movement/ },
  { id: 'sqTest', label: 'SQ test', short: 'SQ test', unit: '', group: 'valutazioni', kind: 'text', match: /^sq test/ },
  { id: 'squatTest', label: 'Squat test', short: 'Squat test', unit: '', group: 'valutazioni', kind: 'text', match: /^squat test/ },
];

export const MEASURE_BY_ID = new Map(MEASURES.map((m) => [m.id, m]));
export const NUMERIC_MEASURES = MEASURES.filter((m) => m.kind === 'number');

/** Coppie destra/sinistra per l'asimmetria. */
export const PAIRS: { id: string; label: string; dx: string; sx: string }[] = [
  { id: 'thighKnee', label: 'Coscia vicino alla rotula', dx: 'thighKneeR', sx: 'thighKneeL' },
  { id: 'thighGluteal', label: 'Coscia sotto il gluteo', dx: 'thighGlutealR', sx: 'thighGlutealL' },
  { id: 'calf', label: 'Polpaccio', dx: 'calfR', sx: 'calfL' },
];

/** Giudizi suggeriti per i test qualitativi (come nel foglio). */
export const QUALITY_SCALE = ['Ottimo', 'Buono', 'Decente', 'Insufficiente', 'Male'];

const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);

/** Indice di massa corporea (con l'altezza misurata con le scarpe, come nel foglio). */
export function bmi(values: Record<string, number | string>): number | null {
  const w = num(values.weight);
  const h = num(values.height);
  return w != null && h != null && h > 0 ? w / (h / 100) ** 2 : null;
}

/** Asimmetria percentuale tra destra e sinistra: |dx − sx| / max(dx, sx) × 100. */
export function asymmetry(dx: number | null | undefined, sx: number | null | undefined): number | null {
  if (dx == null || sx == null || Math.max(dx, sx) <= 0) return null;
  return (Math.abs(dx - sx) / Math.max(dx, sx)) * 100;
}

/** Età in anni (decimali) a una certa data. */
export function ageAt(birthDate: string | undefined, date: string): number | null {
  if (!birthDate || !/^\d{4}-\d{2}-\d{2}/.test(birthDate)) return null;
  const a = Date.UTC(+birthDate.slice(0, 4), +birthDate.slice(5, 7) - 1, +birthDate.slice(8, 10));
  const b = Date.UTC(+date.slice(0, 4), +date.slice(5, 7) - 1, +date.slice(8, 10));
  return (b - a) / (365.25 * 86_400_000);
}

export interface MeasurePoint {
  date: string;
  sessionId: number;
  value: number | null;
}

/** Variazione rispetto al valore precedente disponibile e rispetto al primo (base). */
export function deltas(points: MeasurePoint[]): { last: number | null; prev: number | null; base: number | null; dPrev: number | null; dBase: number | null } {
  const vals = [...points].sort((a, b) => a.date.localeCompare(b.date)).filter((p) => p.value != null) as (MeasurePoint & { value: number })[];
  const last = vals[vals.length - 1]?.value ?? null;
  const prev = vals.length > 1 ? vals[vals.length - 2].value : null;
  const base = vals.length > 1 ? vals[0].value : null;
  return { last, prev, base, dPrev: last != null && prev != null ? last - prev : null, dBase: last != null && base != null ? last - base : null };
}

/** Formattazione italiana con i decimali della misura. */
export function fmtMeasure(v: number | string | null | undefined, def?: Pick<MeasureDef, 'decimals'>): string {
  if (v == null || v === '') return '–';
  if (typeof v === 'string') return v;
  const d = def?.decimals ?? (Number.isInteger(v) ? 0 : 1);
  return v.toFixed(d).replace('.', ',');
}

export function fmtDelta(v: number | null | undefined, def?: Pick<MeasureDef, 'decimals'>): string {
  if (v == null) return '–';
  if (Math.abs(v) < 1e-9) return '0';
  return `${v > 0 ? '+' : '−'}${fmtMeasure(Math.abs(v), { decimals: def?.decimals ?? (Number.isInteger(v) ? 0 : 1) })}`;
}
