export interface Team {
  id?: number;
  name: string;
  /** es. "2026/27" */
  season: string;
  /**
   * Logo come data URL (PNG/JPEG) salvato in locale, oppure `builtin:donbosco`
   * per il logo incluso nell'app (public/logo.png). Facoltativo.
   */
  logo?: string;
  /** colore primario #rrggbb */
  primary: string;
  /** colore secondario #rrggbb */
  secondary: string;
  archived: boolean;
  createdAt: number;
  updatedAt: number;
}

export const BUILTIN_LOGO = 'builtin:donbosco';

/** Giocatore come era al momento della partita (il resoconto non dipende da modifiche successive). */
export interface ReportPlayer {
  id: number;
  name: string;
  number: string;
  role: Role;
}

/** Resoconto di una partita conclusa: stato finale della partita + istantanea dei convocati. */
export interface GameReport {
  gameId: number;
  teamId: number;
  finishedAt: number;
  players: ReportPlayer[];
  live: import('@/features/live/liveModel').LiveState;
}

export type Role = 'PG' | 'SG' | 'SF' | 'PF' | 'C';
export const ROLES: Role[] = ['PG', 'SG', 'SF', 'PF', 'C'];
export const ROLE_LABEL: Record<Role, string> = {
  PG: 'Playmaker',
  SG: 'Guardia',
  SF: 'Ala piccola',
  PF: 'Ala grande',
  C: 'Centro',
};

export type PlayerStatus = 'available' | 'doubtful' | 'injured';
export const STATUSES: PlayerStatus[] = ['available', 'doubtful', 'injured'];

export interface Player {
  id?: number;
  teamId: number;
  name: string;
  /** Numero di maglia come stringa per distinguere "0" da "00" */
  number: string;
  role: Role;
  /** Caratteristiche di gioco (tag) */
  traits: string[];
  notes: string;
  status: PlayerStatus;
  /** Data (YYYY-MM-DD) da cui vale lo stato */
  statusDate: string;
  statusDetails: string;
  /** Foto come data URL JPEG quadrata (mostrata circolare) */
  photo?: string;
  createdAt: number;
  updatedAt: number;
}

export type GameStatus = 'scheduled' | 'live' | 'finished';

export interface Game {
  id?: number;
  teamId: number;
  /** YYYY-MM-DD */
  date: string;
  /** HH:MM */
  time: string;
  opponent: string;
  home: boolean;
  notes: string;
  status: GameStatus;
  scoreUs?: number;
  scoreThem?: number;
  finishedAt?: number;
  createdAt: number;
  updatedAt: number;
}

export type Outcome = 'W' | 'L' | 'D';
export function outcomeOf(g: Pick<Game, 'scoreUs' | 'scoreThem'>): Outcome {
  const us = g.scoreUs ?? 0;
  const them = g.scoreThem ?? 0;
  return us > them ? 'W' : us < them ? 'L' : 'D';
}
export const OUTCOME_LABEL: Record<Outcome, string> = { W: 'Vittoria', L: 'Sconfitta', D: 'Pareggio' };

/** Confronto numeri di maglia: "0" < "00" < "1" < … < "99" */
// particelle che fanno parte del cognome (De Luca, Di Stefano, Dal Molin…)
const PARTICLES = new Set(['de', 'di', 'da', 'del', 'della', 'dello', 'dei', 'degli', 'dal', 'dalla', 'dall', "dall'", 'dalle', 'lo', 'la', 'li', 'le', 'van', 'von', 'mc', 'mac', "d'"]);

/** Cognome da "Nome Cognome" (con particelle); con una sola parola è il nome intero. */
export function surnameOf(name: string): string {
  const w = name.trim().split(/\s+/);
  if (w.length <= 1) return name.trim();
  let i = w.length - 1;
  while (i > 1 && PARTICLES.has(w[i - 1].toLowerCase())) i--;
  return w.slice(i).join(' ');
}

/** Ordine alfabetico per cognome, poi per nome. */
export function compareSurname(a: { name: string }, b: { name: string }): number {
  return surnameOf(a.name).localeCompare(surnameOf(b.name), 'it', { sensitivity: 'base' }) || a.name.localeCompare(b.name, 'it', { sensitivity: 'base' });
}

export function compareNumbers(a: string, b: string): number {
  const na = a === '' ? 999 : Number(a);
  const nb = b === '' ? 999 : Number(b);
  return na - nb || a.length - b.length;
}

/** Seduta di allenamento per l'RPE (session-RPE). La durata la inserisce lo staff. */
export type SessionType = 'basket' | 'partita';
export const SESSION_TYPES: SessionType[] = ['basket', 'partita'];
export const SESSION_TYPE_LABEL: Record<SessionType, string> = { basket: 'Allenamento tecnico', partita: 'Partita' };

export interface TrainingSession {
  id?: number;
  teamId: number;
  /** YYYY-MM-DD */
  date: string;
  type: SessionType;
  /** durata in minuti (TEMPO del foglio) */
  minutes: number;
  notes: string;
  createdAt: number;
  updatedAt: number;
  /** link per gli atleti (Courtlab Cloud): codice della raccolta e se accetta ancora risposte */
  surveyToken?: string;
  surveyOpen?: boolean;
}

/** RPE di un atleta in una seduta. TL = RPE × minuti (della seduta, salvo correzione per l'atleta). */
export interface RpeEntry {
  id?: number;
  teamId: number;
  sessionId: number;
  playerId: number;
  /** 0–10 (scala CR-10); null = nessuna risposta */
  rpe: number | null;
  /** minuti per questo atleta se diversi da quelli della seduta (es. uscito prima) */
  minutes: number | null;
  source: 'staff' | 'atleta' | 'import';
  updatedAt: number;
}
