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
export function compareNumbers(a: string, b: string): number {
  const na = a === '' ? 999 : Number(a);
  const nb = b === '' ? 999 : Number(b);
  return na - nb || a.length - b.length;
}
