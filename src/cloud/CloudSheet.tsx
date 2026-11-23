import { useState } from 'react';
import { Cloud, CloudOff, LogOut, RefreshCw } from 'lucide-react';
import { Sheet } from '@/components/ui/Sheet';
import { Button } from '@/components/ui/Button';
import { Field } from '@/components/ui/misc';
import { haptic } from '@/lib/haptics';
import { confirmDialog, toast } from '@/store/feedback';
import { CloudError, signIn, signOut, useCloud } from './client';
import { cloudConfigured } from './config';
import { retrySync, useSync } from './sync';
import { cx } from '@/lib/cx';

const hhmm = (t: number) => new Date(t).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });

/** Stato della sincronizzazione, in parole. */
export function useSyncLabel(): { text: string; tone: 'ok' | 'warn' | 'error' | 'muted' } {
  const { phase, lastSync, error } = useSync();
  if (phase === 'syncing') return { text: 'Sincronizzazione in corso…', tone: 'muted' };
  if (phase === 'offline') return { text: 'Offline: le modifiche partono appena torna la connessione', tone: 'warn' };
  if (phase === 'error') return { text: error ?? 'Errore di sincronizzazione', tone: 'error' };
  if (lastSync) return { text: `Sincronizzato alle ${hhmm(lastSync)}`, tone: 'ok' };
  return { text: 'In attesa di sincronizzare', tone: 'muted' };
}

/** Accesso dello staff a Courtlab Cloud (serve per i link RPE degli atleti). */
export function CloudSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const session = useCloud((s) => s.session);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  const login = async () => {
    if (!email.trim() || !password) return;
    setBusy(true);
    try {
      await signIn(email, password);
      setPassword('');
      haptic.confirm();
      toast('Accesso effettuato', 'success');
      onClose();
    } catch (e) {
      toast(e instanceof CloudError ? e.message : 'Accesso non riuscito', 'error', 4000);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet open={open} onClose={onClose} elevated title="Courtlab Cloud" subtitle="Dati su tutti i dispositivi e link RPE per gli atleti">
      {!cloudConfigured() ? (
        <div className="flex gap-3 rounded-2xl border border-line bg-night/40 p-4 text-[14px] leading-relaxed text-ink-muted">
          <CloudOff size={22} className="mt-0.5 shrink-0 text-warn" />
          <span>Il servizio online non è ancora collegato a questa versione dell'app. Va configurato una volta sola (progetto Supabase gratuito): poi qui potrai accedere.</span>
        </div>
      ) : session ? (
        <>
          <div className="mb-4 flex items-center gap-3 rounded-2xl border border-line bg-night/40 p-4">
            <span className="grid h-11 w-11 place-items-center rounded-xl bg-ok/15 text-ok">
              <Cloud size={22} />
            </span>
            <div className="min-w-0 flex-1">
              <b className="block text-[15px]">Collegato</b>
              <span className="block truncate text-[13px] text-ink-muted">{session.user.email}</span>
            </div>
          </div>
          <SyncStatus />
          <p className="mb-4 text-[13px] leading-relaxed text-ink-muted">
            Squadre, giocatori, partite, resoconti, sedute e RPE sono gli stessi su ogni dispositivo in cui accedi con questo utente. L'app funziona anche senza rete: le modifiche
            partono appena torna la connessione e, se lo stesso dato cambia su due dispositivi, vale la modifica più recente.
          </p>
          <Button
            variant="danger"
            size="lg"
            className="w-full"
            icon={<LogOut size={20} />}
            onClick={async () => {
              const ok = await confirmDialog({
                title: 'Uscire da Courtlab?',
                message: "Su questo dispositivo l'app si blocca finché non accedi di nuovo. I dati restano salvati e la sincronizzazione riprende al prossimo accesso.",
                confirmLabel: 'Esci',
                danger: true,
              });
              if (!ok) return;
              await signOut();
              toast('Disconnesso');
            }}
          >
            Esci
          </Button>
        </>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void login();
          }}
        >
          <p className="mb-4 text-[14px] leading-relaxed text-ink-muted">
            Accedi con l'utente dello staff creato nel progetto Supabase: i dati vengono sincronizzati con gli altri dispositivi e puoi mandare agli atleti il link RPE. L'accesso resta
            salvato su questo dispositivo.
          </p>
          <Field label="Email">
            <input className="input" type="email" autoComplete="username" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </Field>
          <Field label="Password">
            <input className="input" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </Field>
          <Button type="submit" variant="primary" size="lg" className="w-full" disabled={busy || !email.trim() || !password}>
            {busy ? 'Accesso…' : 'Accedi'}
          </Button>
        </form>
      )}
    </Sheet>
  );
}

function SyncStatus() {
  const { text, tone } = useSyncLabel();
  const syncing = useSync((x) => x.phase === 'syncing');
  return (
    <div className="mb-4 flex items-center gap-3 rounded-2xl border border-line bg-night/40 p-3">
      <span className={cx('h-2.5 w-2.5 shrink-0 rounded-full', tone === 'ok' ? 'bg-ok' : tone === 'warn' ? 'bg-warn' : tone === 'error' ? 'bg-danger' : 'bg-ink-faint', syncing && 'animate-pulse')} />
      <span className={cx('min-w-0 flex-1 text-[14px]', tone === 'error' ? 'text-danger' : 'text-ink')}>{text}</span>
      <Button size="sm" disabled={syncing} icon={<RefreshCw size={16} className={syncing ? 'animate-spin' : ''} />} onClick={retrySync}>
        Sincronizza
      </Button>
    </div>
  );
}
