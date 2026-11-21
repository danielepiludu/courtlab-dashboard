import { describe, expect, it } from 'vitest';
import type { Role } from '@/db/types';
import { addScore, adjustClock, createLive, intNow, normalizeLive, mmss, periodOver, restMs, settle, substitute, toggleClock, undoScore, type LiveState } from './liveModel';

const MIN = 60_000;
const roles: Record<number, Role> = { 1: 'PG', 2: 'SG', 3: 'SF', 4: 'PF', 5: 'C', 6: 'PG', 7: 'C', 8: 'SF' };
const T0 = 1_700_000_000_000;
const make = (): LiveState =>
  createLive({ teamId: 1, gameId: 1, opponent: 'Test', home: true, called: [1, 2, 3, 4, 5, 6, 7, 8], starters: [1, 2, 3, 4, 5], roles, now: T0 });

describe('ingresso in partita', () => {
  it('tutti i timer sono fermi finché non si preme Start', () => {
    const s = settle(make(), T0 + 5 * MIN);
    expect(s.remainingMs).toBe(10 * MIN);
    expect(s.players[1].playedMs).toBe(0);
    expect(restMs(s.players[6], T0 + 5 * MIN)).toBe(0);
  });
  it('quintetto disposto per ruolo: C e PF nel pitturato, PG in punta', () => {
    const s = make();
    expect(s.slots[0]).toBe(1); // PG punta
    expect(s.slots[4]).toBe(5); // C vicino al canestro
    expect(s.slots[3]).toBe(4); // PF
    expect(s.players[1].entries).toBe(1);
    expect(s.players[6].entries).toBe(0);
  });
});

describe('cronometro', () => {
  it('conta i minuti giocati solo a cronometro in corso; il REST conta tempo reale', () => {
    let s = toggleClock(make(), T0); // start
    s = toggleClock(s, T0 + 3 * MIN); // stop dopo 3'
    const later = settle(s, T0 + 5 * MIN); // 2' di timeout
    expect(later.players[1].playedMs).toBe(3 * MIN);
    expect(later.remainingMs).toBe(7 * MIN);
    expect(restMs(later.players[6], T0 + 5 * MIN)).toBe(5 * MIN);
  });
  it('a fine periodo si ferma a 00:00; Start passa al periodo successivo già avviato', () => {
    let s = toggleClock(make(), T0);
    s = settle(s, T0 + 12 * MIN);
    expect(s.running).toBe(false);
    expect(s.remainingMs).toBe(0);
    expect(s.players[1].playedMs).toBe(10 * MIN);
    expect(periodOver(s)).toBe(true);
    expect(s.events[s.events.length - 1]).toEqual({ t: T0 + 10 * MIN, type: 'period_end', period: 0 });
    s = toggleClock(s, T0 + 13 * MIN);
    expect(s.period).toBe(1);
    expect(s.running).toBe(true);
    expect(s.remainingMs).toBe(10 * MIN);
  });
  it('dopo Q4 arrivano i supplementari da 5 minuti', () => {
    let s = toggleClock(make(), T0);
    for (let p = 0; p < 4; p++) {
      s = settle(s, s.settledAt + 11 * MIN);
      s = toggleClock(s, s.settledAt + MIN);
    }
    expect(s.period).toBe(4);
    expect(s.remainingMs).toBe(5 * MIN);
  });
  it('ricostruzione dopo chiusura: lo stato salvato + l\'ora attuale danno i valori esatti', () => {
    const saved = JSON.parse(JSON.stringify(toggleClock(make(), T0))) as LiveState;
    const s = settle(saved, T0 + 4 * MIN + 30_000);
    expect(s.players[3].playedMs).toBe(4.5 * MIN);
    expect(mmss(s.remainingMs, 'ceil')).toBe('05:30');
  });
});

describe('cambi', () => {
  it('chi entra prende la posizione di chi esce; minuti consecutivi azzerati; ingressi contati', () => {
    let s = toggleClock(make(), T0);
    s = substitute(s, [5], [7], roles, T0 + 2 * MIN);
    expect(s.slots[4]).toBe(7);
    expect(s.players[5].onCourt).toBe(false);
    expect(s.players[5].playedMs).toBe(2 * MIN);
    expect(s.players[5].stintMs).toBe(0);
    expect(s.players[7].entries).toBe(1);
    expect(restMs(s.players[5], T0 + 3 * MIN)).toBe(MIN);
  });
  it('2-2: le coppie si formano per ruolo (lungo per lungo)', () => {
    const s = substitute(make(), [1, 5], [6, 7], roles, T0);
    expect(s.slots[0]).toBe(6); // PG per PG
    expect(s.slots[4]).toBe(7); // C per C
  });
  it('funziona anche a cronometro fermo; quantità diverse vengono ignorate', () => {
    const s = make();
    expect(substitute(s, [1, 2], [6], roles, T0)).toBe(s);
    expect(substitute(s, [1], [6], roles, T0).players[6].onCourt).toBe(true);
  });
});

describe('punteggio', () => {
  it('+1/+2/+3 e undo dell\'ultimo canestro', () => {
    let s = addScore(make(), 'us', 3, T0);
    s = addScore(s, 'them', 2, T0);
    expect([s.us, s.them]).toEqual([3, 2]);
    s = undoScore(s);
    expect([s.us, s.them]).toEqual([3, 0]);
  });
});

describe('correzione ±5 secondi', () => {
  const SEC = 1000;
  it('avanti di 5 s: cronometro -5 s, +5 s ai giocatori in campo e alla panchina', () => {
    let s = toggleClock(make(), T0);
    s = toggleClock(s, T0 + MIN); // stop a 09:00
    const before = settle(s, T0 + 2 * MIN);
    const a = adjustClock(s, 5 * SEC, T0 + 2 * MIN);
    expect(a.remainingMs).toBe(9 * MIN - 5 * SEC);
    expect(a.players[1].playedMs).toBe(MIN + 5 * SEC);
    expect(a.players[1].stintMs).toBe(MIN + 5 * SEC);
    expect(restMs(a.players[6], T0 + 2 * MIN)).toBe(restMs(before.players[6], T0 + 2 * MIN) + 5 * SEC);
  });
  it('indietro di 5 s: tutto torna indietro di 5 s, anche a cronometro in corso', () => {
    let s = toggleClock(make(), T0);
    s = adjustClock(s, -5 * SEC, T0 + 30 * SEC);
    expect(s.running).toBe(true);
    const v = settle(s, T0 + 40 * SEC);
    expect(v.remainingMs).toBe(10 * MIN - 35 * SEC);
    expect(v.players[2].playedMs).toBe(35 * SEC);
    expect(restMs(v.players[7], T0 + 40 * SEC)).toBe(35 * SEC);
  });
  it('limiti: non supera la durata del periodo né scende sotto 00:00; niente tempi negativi', () => {
    let s = toggleClock(make(), T0);
    s = adjustClock(s, -5 * SEC, T0 + 2 * SEC); // solo 2 s recuperabili
    expect(settle(s, T0 + 2 * SEC).remainingMs).toBe(10 * MIN);
    expect(s.players[1].playedMs).toBe(0);
    expect(restMs(s.players[6], T0 + 2 * SEC)).toBe(0);
    s = settle(toggleClock(make(), T0), T0 + 10 * MIN - 3 * SEC);
    s = adjustClock(s, 5 * SEC, T0 + 10 * MIN - 3 * SEC);
    expect(s.remainingMs).toBe(0);
    expect(s.running).toBe(false);
    expect(s.players[1].playedMs).toBe(10 * MIN);
  });
  it('a periodo finito, indietro di 5 s riapre il periodo (Start riparte dallo stesso)', () => {
    let s = settle(toggleClock(make(), T0), T0 + 11 * MIN);
    s = adjustClock(s, -5 * SEC, T0 + 11 * MIN);
    expect(s.remainingMs).toBe(5 * SEC);
    expect(periodOver(s)).toBe(false);
    s = toggleClock(s, T0 + 12 * MIN);
    expect(s.period).toBe(0);
    expect(s.running).toBe(true);
  });
  it('non disponibile prima del primo Start', () => {
    const s = make();
    expect(adjustClock(s, 5 * SEC, T0)).toBe(s);
  });
});

describe('INT durante la partita (scala 0–1)', () => {
  const SEC = 1000;
  it('prima del primo Start l\'INT è fermo a 0', () => {
    const s = settle(make(), T0 + 20 * MIN);
    expect(intNow(s, 1, T0 + 20 * MIN)).toBe(0);
  });
  it('in campo a cronometro in corso sale (≈0,37 dopo 5′); la panchina resta a 0', () => {
    const now = T0 + 5 * MIN;
    const s = settle(toggleClock(make(), T0), now);
    expect(intNow(s, 1, now)).toBeCloseTo(0.37, 2);
    expect(intNow(s, 6, now)).toBe(0);
    expect(s.players[1].peak).toBeCloseTo(0.37, 2);
  });
  it('in campo a cronometro fermo: nei primi 20 s nessun recupero, poi scende piano (meno che in panchina)', () => {
    let s = toggleClock(make(), T0);
    s = toggleClock(s, T0 + 5 * MIN);
    const atStop = intNow(settle(s, T0 + 5 * MIN), 1, T0 + 5 * MIN);
    expect(intNow(settle(s, T0 + 5 * MIN + 20 * SEC), 1, T0 + 5 * MIN + 20 * SEC)).toBeCloseTo(atStop, 12);
    const after = intNow(settle(s, T0 + 8 * MIN), 1, T0 + 8 * MIN);
    expect(after).toBeLessThan(atStop);
    let b = substitute(s, [1], [6], roles, T0 + 5 * MIN);
    b = settle(b, T0 + 8 * MIN);
    expect(intNow(b, 1, T0 + 8 * MIN)).toBeLessThan(after); // la panchina fa recuperare di più
  });
  it('in panchina recupera in tempo reale, anche a cronometro fermo', () => {
    let s = toggleClock(make(), T0);
    s = toggleClock(s, T0 + 10 * MIN); // stop dopo 10′
    s = substitute(s, [5], [7], roles, T0 + 10 * MIN);
    const exit = intNow(s, 5, T0 + 10 * MIN);
    const v = settle(s, T0 + 16 * MIN);
    const rec = intNow(v, 5, T0 + 16 * MIN);
    expect(exit).toBeCloseTo(0.67, 2);
    expect(rec).toBeLessThan(exit * 0.6);
    expect(rec).toBeGreaterThan(0.05); // resta il residuo dei 10′ giocati
  });
  it('chi rientra parte dal carico recuperato; i minuti consecutivi ripartono, i totali no', () => {
    let s = toggleClock(make(), T0);
    s = substitute(s, [5], [7], roles, T0 + 8 * MIN);
    const exitAcute = s.players[5].acute;
    s = substitute(s, [7], [5], roles, T0 + 12 * MIN);
    expect(s.players[5].acute).toBeLessThan(exitAcute);
    expect(s.players[5].stintMs).toBe(0);
    expect(s.players[5].playedMs).toBe(8 * MIN);
    expect(s.players[5].entries).toBe(2);
  });
  it('INT sempre tra 0 e 1, anche dopo un\'intera partita in campo', () => {
    let s = toggleClock(make(), T0);
    for (let p = 0; p < 6; p++) s = toggleClock(settle(s, s.settledAt + 11 * MIN), s.settledAt + 11 * MIN);
    const t = s.settledAt + 3 * MIN;
    const v = settle(s, t);
    for (const id of v.called) {
      const x = intNow(v, id, t);
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThanOrEqual(1);
    }
    expect(v.players[1].peak).toBeGreaterThan(0.95);
    expect(v.players[1].peak).toBeLessThanOrEqual(1);
  });
  it('ricostruzione dopo una chiusura: stato salvato (JSON) + ora attuale danno lo stesso INT', () => {
    let s = toggleClock(make(), T0);
    s = substitute(s, [2], [6], roles, T0 + 3 * MIN);
    const saved = JSON.parse(JSON.stringify(s)) as LiveState;
    const t = T0 + 7 * MIN + 12 * SEC;
    const a = settle(s, t);
    const b = settle(saved, t);
    for (const id of s.called) expect(intNow(b, id, t)).toBeCloseTo(intNow(a, id, t), 12);
  });
  it('assestare spesso o una volta sola dà lo stesso risultato', () => {
    let s = toggleClock(make(), T0);
    let many = s;
    for (let k = 1; k <= 40; k++) many = settle(many, T0 + k * 15 * SEC);
    s = settle(s, T0 + 10 * MIN);
    expect(many.players[1].acute).toBeCloseTo(s.players[1].acute, 10);
    expect(many.samples.length).toBe(s.samples.length);
  });
  it('campioni ogni 30 s per il grafico (il primo a 0 al fischio d\'inizio)', () => {
    const s = settle(toggleClock(make(), T0), T0 + 5 * MIN);
    expect(s.samples.length).toBe(11);
    expect(s.samples[0].v[1]).toBe(0);
    expect(s.samples[10].v[1]).toBeCloseTo(0.37, 2);
    expect(s.samples[10].on).toContain(1);
  });
  it('±5 secondi: avanti fa salire l\'INT di chi è in campo, indietro lo riporta indietro esattamente', () => {
    let s = toggleClock(make(), T0);
    s = toggleClock(s, T0 + 4 * MIN);
    const base = intNow(s, 1, T0 + 4 * MIN);
    const fwd = adjustClock(s, 5 * SEC, T0 + 4 * MIN);
    expect(intNow(fwd, 1, T0 + 4 * MIN)).toBeGreaterThan(base);
    const back = adjustClock(fwd, -5 * SEC, T0 + 4 * MIN);
    expect(intNow(back, 1, T0 + 4 * MIN)).toBeCloseTo(base, 9);
  });
  it('stati salvati dalle versioni precedenti vengono completati (anche INT 0–100)', () => {
    const old = make() as unknown as { samples?: unknown; startedAt?: unknown; nextSampleAt?: unknown; players: Record<number, Record<string, unknown>> };
    delete old.samples;
    delete old.startedAt;
    delete old.nextSampleAt;
    for (const p of Object.values(old.players)) {
      delete p.acute;
      p.int = 50;
      p.peak = 80;
    }
    const n = normalizeLive(old as unknown as LiveState);
    expect(n.samples).toEqual([]);
    expect(n.players[1].acute).toBe(0.5);
    expect(n.players[1].peak).toBe(0.8);
  });
});

describe('scenari di partita: tempo consecutivo, interruzioni, intervalli', () => {
  const SEC = 1000;
  const play = (mins: number) => settle(toggleClock(make(), T0), T0 + mins * MIN);
  it('10′ di gioco continuo affaticano più di 10′ spezzati da 3′ di panchina', () => {
    const cont = intNow(play(10), 1, T0 + 10 * MIN);
    let s = toggleClock(make(), T0);
    s = toggleClock(s, T0 + 5 * MIN); // stop
    s = substitute(s, [1], [6], roles, T0 + 5 * MIN);
    s = settle(s, T0 + 8 * MIN); // 3′ reali di pausa a cronometro fermo
    s = substitute(s, [6], [1], roles, T0 + 8 * MIN);
    s = toggleClock(s, T0 + 8 * MIN);
    const split = intNow(settle(s, T0 + 13 * MIN), 1, T0 + 13 * MIN);
    expect(cont).toBeGreaterThan(split + 0.1);
  });
  it('fermate brevi (30 s di gioco e 30 s di stop): recupero minimo, il carico resta vicino al continuo', () => {
    let s = toggleClock(make(), T0);
    let t = T0;
    for (let k = 0; k < 20; k++) {
      t += 30 * SEC;
      s = toggleClock(s, t);
      t += 30 * SEC;
      s = toggleClock(s, t);
    }
    const interrupted = intNow(settle(s, t), 1, t);
    const cont = intNow(play(10), 1, T0 + 10 * MIN);
    expect(interrupted).toBeLessThan(cont);
    expect(cont - interrupted).toBeLessThan(0.05);
  });
  it('un timeout di 1′ a metà stint fa calare poco', () => {
    let s = toggleClock(make(), T0);
    s = toggleClock(s, T0 + 5 * MIN);
    const before = intNow(settle(s, T0 + 5 * MIN), 1, T0 + 5 * MIN);
    const after = intNow(settle(s, T0 + 6 * MIN), 1, T0 + 6 * MIN);
    expect(before - after).toBeGreaterThan(0.01);
    expect(before - after).toBeLessThan(0.04);
  });
  it('intervallo tra i quarti (2′): chi era in campo recupera come in panchina', () => {
    const end = play(10); // fine Q1
    const atEnd = intNow(end, 1, T0 + 10 * MIN);
    const brk = intNow(settle(end, T0 + 12 * MIN), 1, T0 + 12 * MIN);
    expect(atEnd).toBeCloseTo(0.67, 2);
    expect(brk).toBeLessThan(0.52);
    expect(brk).toBeGreaterThan(0.45);
  });
  it('intervallo di metà gara (15′): resta quasi solo il residuo dei minuti giocati', () => {
    const v = intNow(settle(play(10), T0 + 25 * MIN), 1, T0 + 25 * MIN);
    expect(v).toBeLessThan(0.12);
    expect(v).toBeGreaterThanOrEqual(0.05); // residuo di 10′
  });
  it('dopo un intervallo lo stint riparte: il rientro non è più veloce di uno stint nuovo', () => {
    let s = settle(play(10), T0 + 25 * MIN);
    s = toggleClock(s, T0 + 25 * MIN); // Q2
    expect(s.players[1].stintMs).toBe(0);
    const afterBreak = settle(s, T0 + 30 * MIN);
    const gain = intNow(afterBreak, 1, T0 + 30 * MIN) - intNow(s, 1, T0 + 25 * MIN);
    expect(gain).toBeLessThan(0.4); // simile a 5′ da riposato (≈0,35), non un'impennata
    expect(gain).toBeGreaterThan(0.25);
  });
  it('l\'INT si ricostruisce identico anche durante interruzioni e intervalli', () => {
    let s = toggleClock(make(), T0);
    s = toggleClock(s, T0 + 3 * MIN); // stop
    const saved = JSON.parse(JSON.stringify(settle(s, T0 + 3 * MIN + 10 * SEC))) as LiveState;
    const t = T0 + 4 * MIN;
    expect(intNow(settle(saved, t), 1, t)).toBeCloseTo(intNow(settle(s, t), 1, t), 12);
  });
});
