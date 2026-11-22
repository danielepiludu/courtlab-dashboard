import { useState } from 'react';
import { Copy, Link2, Lock, LockOpen, RefreshCw, Share2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { CloudSheet } from '@/cloud/CloudSheet';
import { CloudError, useCloud } from '@/cloud/client';
import { cloudConfigured } from '@/cloud/config';
import { publishSurvey, pullResponses, setSurveyOpen, surveyUrl } from '@/cloud/surveys';
import { useActiveTeam } from '@/db/hooks';
import { SESSION_TYPE_LABEL, type Player, type TrainingSession } from '@/db/types';
import { fmtLong } from '@/lib/dates';
import { haptic } from '@/lib/haptics';
import { cx } from '@/lib/cx';
import { toast } from '@/store/feedback';

const errMsg = (e: unknown) => (e instanceof CloudError ? e.message : 'Operazione non riuscita');

/** Link per gli atleti: crea, condividi, aggiorna le risposte, apri/chiudi la raccolta. */
export function SurveyPanel({ session, players }: { session: TrainingSession; players: Player[] }) {
  const team = useActiveTeam();
  const logged = useCloud((s) => !!s.session);
  const [busy, setBusy] = useState(false);
  const [login, setLogin] = useState(false);
  const token = session.surveyToken;
  const url = token ? surveyUrl(token) : '';

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      toast(errMsg(e), 'error', 4000);
    } finally {
      setBusy(false);
    }
  };

  const create = () =>
    run(async () => {
      if (!team) return;
      const t = await publishSurvey(session, team, players);
      haptic.confirm();
      await share(surveyUrl(t));
    });

  const share = async (link = url) => {
    const text = `${team?.name ?? ''} · RPE ${SESSION_TYPE_LABEL[session.type].toLowerCase()} di ${fmtLong(session.date).toLowerCase()}. Scegli il tuo nome e indica quanto è stato faticoso:`;
    if (navigator.share) {
      try {
        await navigator.share({ title: 'RPE allenamento', text, url: link });
        return;
      } catch (e) {
        if ((e as DOMException)?.name === 'AbortError') return;
      }
    }
    await copy(link);
  };

  const copy = async (link = url) => {
    try {
      await navigator.clipboard.writeText(link);
      toast('Link copiato', 'success');
    } catch {
      window.prompt('Copia il link', link);
    }
  };

  const refresh = () =>
    run(async () => {
      if (!team) return;
      await publishSurvey(session, team, players, session.surveyOpen !== false);
      const n = await pullResponses([session]);
      toast(n ? `${n} risposte nuove` : 'Nessuna risposta nuova', n ? 'success' : 'info');
    });

  const toggle = () =>
    run(async () => {
      const open = session.surveyOpen === false;
      if (!open) await pullResponses([session]);
      await setSurveyOpen(session, open);
      haptic.select();
      toast(open ? 'Raccolta riaperta' : 'Raccolta chiusa: gli atleti non possono più rispondere');
    });

  return (
    <div className="mb-4 rounded-2xl border border-line bg-night/40 p-3">
      <div className="mb-2 flex items-center gap-2">
        <Link2 size={18} className="text-accent-light" />
        <b className="flex-1 text-[15px]">Link per gli atleti</b>
        {token && (
          <span className={cx('rounded-full px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide', session.surveyOpen === false ? 'bg-white/10 text-ink-muted' : 'bg-ok/15 text-ok')}>
            {session.surveyOpen === false ? 'Chiusa' : 'Aperta'}
          </span>
        )}
      </div>
      {!cloudConfigured() || !logged ? (
        <>
          <p className="mb-3 text-[13px] leading-relaxed text-ink-muted">Gli atleti aprono il link dal telefono, scelgono il loro nome e l'RPE: senza installare nulla. Serve l'accesso a Courtlab Cloud.</p>
          <Button className="w-full" onClick={() => setLogin(true)}>
            {cloudConfigured() ? 'Accedi a Courtlab Cloud' : 'Attiva Courtlab Cloud'}
          </Button>
        </>
      ) : !token ? (
        <>
          <p className="mb-3 text-[13px] leading-relaxed text-ink-muted">Crea il link e mandalo nel gruppo della squadra: le risposte compaiono qui sotto da sole.</p>
          <Button variant="primary" className="w-full" disabled={busy} icon={<Share2 size={18} />} onClick={create}>
            {busy ? 'Creazione…' : 'Crea link per gli atleti'}
          </Button>
        </>
      ) : (
        <>
          <div className="mb-3 truncate rounded-lg bg-black/25 px-3 py-2 font-mono text-[12px] text-ink-muted">{url}</div>
          <div className="grid grid-cols-2 gap-2">
            <Button variant="primary" icon={<Share2 size={18} />} onClick={() => void share()}>
              Condividi
            </Button>
            <Button icon={<Copy size={18} />} onClick={() => void copy()}>
              Copia
            </Button>
            <Button disabled={busy} icon={<RefreshCw size={18} className={busy ? 'animate-spin' : ''} />} onClick={refresh}>
              Aggiorna
            </Button>
            <Button disabled={busy} icon={session.surveyOpen === false ? <LockOpen size={18} /> : <Lock size={18} />} onClick={toggle}>
              {session.surveyOpen === false ? 'Riapri' : 'Chiudi'}
            </Button>
          </div>
        </>
      )}
      <CloudSheet open={login} onClose={() => setLogin(false)} />
    </div>
  );
}
