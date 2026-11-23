import { describe, expect, it } from 'vitest';
import { compareSurname, shortSurname, surnameFirst, surnameOf } from './types';

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

describe('nomi mostrati per cognome', () => {
  it('Cognome Nome', () => {
    expect(surnameFirst('Marco Bianchi')).toBe('Bianchi Marco');
    expect(surnameFirst('Maria De Luca')).toBe('De Luca Maria');
    expect(surnameFirst('Gian Marco  Rossi')).toBe('Rossi Gian Marco');
    expect(surnameFirst('Esposito')).toBe('Esposito');
  });
  it('nome breve: cognome, con iniziale se il cognome è ripetuto', () => {
    const all = [
      { id: 1, name: 'Marco Rossi' },
      { id: 2, name: 'Luca Rossi' },
      { id: 3, name: 'Andrea Conti' },
    ];
    expect(shortSurname(all[2], all)).toBe('Conti');
    expect(shortSurname(all[0], all)).toBe('Rossi M.');
    expect(shortSurname(all[1], all)).toBe('Rossi L.');
    expect(shortSurname({ id: 9, name: 'Esposito' }, all)).toBe('Esposito');
  });
});
