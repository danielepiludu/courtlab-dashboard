import { db } from '@/db/db';
import { setRpe } from '@/db/rpeRepo';
import { BUILTIN_LOGO, SESSION_TYPE_LABEL, compareSurname, type Player, type Team, type TrainingSession } from '@/db/types';
import { loadImageUrl } from '@/lib/image';
import { rest } from './client';

/** Raccolta RPE pubblicata per una seduta (vista dalla pagina degli atleti). */
export interface PublicSurvey {
  team_name: string;
  team_primary: string | null;
  team_secondary: string | null;
  team_logo: string | null;
  session_date: string;
  session_label: string;
  open: boolean;
  roster: RosterItem[];
  answered: number[];
}
export interface RosterItem {
  id: number;
  name: string;
  number: string;
  /** foto ridotta (data URL JPEG) */
  photo?: string;
}

export const LOGO_BUILTIN = 'builtin';

/** Codice casuale non indovinabile (62^10 ≈ 8·10^17 combinazioni). */
export function newToken(len = 10): string {
  const abc = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const bytes = crypto.getRandomValues(new Uint8Array(len * 2));
  let out = '';
  for (const b of bytes) {
    if (b < 248) out += abc[b % 62];
    if (out.length === len) break;
  }
  return out.length === len ? out : newToken(len);
}

/** Link da mandare agli atleti. */
export function surveyUrl(token: string): string {
  return `${location.origin}${import.meta.env.BASE_URL}rpe/#${token}`;
}

async function smallLogo(team: Team): Promise<string | null> {
  if (!team.logo) return null;
  if (team.logo === BUILTIN_LOGO) return LOGO_BUILTIN;
  try {
    const img = await loadImageUrl(team.logo);
    const side = 160;
    const k = side / Math.max(img.naturalWidth, img.naturalHeight);
    const c = document.createElement('canvas');
    c.width = Math.round(img.naturalWidth * k);
    c.height = Math.round(img.naturalHeight * k);
    c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
    return c.toDataURL('image/png');
  } catch {
    return null;
  }
}

/** Foto ridotta per la pagina del link (200 px, ~6 kB: nitida anche sugli schermi ad alta densità). */
async function photoThumb(src: string | undefined, side = 200): Promise<string | undefined> {
  if (!src) return undefined;
  try {
    const img = await loadImageUrl(src);
    const k = side / Math.min(img.naturalWidth, img.naturalHeight);
    const w = Math.round(img.naturalWidth * k);
    const h = Math.round(img.naturalHeight * k);
    const c = document.createElement('canvas');
    c.width = side;
    c.height = side;
    c.getContext('2d')!.drawImage(img, (side - w) / 2, (side - h) / 2, w, h);
    return c.toDataURL('image/jpeg', 0.74);
  } catch {
    return undefined;
  }
}

/** Elenco per la pagina del link: ordine alfabetico per cognome, con foto ridotta. */
export async function roster(players: Player[]): Promise<RosterItem[]> {
  const sorted = [...players].sort(compareSurname);
  return Promise.all(sorted.map(async (p) => ({ id: p.id!, name: p.name, number: p.number ?? '', photo: await photoThumb(p.photo) })));
}

/** Crea o aggiorna la raccolta online della seduta e restituisce il codice. */
export async function publishSurvey(session: TrainingSession, team: Team, players: Player[], open = true): Promise<string> {
  const token = session.surveyToken ?? newToken();
  await rest('rpe_surveys?on_conflict=token', {
    method: 'POST',
    prefer: 'resolution=merge-duplicates,return=minimal',
    body: JSON.stringify({
      token,
      team_name: team.name,
      team_primary: team.primary,
      team_secondary: team.secondary,
      team_logo: await smallLogo(team),
      session_date: session.date,
      session_label: SESSION_TYPE_LABEL[session.type],
      minutes: session.minutes,
      roster: await roster(players),
      open,
      updated_at: new Date().toISOString(),
    }),
  });
  await db.sessions.update(session.id!, { surveyToken: token, surveyOpen: open });
  return token;
}

export async function setSurveyOpen(session: TrainingSession, open: boolean) {
  if (!session.surveyToken) return;
  await rest(`rpe_surveys?token=eq.${session.surveyToken}`, { method: 'PATCH', prefer: 'return=minimal', body: JSON.stringify({ open, updated_at: new Date().toISOString() }) });
  await db.sessions.update(session.id!, { surveyOpen: open });
}

export async function deleteSurvey(token: string) {
  await rest(`rpe_surveys?token=eq.${token}`, { method: 'DELETE', prefer: 'return=minimal' });
}

interface ResponseRow {
  token: string;
  player_id: number;
  rpe: number | string;
}

/**
 * Scarica le risposte degli atleti e le salva come RPE (fonte "atleta").
 * Ciò che lo staff ha inserito o corretto a mano ha sempre la precedenza.
 * Restituisce quante risposte nuove o cambiate sono state salvate.
 */
export async function pullResponses(sessions: TrainingSession[]): Promise<number> {
  const withLink = sessions.filter((s) => s.surveyToken && s.id != null);
  if (!withLink.length) return 0;
  const byToken = new Map(withLink.map((s) => [s.surveyToken!, s]));
  const rows = await rest<ResponseRow[]>(`rpe_responses?select=token,player_id,rpe&token=in.(${[...byToken.keys()].join(',')})`);
  let changed = 0;
  for (const r of rows ?? []) {
    const s = byToken.get(r.token);
    if (!s) continue;
    const rpe = Number(r.rpe);
    const local = await db.rpe.where('[sessionId+playerId]').equals([s.id!, r.player_id]).first();
    if (local && local.source !== 'atleta') continue;
    if (local?.rpe === rpe) continue;
    await setRpe(s, r.player_id, rpe, local?.minutes ?? null, 'atleta');
    changed++;
  }
  return changed;
}
