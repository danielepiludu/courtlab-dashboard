import { useCallback, useEffect, useState } from 'react';
import { Check, ChevronLeft, CloudOff, Lock, RefreshCw } from 'lucide-react';
import { CloudError, rpc } from '@/cloud/client';
import { LOGO_BUILTIN, type PublicSurvey, type RosterItem } from '@/cloud/surveys';
import { RPE_SCALE } from '@/engine/load';
import { intColor } from '@/lib/intColor';
import { applyVars, themeVars } from '@/theme/apply';
import { cx } from '@/lib/cx';
import { shortSurname, surnameFirst } from '@/db/types';
import { APP } from '@/config';

const rpeColor = (v: number) => intColor(v / 10);
const fmtRpe = (v: number) => String(v).replace('.', ',');
const vibrate = (ms: number) => {
  try {
    navigator.vibrate?.(ms);
  } catch {
    /* non supportato */
  }
};
const fmtDate = (iso: string) =>
  new Date(`${iso}T12:00:00`).toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' });

// l'atleta scelto viene ricordato per squadra: dalla volta dopo è già selezionato
const MEMO = 'courtlab-athlete';
function remembered(team: string): number | null {
  try {
    return (JSON.parse(localStorage.getItem(MEMO) ?? '{}') as Record<string, number>)[team] ?? null;
  } catch {
    return null;
  }
}
function remember(team: string, id: number) {
  try {
    const m = JSON.parse(localStorage.getItem(MEMO) ?? '{}') as Record<string, number>;
    localStorage.setItem(MEMO, JSON.stringify({ ...m, [team]: id }));
  } catch {
    /* ignora */
  }
}

type State = { kind: 'loading' } | { kind: 'error'; message: string } | { kind: 'ready'; survey: PublicSurvey };

/** Pagina pubblica del link: l'atleta sceglie il nome e l'RPE della seduta. Nessuna installazione. */
export default function AthletePage({ token }: { token: string }) {
  const [state, setState] = useState<State>({ kind: 'loading' });
  const [me, setMe] = useState<RosterItem | null>(null);
  const [rpe, setRpe] = useState<number | null>(null);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setState({ kind: 'loading' });
    if (!token) {
      setState({ kind: 'error', message: 'Questo indirizzo non contiene un link valido. Apri il link completo che ti ha mandato lo staff.' });
      return;
    }
    try {
      const survey = await rpc<PublicSurvey | null>('get_survey', { p_token: token });
      if (!survey) throw new CloudError('Link non valido o scaduto: chiedi allo staff un nuovo link.');
      if (survey.team_primary && survey.team_secondary) applyVars(themeVars(survey.team_primary, survey.team_secondary));
      document.title = `RPE · ${survey.team_name}`;
      const memo = remembered(survey.team_name);
      const known = survey.roster.find((r) => r.id === memo);
      if (known) setMe((cur) => cur ?? known);
      setState({ kind: 'ready', survey });
    } catch (e) {
      setState({ kind: 'error', message: e instanceof CloudError ? e.message : 'Impossibile aprire il link' });
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  const send = async () => {
    if (!me || rpe == null || state.kind !== 'ready') return;
    setSending(true);
    setError(null);
    try {
      await rpc('submit_rpe', { p_token: token, p_player: me.id, p_rpe: rpe });
      remember(state.survey.team_name, me.id);
      vibrate(30);
      setSent(rpe);
    } catch (e) {
      // messaggi previsti (in italiano); qualunque altro errore tecnico diventa un testo comprensibile
      const known = ['Link non valido', 'La raccolta è chiusa', 'Atleta non in elenco', 'Valore RPE non valido', 'Sei offline', 'Nessuna connessione a internet'];
      const msg = e instanceof CloudError ? e.message : '';
      if (!known.includes(msg)) console.error('Invio RPE non riuscito:', e);
      setError(known.includes(msg) ? msg : 'Invio non riuscito: riprova tra poco o avvisa lo staff.');
    } finally {
      setSending(false);
    }
  };

  if (state.kind === 'loading')
    return (
      <Shell>
        <div className="grid min-h-[60dvh] place-items-center">
          <span className="h-10 w-10 animate-spin rounded-full border-4 border-white/15 border-t-[var(--c-select)]" aria-label="Caricamento" />
        </div>
      </Shell>
    );

  if (state.kind === 'error')
    return (
      <Shell>
        <Message icon={<CloudOff size={30} />} title="Non riesco ad aprire il link" text={state.message}>
          <button onClick={() => void load()} className="mt-5 inline-flex h-12 items-center gap-2 rounded-xl bg-white/10 px-5 font-bold active:scale-95">
            <RefreshCw size={18} /> Riprova
          </button>
        </Message>
      </Shell>
    );

  const s = state.survey;
  const logo = s.team_logo === LOGO_BUILTIN ? `${import.meta.env.BASE_URL}logo.png` : s.team_logo;
  const header = (
    <header className="flex items-center gap-3 px-5 pb-4 pt-[max(20px,env(safe-area-inset-top))]">
      {logo ? (
        <img src={logo} alt="" className="h-14 w-14 shrink-0 object-contain" />
      ) : (
        <span className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-brand font-display text-[26px] font-bold text-on-brand">{s.team_name.trim()[0]?.toUpperCase()}</span>
      )}
      <div className="min-w-0">
        <div className="truncate font-display text-[22px] font-bold leading-tight tracking-wide">{s.team_name}</div>
        <div className="text-[14px] text-ink-muted first-letter:uppercase">
          {s.session_label.toLowerCase()} · {fmtDate(s.session_date)}
        </div>
      </div>
    </header>
  );

  if (!s.open && sent == null)
    return (
      <Shell>
        {header}
        <Message icon={<Lock size={30} />} title="Raccolta chiusa" text="Lo staff ha chiuso le risposte per questa seduta. Se devi ancora rispondere, scrivi allo staff." />
      </Shell>
    );

  if (sent != null && me) {
    const label = RPE_SCALE.find((x) => x.value === sent)?.label;
    return (
      <Shell>
        {header}
        <div className="flex flex-col items-center px-6 pt-10 text-center">
          <span className="relative animate-[pop-in_.45s_ease-out]">
            <Avatar r={me} size={104} className="shadow-[0_0_40px_-6px_#2BB673] ring-4 ring-ok" />
            <span className="absolute -bottom-1 -right-1 grid h-10 w-10 place-items-center rounded-full border-4 border-[var(--c-bg)] bg-ok text-night">
              <Check size={22} strokeWidth={3.5} />
            </span>
          </span>
          <h1 className="mt-6 font-display text-[34px] font-bold leading-tight">Grazie, {shortSurname(me, s.roster)}!</h1>
          <p className="mt-2 text-[16px] text-ink-muted">Hai indicato</p>
          <div className="mt-1 flex items-baseline gap-3">
            <span className="font-display text-[64px] font-extrabold leading-none tabular" style={{ color: rpeColor(sent) }}>
              {fmtRpe(sent)}
            </span>
            <span className="text-[18px] font-semibold">{label}</span>
          </div>
          <button onClick={() => setSent(null)} className="mt-10 h-12 rounded-xl border border-line px-6 font-bold text-ink-muted active:scale-95">
            Modifica la risposta
          </button>
        </div>
      </Shell>
    );
  }

  if (!me)
    return (
      <Shell>
        {header}
        <section className="px-5">
          <h1 className="font-display text-[30px] font-bold leading-tight">Chi sei?</h1>
          <p className="mb-4 text-[15px] text-ink-muted">Tocca il tuo nome</p>
          <div className="grid grid-cols-2 gap-2 pb-10">
            {s.roster.map((r) => {
              const done = s.answered.includes(r.id);
              return (
                <button key={r.id} onClick={() => (vibrate(10), setMe(r), setRpe(null))} className="flex min-h-[64px] items-center gap-2.5 rounded-2xl bg-surface px-2.5 py-2 text-left active:scale-[.97]">
                  <span className="relative">
                    <Avatar r={r} size={44} />
                    {done && (
                      <span className="absolute -bottom-0.5 -right-0.5 grid h-5 w-5 place-items-center rounded-full border-2 border-[var(--c-surface)] bg-ok text-night" aria-label="già inviato">
                        <Check size={11} strokeWidth={4} />
                      </span>
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[15px] font-semibold leading-tight">{surnameFirst(r.name)}</span>
                    {r.number && <span className="text-[12px] font-bold text-brand-text">#{r.number}</span>}
                  </span>
                </button>
              );
            })}
          </div>
        </section>
      </Shell>
    );

  const already = s.answered.includes(me.id);
  return (
    <Shell>
      {header}
      <section className="px-5 pb-36">
        <button onClick={() => setMe(null)} className="-ml-1 mb-2 flex h-10 items-center gap-1 rounded-lg px-1 text-[14px] font-semibold text-ink-muted active:bg-white/5">
          <ChevronLeft size={18} /> Non sei {shortSurname(me, s.roster)}? Cambia
        </button>
        <div className="mb-3 flex items-center gap-3">
          <Avatar r={me} size={56} />
          <div className="min-w-0">
            <div className="truncate text-[18px] font-bold leading-tight">{surnameFirst(me.name)}</div>
            <div className="text-[13px] text-ink-muted">
              {me.number && <b className="text-brand-text">#{me.number}</b>}
              {me.number && already && ' · '}
              {already && 'hai già risposto, puoi cambiare il valore'}
            </div>
          </div>
        </div>
        <h1 className="mb-4 font-display text-[30px] font-bold leading-tight">{/partita/i.test(s.session_label) ? 'Quanto è stata faticosa la partita?' : "Quanto è stato faticoso l'allenamento?"}</h1>
        <div className="grid gap-2">
          {[...RPE_SCALE].reverse().map((x) => {
            const on = rpe === x.value;
            return (
              <button
                key={x.value}
                onClick={() => (vibrate(8), setRpe(x.value))}
                className={cx('flex min-h-[54px] items-center gap-3 rounded-2xl border px-3 text-left transition active:scale-[.98]', on ? 'border-[var(--c-select)] bg-[color-mix(in_srgb,var(--c-select)_18%,transparent)]' : 'border-line bg-surface')}
                aria-pressed={on}
              >
                <span className="w-12 text-center font-display text-[30px] font-extrabold tabular" style={{ color: rpeColor(x.value) }}>
                  {fmtRpe(x.value)}
                </span>
                <span className="flex-1">
                  <span className="block text-[16px] font-semibold leading-tight">{x.label}</span>
                  {x.note && <span className="text-[13px] text-ink-muted">{x.note}</span>}
                </span>
                {on && <Check size={22} className="text-[var(--c-select-text)]" />}
              </button>
            );
          })}
        </div>
      </section>
      <div className="fixed inset-x-0 bottom-0 border-t border-line bg-bar/95 px-5 pb-[max(16px,env(safe-area-inset-bottom))] pt-3 backdrop-blur">
        {error && <p className="mb-2 text-center text-[14px] font-semibold text-danger">{error}</p>}
        <button
          disabled={rpe == null || sending}
          onClick={() => void send()}
          className="h-14 w-full rounded-2xl bg-[var(--c-select)] font-display text-[22px] font-bold tracking-wide text-[var(--c-on-select)] transition active:scale-[.98] disabled:opacity-40"
        >
          {sending ? 'Invio…' : rpe == null ? 'Scegli un valore' : `Invia RPE ${fmtRpe(rpe)}`}
        </button>
      </div>
    </Shell>
  );
}

/** Cerchio dell'atleta: foto se c'è, altrimenti numero di maglia o iniziali. */
function Avatar({ r, size, className }: { r: RosterItem; size: number; className?: string }) {
  const initials = r.name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join('');
  return (
    <span
      className={cx('grid shrink-0 place-items-center overflow-hidden rounded-full bg-brand font-display font-bold text-on-brand', className)}
      style={{ width: size, height: size, fontSize: size * 0.42 }}
    >
      {r.photo ? <img src={r.photo} alt="" className="h-full w-full object-cover" draggable={false} /> : r.number || initials}
    </span>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-lg flex-col bg-night text-ink">
      <div className="flex-1">{children}</div>
      <footer className="px-5 pb-[max(20px,env(safe-area-inset-bottom))] pt-6 text-center text-[11px] font-semibold uppercase tracking-[0.2em] text-ink-faint">
        {APP.name} · {APP.credit}
      </footer>
    </main>
  );
}

function Message({ icon, title, text, children }: { icon: React.ReactNode; title: string; text: string; children?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center px-8 pt-16 text-center">
      <span className="grid h-16 w-16 place-items-center rounded-full bg-white/10 text-ink-muted">{icon}</span>
      <h1 className="mt-5 font-display text-[28px] font-bold">{title}</h1>
      <p className="mt-2 text-[15px] leading-relaxed text-ink-muted">{text}</p>
      {children}
    </div>
  );
}
