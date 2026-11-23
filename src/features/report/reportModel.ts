/**
 * Riepilogo di una partita conclusa, calcolato dal resoconto salvato (funzioni pure).
 */
import type { GameReport, ReportPlayer } from '@/db/types';
import { GAME } from '@/config';
import { intNow, normalizeLive, periodLabel } from '@/features/live/liveModel';

export interface SeriesPoint {
  /** ms dall'inizio della partita (prima pressione di Start) */
  t: number;
  /** INT 0–1 */
  v: number;
  on: boolean;
}

export interface PlayerSummary extends ReportPlayer {
  playedMs: number;
  entries: number;
  starter: boolean;
  /** INT medio sull'intera partita (campo + panchina, campioni ogni 30 s); NaN se non ci sono campioni */
  intAvg: number;
  /** INT medio nei soli momenti in campo */
  intAvgOnCourt: number;
  intPeak: number;
  intEnd: number;
  series: SeriesPoint[];
}

export type Outcome = 'W' | 'L' | 'D';

export interface ReportSummary {
  us: number;
  them: number;
  outcome: Outcome;
  started: boolean;
  periods: number;
  overtimes: number;
  /** durata reale dalla prima pressione di Start alla fine */
  durationMs: number;
  periodMarks: { t: number; label: string }[];
  /** quarti e supplementari: inizio e fine (ms dall'inizio); tra la fine di uno e l'inizio del successivo c'è la pausa */
  periodSpans: { label: string; from: number; to: number }[];
  players: PlayerSummary[];
  leaders: { minutes?: PlayerSummary; peak?: PlayerSummary; entries?: PlayerSummary };
}

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

export function summarize(r: GameReport): ReportSummary {
  const s = normalizeLive(r.live); // resoconti salvati da versioni precedenti
  const start = s.startedAt ?? r.finishedAt;
  const end = Math.max(start, r.finishedAt);
  const starters = new Set<number>();
  for (const id of s.called) {
    // titolari: hanno più ingressi di quelli avvenuti con un cambio (il primo è il quintetto iniziale)
    const subIns = s.events.filter((e) => e.type === 'sub' && e.in.includes(id)).length;
    if ((s.players[id]?.entries ?? 0) > subIns) starters.add(id);
  }

  const players: PlayerSummary[] = r.players.map((rp) => {
    const p = s.players[rp.id];
    const series: SeriesPoint[] = s.samples.map((x) => ({ t: x.t - start, v: x.v[rp.id] ?? 0, on: x.on.includes(rp.id) }));
    const intEnd = s.started ? intNow(s, rp.id, end) : 0;
    if (s.started && (!series.length || series[series.length - 1].t < end - start)) series.push({ t: end - start, v: intEnd, on: !!p?.onCourt });
    const values = series.map((x) => x.v);
    const onValues = series.filter((x) => x.on).map((x) => x.v);
    return {
      ...rp,
      playedMs: p?.playedMs ?? 0,
      entries: p?.entries ?? 0,
      starter: starters.has(rp.id),
      // resoconti delle prime versioni: senza campioni nel tempo la media non è calcolabile
      intAvg: s.started && !s.samples.length ? Number.NaN : mean(values),
      intAvgOnCourt: s.started && !s.samples.length ? Number.NaN : mean(onValues),
      intPeak: Math.max(p?.peak ?? 0, ...values, 0),
      intEnd,
      series,
    };
  });
  players.sort((a, b) => b.playedMs - a.playedMs || Number(a.number || 999) - Number(b.number || 999));

  const best = (key: 'playedMs' | 'intPeak' | 'entries') => players.filter((p) => p[key] > 0).sort((a, b) => b[key] - a[key])[0];
  const periodMarks = s.events.filter((e) => e.type === 'period_start').map((e) => ({ t: e.t - start, label: periodLabel((e as { period: number }).period) }));
  const starts = s.events.filter((e): e is Extract<typeof e, { type: 'period_start' }> => e.type === 'period_start');
  const periodSpans = starts.map((e, i) => {
    const endEv = s.events.find((x) => x.type === 'period_end' && (x as { period: number }).period === e.period && x.t >= e.t);
    const next = starts[i + 1]?.t ?? end;
    return { label: periodLabel(e.period), from: e.t - start, to: Math.min(endEv?.t ?? next, next) - start };
  });

  return {
    us: s.us,
    them: s.them,
    outcome: s.us > s.them ? 'W' : s.us < s.them ? 'L' : 'D',
    started: s.started,
    periods: s.period + 1,
    overtimes: Math.max(0, s.period + 1 - GAME.quarters),
    durationMs: end - start,
    periodMarks,
    periodSpans,
    players,
    leaders: { minutes: best('playedMs'), peak: best('intPeak'), entries: best('entries') },
  };
}
