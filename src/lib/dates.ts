export const pad2 = (n: number) => String(n).padStart(2, '0');

export const MONTHS = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'];
export const MONTHS_SHORT = ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic'];
export const WEEKDAYS_SHORT = ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'];

/** Data locale in formato YYYY-MM-DD (nessuna conversione UTC). */
export const toISODate = (d: Date) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
export const todayISO = () => toISODate(new Date());
export const nowHHMM = () => {
  const d = new Date();
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
};

export function parseISODate(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

/** Lunedì = 0 … Domenica = 6 */
export const weekdayMon0 = (d: Date) => (d.getDay() + 6) % 7;

export const fmtDayMonth = (iso: string) => {
  const d = parseISODate(iso);
  return `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}`;
};

export const capFirst = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** "Sabato 21 novembre 2026" */
export const fmtLong = (iso: string, withYear = true) =>
  capFirst(parseISODate(iso).toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long', ...(withYear ? { year: 'numeric' } : {}) }));

/** "Sab 21 nov" */
export const fmtMedium = (iso: string) =>
  capFirst(parseISODate(iso).toLocaleDateString('it-IT', { weekday: 'short', day: 'numeric', month: 'short' }));

/** Giorni di calendario tra oggi e la data (negativo = passato). */
export function daysFromToday(iso: string): number {
  const a = parseISODate(todayISO()).getTime();
  const b = parseISODate(iso).getTime();
  return Math.round((b - a) / 86_400_000);
}

export function relativeDay(iso: string): string {
  const n = daysFromToday(iso);
  if (n === 0) return 'Oggi';
  if (n === 1) return 'Domani';
  if (n === -1) return 'Ieri';
  if (n > 1) return `Tra ${n} giorni`;
  return `${-n} giorni fa`;
}

/** Una partita si può iniziare solo dal suo giorno in poi (non in anticipo). */
export const canStartOn = (iso: string) => iso <= todayISO();
