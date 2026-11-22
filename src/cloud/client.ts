import { create } from 'zustand';
import { CLOUD, cloudConfigured } from './config';

/** Client minimo per Supabase (Auth + REST/RPC) con fetch: niente SDK, poche righe, funziona ovunque. */

export interface CloudSession {
  access_token: string;
  refresh_token: string;
  /** secondi epoch */
  expires_at: number;
  user: { id: string; email: string };
}

export class CloudError extends Error {
  constructor(
    message: string,
    public status = 0,
  ) {
    super(message);
  }
}

const KEY = 'courtlab-cloud-session';
function load(): CloudSession | null {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? 'null') as CloudSession | null;
  } catch {
    return null;
  }
}
function persist(s: CloudSession | null) {
  try {
    if (s) localStorage.setItem(KEY, JSON.stringify(s));
    else localStorage.removeItem(KEY);
  } catch {
    /* ignora */
  }
  useCloud.setState({ session: s });
}

export const useCloud = create<{ session: CloudSession | null }>(() => ({ session: load() }));

const ITALIAN: Record<string, string> = {
  'Invalid login credentials': 'Email o password non corretti',
  'Email not confirmed': "Email non ancora confermata: apri il link ricevuto o conferma l'utente in Supabase",
  'Failed to fetch': 'Nessuna connessione a internet',
};

async function parseError(res: Response): Promise<CloudError> {
  let msg = `Errore ${res.status}`;
  try {
    const j = (await res.json()) as Record<string, string>;
    msg = j.error_description || j.msg || j.message || j.error || msg;
  } catch {
    /* corpo non JSON */
  }
  return new CloudError(ITALIAN[msg] ?? msg, res.status);
}

async function call(path: string, init: RequestInit & { token?: string; prefer?: string } = {}): Promise<Response> {
  if (!cloudConfigured()) throw new CloudError('Courtlab Cloud non è ancora configurato');
  const headers: Record<string, string> = { apikey: CLOUD.key, 'Content-Type': 'application/json' };
  if (init.token) headers.Authorization = `Bearer ${init.token}`;
  if (init.prefer) headers.Prefer = init.prefer;
  let res: Response;
  try {
    res = await fetch(`${CLOUD.url}${path}`, { ...init, headers: { ...headers, ...(init.headers as Record<string, string>) } });
  } catch {
    throw new CloudError(navigator.onLine === false ? 'Sei offline' : 'Nessuna connessione a internet');
  }
  if (!res.ok) throw await parseError(res);
  return res;
}

function toSession(j: { access_token: string; refresh_token: string; expires_in: number; expires_at?: number; user: { id: string; email: string } }): CloudSession {
  return {
    access_token: j.access_token,
    refresh_token: j.refresh_token,
    expires_at: j.expires_at ?? Math.floor(Date.now() / 1000) + j.expires_in,
    user: { id: j.user.id, email: j.user.email },
  };
}

export async function signIn(email: string, password: string) {
  const res = await call('/auth/v1/token?grant_type=password', { method: 'POST', body: JSON.stringify({ email: email.trim(), password }) });
  const s = toSession(await res.json());
  persist(s);
  return s;
}

export async function signOut() {
  const s = useCloud.getState().session;
  persist(null);
  if (s) await call('/auth/v1/logout', { method: 'POST', token: s.access_token }).catch(() => undefined);
}

let refreshing: Promise<string> | null = null;
/** Token valido dello staff (rinnovato se sta per scadere). */
export async function accessToken(): Promise<string> {
  const s = useCloud.getState().session;
  if (!s) throw new CloudError('Accedi a Courtlab Cloud dalle Impostazioni', 401);
  if (s.expires_at - 60 > Date.now() / 1000) return s.access_token;
  refreshing ??= (async () => {
    try {
      const res = await call('/auth/v1/token?grant_type=refresh_token', { method: 'POST', body: JSON.stringify({ refresh_token: s.refresh_token }) });
      const next = toSession(await res.json());
      persist(next);
      return next.access_token;
    } catch (e) {
      // sessione scaduta o revocata: serve un nuovo accesso
      if (e instanceof CloudError && (e.status === 400 || e.status === 401)) persist(null);
      throw e;
    } finally {
      refreshing = null;
    }
  })();
  return refreshing;
}

/** REST autenticato come staff. */
export async function rest<T = unknown>(path: string, init: RequestInit & { prefer?: string } = {}): Promise<T> {
  const res = await call(`/rest/v1/${path}`, { ...init, token: await accessToken() });
  const text = await res.text();
  return (text ? JSON.parse(text) : null) as T;
}

/** Funzione pubblica (usata dalla pagina degli atleti, senza account). */
export async function rpc<T = unknown>(fn: string, args: Record<string, unknown>): Promise<T> {
  const res = await call(`/rest/v1/rpc/${fn}`, { method: 'POST', body: JSON.stringify(args) });
  const text = await res.text();
  return (text ? JSON.parse(text) : null) as T;
}
