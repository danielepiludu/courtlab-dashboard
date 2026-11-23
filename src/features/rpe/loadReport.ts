/**
 * Report del carico per un periodo (funzioni pure): sedute, RPE, indicatori del foglio sRPE
 * e, quando ci sono, minuti e INT delle partite monitorate con la schermata live.
 */
import { acwrZone, athleteSeries, entryTL, teamSeries, type AthleteDay, type TeamDay } from '@/engine/load';
import { toLoadEntries } from '@/db/rpeRepo';
import { compareSurname, type Game, type GameReport, type Player, type RpeEntry, type Team, type TrainingSession } from '@/db/types';
import { summarize } from '@/features/report/reportModel';

export interface MatchLoad {
  date: string;
  opponent: string;
  /** minuti giocati (ms) */
  playedMs: number;
  intAvg: number | null;
  intPeak: number;
}

export interface AthleteLoad {
  player: Player;
  /** sedute del periodo con un RPE */
  answered: number;
  /** sedute del periodo senza risposta */
  missing: number;
  rpeAvg: number | null;
  tlTotal: number;
  /** TL medio per seduta con risposta */
  tlAvg: number | null;
  /** ultimo giorno del periodo (indicatori del foglio) */
  last: AthleteDay | null;
  /** giorni del periodo con Work Load sopra 1,3 / sotto 0,8 */
  daysHigh: number;
  daysLow: number;
  /** serie giorno per giorno limitata al periodo (calcolata su tutto lo storico) */
  series: AthleteDay[];
  /** seduta per seduta nel periodo */
  rows: { date: string; type: TrainingSession['type']; rpe: number | null; minutes: number; tl: number | null }[];
  matches: MatchLoad[];
  playedMs: number;
  intAvg: number | null;
  intPeak: number | null;
}

export interface LoadReport {
  team: Pick<Team, 'name' | 'season' | 'primary' | 'secondary' | 'logo'>;
  from: string;
  to: string;
  windowDays: number;
  sessions: TrainingSession[];
  matchSessions: number;
  teamDays: (TeamDay & { type: TrainingSession['type'] | 'misto' })[];
  rpeAvg: number | null;
  tlAvg: number | null;
  /** risposte / (sedute × atleti) */
  responseRate: number | null;
  zones: { high: number; ok: number; low: number };
  athletes: AthleteLoad[];
  /** partite monitorate (schermata live) nel periodo */
  liveGames: number;
}

export interface LoadReportInput {
  team: LoadReport['team'];
  players: Player[];
  sessions: TrainingSession[];
  entries: RpeEntry[];
  games?: Game[];
  reports?: GameReport[];
  from: string;
  to: string;
  windowDays: number;
}

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
const inRange = (d: string, from: string, to: string) => d >= from && d <= to;

export function buildLoadReport(i: LoadReportInput): LoadReport {
  const players = [...i.players].sort(compareSurname);
  const all = [...i.sessions].sort((a, b) => a.date.localeCompare(b.date));
  const sessions = all.filter((s) => inRange(s.date, i.from, i.to));
  const sessionIds = new Set(sessions.map((s) => s.id));
  const load = toLoadEntries(all, i.entries, players);

  // partite monitorate nel periodo
  const gameById = new Map((i.games ?? []).map((g) => [g.id, g]));
  const liveReports = (i.reports ?? [])
    .map((r) => ({ r, g: gameById.get(r.gameId) }))
    .filter((x): x is { r: GameReport; g: Game } => !!x.g && inRange(x.g.date, i.from, i.to))
    .sort((a, b) => a.g.date.localeCompare(b.g.date));
  const summaries = liveReports.map(({ r, g }) => ({ g, s: summarize(r) }));

  const typeByDate = new Map<string, TrainingSession['type'] | 'misto'>();
  for (const s of sessions) typeByDate.set(s.date, typeByDate.has(s.date) && typeByDate.get(s.date) !== s.type ? 'misto' : s.type);

  const athletes: AthleteLoad[] = players.map((p) => {
    const mine = i.entries.filter((e) => e.playerId === p.id && sessionIds.has(e.sessionId) && e.rpe != null);
    const tls = mine.map((e) => entryTL({ rpe: e.rpe, minutes: e.minutes ?? sessions.find((s) => s.id === e.sessionId)?.minutes ?? null }) ?? 0);
    const series = athleteSeries(load, p.id!, i.windowDays).filter((d) => inRange(d.date, i.from, i.to));
    const matches: MatchLoad[] = summaries.flatMap(({ g, s }) => {
      const ps = s.players.find((x) => x.id === p.id);
      return ps ? [{ date: g.date, opponent: g.opponent, playedMs: ps.playedMs, intAvg: Number.isFinite(ps.intAvg) ? ps.intAvg : null, intPeak: ps.intPeak }] : [];
    });
    const intAvgs = matches.map((m) => m.intAvg).filter((v): v is number => v != null);
    return {
      player: p,
      answered: mine.length,
      missing: sessions.length - mine.length,
      rpeAvg: mean(mine.map((e) => e.rpe as number)),
      tlTotal: tls.reduce((a, b) => a + b, 0),
      tlAvg: mean(tls),
      last: series[series.length - 1] ?? null,
      daysHigh: series.filter((d) => d.tl != null && acwrZone(d.acwr) === 'high').length,
      daysLow: series.filter((d) => d.tl != null && acwrZone(d.acwr) === 'low').length,
      series,
      rows: sessions.map((s) => {
        const e = i.entries.find((x) => x.sessionId === s.id && x.playerId === p.id);
        const minutes = e?.minutes ?? s.minutes;
        return { date: s.date, type: s.type, rpe: e?.rpe ?? null, minutes, tl: entryTL({ rpe: e?.rpe ?? null, minutes }) };
      }),
      matches,
      playedMs: matches.reduce((a, m) => a + m.playedMs, 0),
      intAvg: mean(intAvgs),
      intPeak: matches.length ? Math.max(...matches.map((m) => m.intPeak)) : null,
    };
  });

  const zones = { high: 0, ok: 0, low: 0 };
  for (const a of athletes) {
    const z = a.answered ? acwrZone(a.last?.acwr ?? null) : null;
    if (z) zones[z]++;
  }
  const answeredAll = athletes.reduce((n, a) => n + a.answered, 0);
  const allRpe = i.entries.filter((e) => sessionIds.has(e.sessionId) && e.rpe != null && players.some((p) => p.id === e.playerId));
  const teamDays = teamSeries(load, i.windowDays)
    .filter((d) => inRange(d.date, i.from, i.to) && d.count > 0)
    .map((d) => ({ ...d, type: typeByDate.get(d.date) ?? 'basket' }));

  return {
    team: i.team,
    from: i.from,
    to: i.to,
    windowDays: i.windowDays,
    sessions,
    matchSessions: sessions.filter((s) => s.type === 'partita').length,
    teamDays,
    rpeAvg: mean(allRpe.map((e) => e.rpe as number)),
    tlAvg: mean(teamDays.flatMap((d) => (d.avg != null ? [d.avg] : []))),
    responseRate: sessions.length && players.length ? answeredAll / (sessions.length * players.length) : null,
    zones,
    athletes,
    liveGames: liveReports.length,
  };
}

/** Periodi predefiniti per il report. */
export function presetRange(kind: 'week' | 'month' | 'season', today: string, firstDate?: string): { from: string; to: string } {
  const d = new Date(`${today}T12:00:00Z`);
  const back = (days: number) => new Date(d.getTime() - days * 86_400_000).toISOString().slice(0, 10);
  if (kind === 'week') return { from: back(6), to: today };
  if (kind === 'month') return { from: back(27), to: today };
  return { from: firstDate && firstDate < today ? firstDate : back(27), to: today };
}
