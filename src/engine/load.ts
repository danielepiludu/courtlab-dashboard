/**
 * Carico interno da sRPE (session-RPE, Foster): funzioni PURE che replicano il foglio "sRPE 2026/27".
 *
 *  TL (per inserimento)   = RPE × minuti
 *  TL giornaliero atleta  = somma dei TL dell'atleta in quel giorno
 *  Media Personale        = media dei TL giornalieri > 0 dell'atleta negli ultimi N giorni di calendario (oggi incluso)
 *  Media Squadra          = media di tutti i TL (singoli inserimenti) della squadra negli stessi N giorni
 *  Work Load (A:C)        = TL del giorno ÷ Media Personale; senza TL quel giorno ripete il valore precedente
 *  Limiti                 = 1,3 (superiore) e 0,8 (inferiore)
 */

export const LOAD_CONFIG = {
  /** finestra della media mobile in giorni di calendario (cella J2 del foglio) */
  windowDays: 7,
  upperLimit: 1.3,
  lowerLimit: 0.8,
};

export interface LoadEntry<A = string | number> {
  athlete: A;
  /** YYYY-MM-DD */
  date: string;
  rpe: number | null;
  minutes: number | null;
}

export interface AthleteDay {
  date: string;
  /** TL del giorno (null se nessun RPE) */
  tl: number | null;
  rolAvg: number | null;
  teamRol: number | null;
  acwr: number | null;
}

export const entryTL = (e: Pick<LoadEntry, 'rpe' | 'minutes'>): number | null => (e.rpe == null || e.minutes == null ? null : e.rpe * e.minutes);

const DAY = 86_400_000;
const toDay = (iso: string) => Math.round(Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10)) / DAY);
const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

/** Serie giornaliera di un atleta: le date sono quelle in cui l'atleta compare (anche senza RPE). */
export function athleteSeries<A>(entries: LoadEntry<A>[], athlete: A, windowDays = LOAD_CONFIG.windowDays): AthleteDay[] {
  const byDate = new Map<string, number | null>();
  for (const e of entries) {
    if (e.athlete !== athlete) continue;
    const t = entryTL(e);
    const prev = byDate.get(e.date) ?? null;
    byDate.set(e.date, t == null ? prev : (prev ?? 0) + t);
  }
  const days = [...byDate.entries()].map(([date, tl]) => ({ date, day: toDay(date), tl })).sort((a, b) => a.day - b.day);
  const team = entries.map((e) => ({ day: toDay(e.date), tl: entryTL(e) })).filter((x): x is { day: number; tl: number } => x.tl != null);

  let prevAcwr: number | null = null;
  return days.map(({ date, day, tl }) => {
    const from = day - windowDays + 1;
    const rolAvg = mean(days.filter((x) => x.day >= from && x.day <= day && (x.tl ?? 0) > 0).map((x) => x.tl as number));
    const teamRol = mean(team.filter((x) => x.day >= from && x.day <= day).map((x) => x.tl));
    const cur = tl != null && tl > 0 && rolAvg ? tl / rolAvg : null;
    const acwr = cur ?? prevAcwr;
    prevAcwr = acwr;
    return { date, tl, rolAvg, teamRol, acwr };
  });
}

/** Team TL di ogni giorno: totale e media per atleta che ha risposto. */
export function teamDaily<A>(entries: LoadEntry<A>[]): { date: string; total: number; avg: number; count: number }[] {
  const m = new Map<string, number[]>();
  for (const e of entries) {
    const t = entryTL(e);
    if (t == null) continue;
    m.set(e.date, [...(m.get(e.date) ?? []), t]);
  }
  return [...m.entries()]
    .map(([date, xs]) => ({ date, total: xs.reduce((a, b) => a + b, 0), avg: xs.reduce((a, b) => a + b, 0) / xs.length, count: xs.length }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

/** Zona del Work Load rispetto ai limiti. */
export function acwrZone(v: number | null): 'low' | 'ok' | 'high' | null {
  if (v == null) return null;
  return v > LOAD_CONFIG.upperLimit ? 'high' : v < LOAD_CONFIG.lowerLimit ? 'low' : 'ok';
}

/** Scala RPE CR-10 (Borg/Foster) con le descrizioni del foglio. */
export const RPE_SCALE: { value: number; label: string; note?: string }[] = [
  { value: 0, label: 'Nessuna sensazione' },
  { value: 0.5, label: 'Molto, molto debole', note: 'appena percettibile' },
  { value: 1, label: 'Molto debole' },
  { value: 2, label: 'Debole', note: 'leggero' },
  { value: 3, label: 'Moderato' },
  { value: 4, label: "Un po' forte" },
  { value: 5, label: 'Forte', note: 'pesante' },
  { value: 6, label: 'Discretamente pesante' },
  { value: 7, label: 'Molto forte' },
  { value: 8, label: 'Pesante' },
  { value: 9, label: 'Molto, molto forte' },
  { value: 10, label: 'Massimale', note: 'sforzo quasi massimale' },
];
