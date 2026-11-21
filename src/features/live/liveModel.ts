/**
 * Modello della partita in corso: funzioni PURE basate su timestamp (Date.now), mai su tick.
 *
 * Lo stato viene "assestato" (settle) solo nelle transizioni (start, stop, cambio, fine periodo):
 * tra una transizione e l'altra ogni valore mostrato è calcolato da `settle(stato, adesso)`.
 * Così il ripristino dopo una chiusura accidentale è esatto: basta lo stato salvato.
 */
import { GAME } from '@/config';
import type { Role } from '@/db/types';
import { INT_CONFIG } from '@/engine/intConfig';
import { clampInt, decayBench, decayCourtStopped, ratePerMin, rise } from '@/engine/int';

export interface PlayerLive {
  id: number;
  onCourt: boolean;
  /** minuti di gioco totali (ms di cronometro), assestati a `settledAt` */
  playedMs: number;
  /** ms di gioco consecutivi dall'ultimo ingresso */
  stintMs: number;
  /** numero di ingressi in campo (il quintetto iniziale conta 1) */
  entries: number;
  /** istante reale di inizio della panchina attuale (null se in campo o partita non ancora iniziata) */
  restSince: number | null;
  /**
   * INT: per chi è in campo è il valore assestato a `settledAt`;
   * per chi è in panchina è il valore all'uscita (poi decade in tempo reale da `restSince`).
   */
  int: number;
  /** INT massimo raggiunto */
  peak: number;
}

/** Campione dell'INT di tutti i convocati (per il grafico del resoconto). */
export interface IntSample {
  t: number;
  v: Record<number, number>;
  /** in campo in quell'istante */
  on: number[];
}

export interface ScoreEvent {
  side: 'us' | 'them';
  pts: 1 | 2 | 3;
  t: number;
  period: number;
}

export type LiveEvent =
  | { t: number; type: 'start' }
  | { t: number; type: 'stop' }
  | { t: number; type: 'period_start'; period: number }
  | { t: number; type: 'period_end'; period: number }
  | { t: number; type: 'sub'; out: number[]; in: number[] }
  | { t: number; type: 'adjust'; deltaMs: number };

export interface LiveState {
  v: 1;
  teamId: number;
  gameId: number;
  opponent: string;
  home: boolean;
  createdAt: number;
  /** convocati */
  called: number[];
  /** giocatori in campo per posizione: 0 punta, 1-2 ali, 3-4 lunghi nel pitturato */
  slots: number[];
  /** 0-3 = Q1-Q4, 4+ = OT1, OT2… */
  period: number;
  /** prima pressione di Start avvenuta: prima di allora tutti i timer sono fermi */
  started: boolean;
  running: boolean;
  /** tempo residuo del periodo, assestato a `settledAt` */
  remainingMs: number;
  settledAt: number;
  players: Record<number, PlayerLive>;
  us: number;
  them: number;
  scoreLog: ScoreEvent[];
  events: LiveEvent[];
  /** istante della prima pressione di Start */
  startedAt: number | null;
  /** prossimo campione INT da registrare */
  nextSampleAt: number | null;
  samples: IntSample[];
}

/** Completa uno stato salvato da una versione precedente (campi INT mancanti). */
export function normalizeLive(s: LiveState): LiveState {
  const players: Record<number, PlayerLive> = {};
  for (const [k, p] of Object.entries(s.players)) players[+k] = { ...p, int: p.int ?? 0, peak: p.peak ?? 0 };
  const startedAt = s.startedAt ?? (s.started ? (s.events.find((e) => e.type === 'start')?.t ?? s.settledAt) : null);
  return { ...s, players, startedAt, nextSampleAt: s.nextSampleAt ?? (startedAt != null ? s.settledAt : null), samples: s.samples ?? [] };
}

export const periodLength = (p: number) => (p < GAME.quarters ? GAME.quarterMs : GAME.overtimeMs);
export const periodLabel = (p: number) => (p < GAME.quarters ? `Q${p + 1}` : `OT${p - GAME.quarters + 1}`);

const ROLE_ORDER: Record<Role, number> = { C: 0, PF: 1, SF: 2, SG: 3, PG: 4 };
const roleRank = (roles: Record<number, Role>, id: number) => ROLE_ORDER[roles[id] ?? 'SF'];

/** Posizioni iniziali: i 2 più "lunghi" nel pitturato, poi ali e punta (PG in punta). */
export function assignSlots(starters: number[], roles: Record<number, Role>): number[] {
  const s = [...starters].sort((a, b) => roleRank(roles, a) - roleRank(roles, b) || a - b);
  // s[0] più lungo → slot 4 (vicino al canestro), s[1] → slot 3, s[2] → ala bassa, s[3] → ala alta, s[4] → punta
  const slots = new Array<number>(5);
  slots[4] = s[0];
  slots[3] = s[1];
  slots[2] = s[2];
  slots[1] = s[3];
  slots[0] = s[4];
  return slots;
}

export function createLive(p: {
  teamId: number;
  gameId: number;
  opponent: string;
  home: boolean;
  called: number[];
  starters: number[];
  roles: Record<number, Role>;
  now: number;
}): LiveState {
  const players: Record<number, PlayerLive> = {};
  for (const id of p.called) {
    const on = p.starters.includes(id);
    players[id] = { id, onCourt: on, playedMs: 0, stintMs: 0, entries: on ? 1 : 0, restSince: null, int: 0, peak: 0 };
  }
  return {
    v: 1,
    teamId: p.teamId,
    gameId: p.gameId,
    opponent: p.opponent,
    home: p.home,
    createdAt: p.now,
    called: [...p.called],
    slots: assignSlots(p.starters, p.roles),
    period: 0,
    started: false,
    running: false,
    remainingMs: periodLength(0),
    settledAt: p.now,
    players,
    us: 0,
    them: 0,
    scoreLog: [],
    events: [],
    startedAt: null,
    nextSampleAt: null,
    samples: [],
  };
}

/**
 * INT di un giocatore all'istante `t` (t ≥ s.settledAt), partendo dallo stato assestato `s`.
 * a) in campo e cronometro in corso: sale;  b) in campo e cronometro fermo: scende piano;
 * c) in panchina: scende dal valore di uscita, in tempo reale (anche a cronometro fermo).
 */
export function playerIntAt(p: PlayerLive, s: LiveState, t: number): number {
  if (!s.started) return clampInt(p.int);
  if (!p.onCourt) return p.restSince != null ? decayBench(p.int, t - p.restSince) : clampInt(p.int);
  const dt = Math.max(0, t - s.settledAt);
  if (!s.running) return decayCourtStopped(p.int, dt);
  const game = Math.min(dt, s.remainingMs);
  const up = rise(p.int, p.stintMs, p.playedMs, game);
  return dt > game ? decayCourtStopped(up, dt - game) : up;
}

/** INT attuale (da usare su uno stato già assestato a `now`). */
export const intNow = (s: LiveState, id: number, now: number) => (s.players[id] ? playerIntAt(s.players[id], s, now) : 0);

function sampleAt(s: LiveState, t: number): IntSample {
  const v: Record<number, number> = {};
  const on: number[] = [];
  for (const [k, p] of Object.entries(s.players)) {
    v[+k] = Math.round(playerIntAt(p, s, t) * 10) / 10;
    if (p.onCourt) on.push(+k);
  }
  return { t, v, on };
}

/**
 * Porta lo stato all'istante `now`. Se il cronometro arriva a 0 il periodo si chiude
 * all'istante esatto in cui è scaduto (non a `now`).
 */
export function settle(s: LiveState, now: number): LiveState {
  const dt = Math.max(0, now - s.settledAt);
  if (dt === 0) return s;
  // Campioni INT per il grafico, calcolati in modo esatto sull'intervallo [settledAt, now]
  let samples = s.samples;
  let nextSampleAt = s.nextSampleAt;
  if (s.started && nextSampleAt != null && nextSampleAt <= now) {
    samples = [...samples];
    while (nextSampleAt <= now) {
      samples.push(sampleAt(s, nextSampleAt));
      nextSampleAt += INT_CONFIG.sampleEveryMs;
    }
  }
  if (!s.running) {
    if (!s.started) return { ...s, settledAt: now };
    const players: Record<number, PlayerLive> = {};
    for (const [k, p] of Object.entries(s.players)) players[+k] = p.onCourt ? { ...p, int: decayCourtStopped(p.int, dt) } : p;
    return { ...s, players, settledAt: now, samples, nextSampleAt };
  }
  const game = Math.min(dt, s.remainingMs);
  const ended = game >= s.remainingMs;
  const players: Record<number, PlayerLive> = {};
  for (const [k, p] of Object.entries(s.players)) {
    if (!p.onCourt) {
      players[+k] = p;
      continue;
    }
    const up = rise(p.int, p.stintMs, p.playedMs, game);
    const int = dt > game ? decayCourtStopped(up, dt - game) : up;
    players[+k] = { ...p, playedMs: p.playedMs + game, stintMs: p.stintMs + game, int, peak: Math.max(p.peak, up) };
  }
  return {
    ...s,
    players,
    remainingMs: s.remainingMs - game,
    running: !ended,
    settledAt: now,
    samples,
    nextSampleAt,
    events: ended ? [...s.events, { t: s.settledAt + game, type: 'period_end', period: s.period }] : s.events,
  };
}

/** Start/Stop. Dopo la fine del periodo, Start passa al periodo successivo e lo avvia. */
export function toggleClock(s0: LiveState, now: number): LiveState {
  const s = settle(s0, now);
  if (s.running) return { ...s, running: false, events: [...s.events, { t: now, type: 'stop' }] };
  if (s.remainingMs <= 0) {
    const period = s.period + 1;
    return { ...s, period, remainingMs: periodLength(period), running: true, events: [...s.events, { t: now, type: 'period_start', period }] };
  }
  if (!s.started) {
    // prima pressione di Start: partono anche i tempi REST
    const players: Record<number, PlayerLive> = {};
    for (const [k, p] of Object.entries(s.players)) players[+k] = p.onCourt ? p : { ...p, restSince: now };
    const first = { ...s, players, started: true, startedAt: now };
    return {
      ...first,
      running: true,
      samples: [sampleAt(first, now)],
      nextSampleAt: now + INT_CONFIG.sampleEveryMs,
      events: [...s.events, { t: now, type: 'period_start', period: s.period }, { t: now, type: 'start' }],
    };
  }
  return { ...s, running: true, events: [...s.events, { t: now, type: 'start' }] };
}

/**
 * Cambio: `outs` (in campo) escono, `ins` (in REST) entrano. Stesse quantità.
 * Le coppie si formano per ruolo (lungo per lungo) e chi entra prende la posizione di chi esce.
 */
export function substitute(s0: LiveState, outs: number[], ins: number[], roles: Record<number, Role>, now: number): LiveState {
  if (outs.length !== ins.length || !outs.length) return s0;
  if (!outs.every((id) => s0.players[id]?.onCourt) || !ins.every((id) => s0.players[id] && !s0.players[id].onCourt)) return s0;
  const s = settle(s0, now);
  const o = [...outs].sort((a, b) => roleRank(roles, a) - roleRank(roles, b) || a - b);
  const i = [...ins].sort((a, b) => roleRank(roles, a) - roleRank(roles, b) || a - b);
  const slots = [...s.slots];
  const players = { ...s.players };
  o.forEach((outId, k) => {
    const inId = i[k];
    slots[slots.indexOf(outId)] = inId;
    // chi esce porta in panchina l'INT attuale (valore di uscita); chi entra parte dal valore recuperato in panchina
    const inInt = playerIntAt(players[inId], s, now);
    players[outId] = { ...players[outId], onCourt: false, stintMs: 0, restSince: s.started ? now : null };
    players[inId] = { ...players[inId], onCourt: true, stintMs: 0, entries: players[inId].entries + 1, restSince: null, int: inInt };
  });
  return { ...s, slots, players, events: [...s.events, { t: now, type: 'sub', out: o, in: i }] };
}

/**
 * Correzione manuale del cronometro di ±`deltaMs` di gioco (es. ±5 s):
 * deltaMs > 0 manda avanti il tempo (il cronometro scende), deltaMs < 0 lo riporta indietro.
 * Di conseguenza si aggiornano i minuti dei giocatori in campo e i tempi in panchina.
 * Limiti: il cronometro resta tra 00:00 e la durata del periodo; nessun tempo diventa negativo.
 */
export function adjustClock(s0: LiveState, deltaMs: number, now: number): LiveState {
  if (!s0.started || deltaMs === 0) return s0;
  const s = settle(s0, now);
  const len = periodLength(s.period);
  const d = deltaMs > 0 ? Math.min(deltaMs, s.remainingMs) : -Math.min(-deltaMs, len - s.remainingMs);
  if (d === 0) return s;
  const players: Record<number, PlayerLive> = {};
  for (const [k, p] of Object.entries(s.players)) {
    if (p.onCourt) {
      // avanti: l'INT sale per i secondi aggiunti; indietro: si toglie quanto sarebbe salito
      const int = d > 0 ? rise(p.int, p.stintMs, p.playedMs, d) : clampInt(p.int + (ratePerMin(Math.max(0, p.stintMs + d), Math.max(0, p.playedMs + d)) * d) / 60_000);
      players[+k] = { ...p, playedMs: Math.max(0, p.playedMs + d), stintMs: Math.max(0, p.stintMs + d), int, peak: Math.max(p.peak, int) };
    }
    else players[+k] = p.restSince != null ? { ...p, restSince: Math.min(now, p.restSince - d) } : p;
  }
  const remainingMs = s.remainingMs - d;
  const ended = s.running && remainingMs <= 0;
  const events: LiveEvent[] = [...s.events, { t: now, type: 'adjust', deltaMs: d }];
  if (ended) events.push({ t: now, type: 'period_end', period: s.period });
  return { ...s, players, remainingMs, running: s.running && !ended, events };
}

export function addScore(s: LiveState, side: 'us' | 'them', pts: 1 | 2 | 3, now: number): LiveState {
  return {
    ...s,
    us: s.us + (side === 'us' ? pts : 0),
    them: s.them + (side === 'them' ? pts : 0),
    scoreLog: [...s.scoreLog, { side, pts, t: now, period: s.period }],
  };
}

export function undoScore(s: LiveState): LiveState {
  const last = s.scoreLog[s.scoreLog.length - 1];
  if (!last) return s;
  return {
    ...s,
    us: s.us - (last.side === 'us' ? last.pts : 0),
    them: s.them - (last.side === 'them' ? last.pts : 0),
    scoreLog: s.scoreLog.slice(0, -1),
  };
}

/** Tempo reale di riposo (continua anche a cronometro fermo). */
export const restMs = (p: PlayerLive, now: number) => (p.restSince != null ? Math.max(0, now - p.restSince) : 0);

/** true se il periodo è finito e Start porterà al successivo */
export const periodOver = (s: LiveState) => s.started && !s.running && s.remainingMs <= 0;

/** "MM:SS" — `ceil` per il cronometro (10:00 finché non è passato un secondo), `floor` per i minuti giocati */
export function mmss(ms: number, round: 'ceil' | 'floor' = 'floor'): string {
  const total = Math.max(0, round === 'ceil' ? Math.ceil(ms / 1000) : Math.floor(ms / 1000));
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}
