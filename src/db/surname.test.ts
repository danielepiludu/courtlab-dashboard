import { describe, expect, it } from 'vitest';
import { compareSurname, surnameOf } from './types';

describe('ordine per cognome', () => {
  it('cognome da "Nome Cognome"', () => {
    expect(surnameOf('Marco Bianchi')).toBe('Bianchi');
    expect(surnameOf('Gian Marco Rossi')).toBe('Rossi');
    expect(surnameOf('Maria De Luca')).toBe('De Luca');
    expect(surnameOf('Luca Dal Molin')).toBe('Dal Molin');
    expect(surnameOf('Esposito')).toBe('Esposito');
  });
  it('ordina per cognome, senza distinguere maiuscole e accenti', () => {
    const names = ['Luca Rossi', 'Marco Bianchi', 'Maria De Luca', 'Nicolò Mancini', 'Amato', 'andrea conti', 'Élia Costa'];
    expect([...names].map((name) => ({ name })).sort(compareSurname).map((p) => p.name)).toEqual([
      'Amato',
      'Marco Bianchi',
      'andrea conti',
      'Élia Costa',
      'Maria De Luca',
      'Nicolò Mancini',
      'Luca Rossi',
    ]);
  });
});
