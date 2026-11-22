import { describe, expect, it } from 'vitest';
import fixture from './fixtures/srpe-2026-27.json';
import { LOAD_CONFIG, acwrZone, athleteSeries, entryTL, teamDaily, type LoadEntry } from './load';

const entries: LoadEntry<string>[] = fixture.rows.map((r) => ({ athlete: r.name, date: r.date, rpe: r.rpe, minutes: r.min }));

describe('sRPE: stesse formule del foglio Google (valori calcolati dal foglio come riferimento)', () => {
  const series = athleteSeries(entries, fixture.athlete, fixture.window);
  it('stesse date del foglio', () => {
    expect(series.map((d) => d.date)).toEqual(fixture.expected.map((d) => d.date));
  });
  it.each(fixture.expected.map((e, i) => [e.date, i] as const))('%s: TL, Media Personale, Media Squadra, Work Load', (_d, i) => {
    const e = fixture.expected[i];
    const s = series[i];
    expect(s.tl).toBe(e.tl);
    if (e.rolAvg == null) expect(s.rolAvg).toBeNull();
    else expect(s.rolAvg).toBeCloseTo(e.rolAvg, 9);
    expect(s.teamRol).toBeCloseTo(e.teamRol as number, 9);
    if (e.acwr == null) expect(s.acwr).toBeNull();
    else expect(s.acwr).toBeCloseTo(e.acwr, 9);
  });
});

describe('regole', () => {
  it('TL = RPE × minuti; vuoto se manca uno dei due', () => {
    expect(entryTL({ rpe: 6, minutes: 90 })).toBe(540);
    expect(entryTL({ rpe: null, minutes: 90 })).toBeNull();
  });
  it('due sedute nello stesso giorno si sommano', () => {
    const s = athleteSeries([{ athlete: 'a', date: '2026-09-01', rpe: 5, minutes: 60 }, { athlete: 'a', date: '2026-09-01', rpe: 4, minutes: 30 }], 'a');
    expect(s[0].tl).toBe(420);
  });
  it('zone del Work Load', () => {
    expect(acwrZone(1.4)).toBe('high');
    expect(acwrZone(1)).toBe('ok');
    expect(acwrZone(0.7)).toBe('low');
    expect(LOAD_CONFIG.windowDays).toBe(7);
  });
  it('Team TL giornaliero', () => {
    const t = teamDaily(entries);
    expect(t[0].date).toBe('2026-08-20');
    expect(t[0].avg).toBeCloseTo(400.909, 3);
  });
});
