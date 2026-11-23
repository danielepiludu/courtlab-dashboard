import { useEffect, useState } from 'react';
import { Lock } from 'lucide-react';
import { CloudError, signIn } from './client';
import { APP, DEFAULT_TEAM } from '@/config';
import { applyVars, themeVars } from '@/theme/apply';

/**
 * Schermata di accesso: senza il login dello staff l'app non si carica.
 * Volutamente indipendente dal resto dell'app (niente database, niente menu, niente squadre).
 */
export function LockScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // colori di Courtlab, non quelli dell'ultima squadra usata: l'app non è legata a una squadra
  useEffect(() => applyVars(themeVars(DEFAULT_TEAM.primary, DEFAULT_TEAM.secondary)), []);

  const login = async () => {
    if (!email.trim() || !password) return;
    setBusy(true);
    setError(null);
    try {
      await signIn(email, password);
    } catch (e) {
      setError(e instanceof CloudError ? e.message : 'Accesso non riuscito');
      setBusy(false);
    }
  };

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-6 py-10 text-ink">
      <img src={`${import.meta.env.BASE_URL}icons/app-logo.png`} alt="" width={84} height={84} className="mx-auto h-[84px] w-[84px]" draggable={false} />
      <h1 className="mt-5 text-center font-display text-[36px] font-bold leading-none tracking-wide">Courtlab</h1>
      <p className="mt-2 flex items-center justify-center gap-1.5 text-center text-[15px] text-ink-muted">
        <Lock size={15} /> Accesso riservato allo staff
      </p>
      <form
        className="mt-8"
        onSubmit={(e) => {
          e.preventDefault();
          void login();
        }}
      >
        <label className="mb-1.5 block text-[12px] font-bold uppercase tracking-widest text-ink-muted" htmlFor="lock-email">
          Email
        </label>
        <input id="lock-email" className="input mb-4" type="email" autoComplete="username" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <label className="mb-1.5 block text-[12px] font-bold uppercase tracking-widest text-ink-muted" htmlFor="lock-password">
          Password
        </label>
        <input id="lock-password" className="input mb-5" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
        {error && <p className="mb-3 text-center text-[14px] font-semibold text-danger">{error}</p>}
        <button
          type="submit"
          disabled={busy || !email.trim() || !password}
          className="h-14 w-full rounded-2xl bg-[var(--c-select)] font-display text-[20px] font-bold tracking-wide text-[var(--c-on-select)] transition active:scale-[.98] disabled:opacity-40"
        >
          {busy ? 'Accesso…' : 'Accedi'}
        </button>
      </form>
      <p className="mt-6 text-center text-[13px] leading-relaxed text-ink-faint">Sei un atleta? Usa il link che ti ha mandato lo staff.</p>
      <p className="mt-10 text-center text-[11px] font-semibold uppercase tracking-[0.2em] text-ink-faint">{APP.credit}</p>
    </main>
  );
}
