import Dexie, { type Table } from 'dexie';
import type { Live } from './live';
export type Role = 'PG' | 'SG' | 'SF' | 'PF' | 'C';
export type Status = 'ok' | 'inj' | 'doubt';
export const ROLES: Role[] = ['PG', 'SG', 'SF', 'PF', 'C'];
export const STATUS: Record<Status, { l: string; c: string }> = {
  ok: { l: 'Disponibile', c: 'bg-emerald-600/15 text-emerald-700' },
  inj: { l: 'Infortunato', c: 'bg-red-600/15 text-red-700' },
  doubt: { l: 'In dubbio', c: 'bg-amber-500/20 text-amber-700' },
};
export interface Player { id?: number; name: string; number: number; role: Role; traits: string; notes: string;
  status: Status; statusNote: string; statusDate: string; photo?: string }
export interface Game { id?: number; date: string; time: string; opponent: string; home: boolean; notes: string;
  finished: boolean; scoreUs?: number; scoreThem?: number;
  stats?: Record<number, { played: number; entries: number; f: number; peak: number }> }
class DB extends Dexie {
  players!: Table<Player, number>; games!: Table<Game, number>; live!: Table<Live, number>;
  constructor() { super('minuti-basket'); this.version(1).stores({ players: '++id,number,role,status', games: '++id,date,finished' });
    this.version(2).stores({ players: '++id,number,role,status', games: '++id,date,finished', live: 'id' }); }
}
export const db = new DB();
export const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
export function toAvatar(file: File): Promise<string> {
  return new Promise((res, rej) => {
    const img = new Image(), u = URL.createObjectURL(file);
    img.onload = () => { const s = Math.min(img.width, img.height), c = document.createElement('canvas'); c.width = c.height = 160;
      c.getContext('2d')!.drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, 160, 160);
      URL.revokeObjectURL(u); res(c.toDataURL('image/jpeg', 0.8)); };
    img.onerror = rej; img.src = u;
  });
}
