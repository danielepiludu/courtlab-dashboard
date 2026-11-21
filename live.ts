import { CFG } from './config';
export interface PS { played: number; benchCur: number; consec: number; entries: number; f: number; peak: number }
export type Pt = 'u1' | 'u2' | 'u3' | 't1' | 't2' | 't3';
export interface Live { id: 1; gameId: number; opp: string; conv: number[]; on: number[]; period: number; clock: number;
  running: boolean; t0: number; us: number; them: number; log: Pt[]; p: Record<number, PS> }
export const plen = (i: number) => (i < 4 ? CFG.Q_MS : CFG.OT_MS);
export const plabel = (i: number) => (i < 4 ? `Q${i + 1}` : `OT${i - 3}`);
export function newLive(gameId: number, opp: string, conv: number[], on: number[]): Live {
  const p: Record<number, PS> = {};
  conv.forEach((id) => { p[id] = { played: 0, benchCur: 0, consec: 0, entries: on.includes(id) ? 1 : 0, f: 0, peak: 0 }; });
  return { id: 1, gameId, opp, conv, on, period: 0, clock: plen(0), running: false, t0: Date.now(), us: 0, them: 0, log: [], p };
}
// Tutto basato su timestamp: lo stato si "porta avanti" al tempo reale ad ogni lettura/azione.
export function advance(l: Live, now: number): Live {
  const dt = Math.max(0, now - l.t0);
  if (!dt) return l;
  const eff = l.running ? Math.min(dt, l.clock) : 0;
  const p: Record<number, PS> = {};
  for (const id of l.conv) {
    const s = l.p[id];
    p[id] = l.on.includes(id) ? { ...s, played: s.played + eff, consec: s.consec + eff } : { ...s, benchCur: s.benchCur + dt };
  }
  const clock = l.clock - eff;
  return { ...l, p, clock, running: l.running && clock > 0, t0: now };
}
export function toggle(l: Live, now: number): Live {
  const x = advance(l, now);
  if (x.running) return { ...x, running: false };
  if (x.clock <= 0) { const period = x.period + 1; return { ...x, period, clock: plen(period), running: true, t0: now }; }
  return { ...x, running: true, t0: now };
}
// out = giocatore in campo che esce, inn = giocatore in panchina che entra
export function swap(l: Live, out: number, inn: number, now: number): Live {
  const x = advance(l, now);
  return { ...x, on: x.on.map((id) => (id === out ? inn : id)),
    p: { ...x.p, [out]: { ...x.p[out], consec: 0, benchCur: 0 }, [inn]: { ...x.p[inn], entries: x.p[inn].entries + 1, benchCur: 0 } } };
}
export const addScore = (l: Live, s: 'u' | 't', n: 1 | 2 | 3): Live =>
  ({ ...l, us: l.us + (s === 'u' ? n : 0), them: l.them + (s === 't' ? n : 0), log: [...l.log, `${s}${n}` as Pt] });
export function undo(l: Live): Live {
  const k = l.log[l.log.length - 1];
  if (!k) return l;
  const n = +k[1];
  return { ...l, us: l.us - (k[0] === 'u' ? n : 0), them: l.them - (k[0] === 't' ? n : 0), log: l.log.slice(0, -1) };
}
