import { useState } from 'react';
import { BellRing, Copy, Link2, Lock, LockOpen, RefreshCw, Share2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { CloudSheet } from '@/cloud/CloudSheet';
import { CloudError, useCloud } from '@/cloud/client';
import { cloudConfigured } from '@/cloud/config';
import { publishSurvey, pullResponses, setSurveyOpen, surveyUrl } from '@/cloud/surveys';
import { useActiveTeam } from '@/db/hooks';
import { shortSurname, type Player, type TrainingSession } from '@/db/types';
import { db } from '@/db/db';
import { haptic } from '@/lib/haptics';
import { cx } from '@/lib/cx';
import { toast } from '@/store/feedback';

const errMsg = (e: unknown) => (e instanceof CloudError ? e.message : 'Operazione non riuscita');

/** Link per gli atleti: crea, condividi, aggiorna le risposte, apri/chiudi la raccolta. */
export function SurveyPanel({ session, players, missing = 0 }: { session: TrainingSession; players: Player[]; /** atleti senza risposta */ missing?: number }) {
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

  // messaggi brevi: il link dice già tutto il resto
  const message = () => '🏀 RPE, rispondi qui:';

  const share = async (link = url) => {
    if (navigator.share) {
      try {
        await navigator.share({ title: 'RPE allenamento', text: message(), url: link });
        return;
      } catch (e) {
        if ((e as DOMException)?.name === 'AbortError') return;
      }
    }
    await copy(link, true);
  };

  /** Copia solo il link, oppure messaggio + link pronti da incollare. */
  const copy = async (link = url, withText = false) => {
    const text = withText ? `${message()}\n${link}` : link;
    try {
      await navigator.clipboard.writeText(text);
      toast(withText ? 'Messaggio con link copiato' : 'Link copiato', 'success');
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

  /** Promemoria: messaggio con i cognomi di chi non ha ancora risposto e il link. */
  const remind = () =>
    run(async () => {
      // prima scarica le ultime risposte, così l'elenco è aggiornato
      await pullResponses([session]).catch(() => 0);
      const done = new Set((await db.rpe.where('sessionId').equals(session.id!).toArray()).filter((e) => e.rpe != null).map((e) => e.playerId));
      const left = players.filter((p) => !done.has(p.id!));
      if (!left.length) {
        toast('Hanno già risposto tutti', 'success');
        return;
      }
      const names = left.map((p) => shortSurname(p, players)).join(', ');
      const text = `⏰ RPE, ${left.length === 1 ? 'manca' : 'mancano'}: ${names}`;
      haptic.select();
      if (navigator.share) {
        try {
          await navigator.share({ title: 'Promemoria RPE', text, url });
          return;
        } catch (e) {
          if ((e as DOMException)?.name === 'AbortError') return;
        }
      }
      try {
        await navigator.clipboard.writeText(`${text}\n${url}`);
        toast('Promemoria copiato: incollalo nel gruppo', 'success', 3000);
      } catch {
        window.prompt('Copia il promemoria', `${text}\n${url}`);
      }
    });

  const toggle = () =>
    run(async () => {
      const open = session.surveyOpen === false;
      if (!open) await pullResponses([session]);
      await setSurveyOpen(session, open);
      haptic.select();
      toast(open ? 'Raccolta riaperta' : 'Raccolta chiusa: gli atleti non possono più rispondere');
    });

  const small = 'flex h-9 items-center gap-1.5 rounded-full px-3 text-[13px] font-semibold text-ink-muted active:scale-95 disabled:opacity-40';
  return (
    <div className="mb-4 rounded-2xl bg-surface p-3">
      {!cloudConfigured() || !logged ? (
        <div className="flex items-center gap-3">
          <Link2 size={18} className="shrink-0 text-ink-muted" />
          <span className="flex-1 text-[14px] text-ink-muted">Link RPE per gli atleti</span>
          <Button size="sm" onClick={() => setLogin(true)}>
            {cloudConfigured() ? 'Accedi' : 'Attiva'}
          </Button>
        </div>
      ) : !token ? (
        <Button variant="primary" className="w-full" disabled={busy} icon={<Share2 size={18} />} onClick={create}>
          {busy ? 'Creazione…' : 'Crea link per gli atleti'}
        </Button>
      ) : (
        <>
          <div className="flex items-center gap-3">
            <span className={cx('h-2.5 w-2.5 shrink-0 rounded-full', session.surveyOpen === false ? 'bg-ink-faint' : 'bg-ok')} />
            <span className="min-w-0 flex-1 text-[14px]">
              <b>Link per gli atleti</b>
              <span className="text-ink-muted"> · {session.surveyOpen === false ? 'chiuso' : 'aperto'}</span>
            </span>
            <Button variant="primary" size="sm" icon={<Share2 size={16} />} onClick={() => void share()}>
              Condividi
            </Button>
          </div>
          <div className="-mb-1 mt-1 flex flex-wrap gap-0.5 pl-4">
            {session.surveyOpen !== false && missing > 0 && (
              <button className={small.replace('text-ink-muted', 'text-accent-light')} disabled={busy} onClick={remind}>
                <BellRing size={14} /> Sollecita ({missing})
              </button>
            )}
            <button className={small} onClick={() => void copy()}>
              <Copy size={14} /> Copia
            </button>
            <button className={small} disabled={busy} onClick={refresh}>
              <RefreshCw size={14} className={busy ? 'animate-spin' : ''} /> Aggiorna
            </button>
            <button className={small} disabled={busy} onClick={toggle}>
              {session.surveyOpen === false ? <LockOpen size={14} /> : <Lock size={14} />} {session.surveyOpen === false ? 'Riapri' : 'Chiudi'}
            </button>
          </div>
        </>
      )}
      <CloudSheet open={login} onClose={() => setLogin(false)} />
    </div>
  );
}
