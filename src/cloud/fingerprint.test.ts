import { describe, expect, it } from 'vitest';
import { canonical, fingerprint } from './fingerprint';
import { newId, rpeId } from '@/db/ids';

describe('impronte per la sincronizzazione', () => {
  it("non dipendono dall'ordine dei campi (il database online li riordina)", () => {
    expect(fingerprint({ a: 1, b: { y: [1, 2], x: 'k' } })).toBe(fingerprint({ b: { x: 'k', y: [1, 2] }, a: 1 }));
  });
  it('ignorano i campi undefined, come JSON', () => {
    expect(fingerprint({ a: 1, photo: undefined })).toBe(fingerprint({ a: 1 }));
    expect(canonical({ a: 1, photo: undefined })).toBe('{"a":1}');
  });
  it('cambiano quando cambia un valore', () => {
    expect(fingerprint({ rpe: 7 })).not.toBe(fingerprint({ rpe: 6 }));
    expect(fingerprint({ name: 'Mario' })).not.toBe(fingerprint({ name: 'Mario ' }));
  });
});

describe('id validi su più dispositivi', () => {
  it('nuovi id: interi sicuri, sopra quelli progressivi, tutti diversi', () => {
    const ids = Array.from({ length: 5000 }, newId);
    for (const id of ids) {
      expect(Number.isSafeInteger(id)).toBe(true);
      expect(id).toBeGreaterThanOrEqual(2 ** 32);
    }
    expect(new Set(ids).size).toBe(ids.length);
  });
  it('RPE: stesso id per la stessa seduta e lo stesso atleta su qualsiasi dispositivo', () => {
    expect(rpeId(123, 456)).toBe(rpeId(123, 456));
    expect(rpeId(123, 456)).not.toBe(rpeId(456, 123));
    expect(Number.isSafeInteger(rpeId(2 ** 50, 2 ** 51))).toBe(true);
  });
});
