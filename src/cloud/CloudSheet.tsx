import { useState } from 'react';
import { Cloud, CloudOff, LogOut } from 'lucide-react';
import { Sheet } from '@/components/ui/Sheet';
import { Button } from '@/components/ui/Button';
import { Field } from '@/components/ui/misc';
import { haptic } from '@/lib/haptics';
import { toast } from '@/store/feedback';
import { CloudError, signIn, signOut, useCloud } from './client';
import { cloudConfigured } from './config';

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
    <Sheet open={open} onClose={onClose} elevated title="Courtlab Cloud" subtitle="Link RPE per gli atleti">
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
          <p className="mb-4 text-[13px] leading-relaxed text-ink-muted">
            Apri una seduta nella tab RPE e tocca <b className="text-ink">Crea link per gli atleti</b>. Le risposte arrivano da sole mentre la tab RPE è aperta.
          </p>
          <Button
            variant="danger"
            size="lg"
            className="w-full"
            icon={<LogOut size={20} />}
            onClick={async () => {
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
          <p className="mb-4 text-[14px] leading-relaxed text-ink-muted">Accedi con l'utente dello staff creato nel progetto Supabase. L'accesso resta salvato su questo dispositivo.</p>
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
