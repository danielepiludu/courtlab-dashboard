import { hash53 } from '@/db/ids';

// ── impronte stabili (chiavi ordinate: il database online riordina i campi) ──
export function canonical(v: unknown): string {
  if (v === null || typeof v !== 'object') return JSON.stringify(v) ?? 'null';
  if (Array.isArray(v)) return `[${v.map((x) => (x === undefined ? 'null' : canonical(x))).join(',')}]`;
  const o = v as Record<string, unknown>;
  return `{${Object.keys(o)
    .filter((k) => o[k] !== undefined)
    .sort()
    .map((k) => `${JSON.stringify(k)}:${canonical(o[k])}`)
    .join(',')}}`;
}
export const fingerprint = (rec: unknown) => {
  const s = canonical(rec);
  return `${hash53(s).toString(36)}.${s.length.toString(36)}`;
};
