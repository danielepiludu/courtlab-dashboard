import { useRef, useState } from 'react';
import { Database, Download, Sparkles, Trash, Upload } from 'lucide-react';
import { Sheet } from './ui/Sheet';
import { Logo } from './ui/misc';
import { exportBackup, importBackup, loadDemoData, wipeAll } from '@/db/repo';
import { confirmDialog, toast } from '@/store/feedback';
import { useUI } from '@/store/ui';
import { APP } from '@/config';
import { todayISO } from '@/lib/dates';
import { haptic } from '@/lib/haptics';

function Row({ icon, title, text, onClick, danger }: { icon: React.ReactNode; title: string; text: string; onClick: () => void; danger?: boolean }) {
  return (
    <button onClick={onClick} className="pressable flex w-full items-center gap-4 rounded-2xl border border-line bg-night/40 p-4 text-left">
      <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ${danger ? 'bg-danger/15 text-danger' : 'bg-navy text-accent-light'}`}>{icon}</span>
      <span className="min-w-0 flex-1">
        <b className={`block text-[16px] ${danger ? 'text-danger' : ''}`}>{title}</b>
        <span className="text-[13px] text-ink-muted">{text}</span>
      </span>
    </button>
  );
}

/** Impostazioni: backup/ripristino dei dati locali, dati di esempio, reset. */
export function SettingsSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const resetSetup = useUI((s) => s.resetSetup);

  const doExport = async () => {
    const blob = await exportBackup();
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `donbosco-monitor-backup-${todayISO()}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    toast('Backup esportato', 'success');
  };

  const doImport = async (f: File) => {
    const ok = await confirmDialog({
      title: 'Ripristinare il backup?',
      message: 'Tutti i dati attuali (giocatori, partite, resoconti) verranno sostituiti da quelli del file.',
      confirmLabel: 'Ripristina',
      danger: true,
    });
    if (!ok) return;
    setBusy(true);
    try {
      const r = await importBackup(f);
      resetSetup();
      toast(`Ripristinati ${r.players} giocatori e ${r.games} partite`, 'success');
      onClose();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Importazione non riuscita', 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet open={open} onClose={onClose} title="Impostazioni" subtitle="Dati salvati solo su questo dispositivo">
      <div className="mb-5 flex items-center gap-4 rounded-2xl bg-navy p-4">
        <Logo size={56} />
        <div>
          <b className="font-display text-xl tracking-wide">{APP.name}</b>
          <div className="text-[13px] text-ink-muted">
            {APP.club} · v{APP.version}
          </div>
        </div>
      </div>
      <div className="space-y-2.5">
        <Row icon={<Download size={20} />} title="Esporta backup" text="Salva tutti i dati in un file .json" onClick={doExport} />
        <Row icon={<Upload size={20} />} title="Ripristina backup" text="Carica un file .json esportato in precedenza" onClick={() => fileRef.current?.click()} />
        <Row
          icon={<Sparkles size={20} />}
          title="Carica dati di esempio"
          text="12 giocatori e alcune partite per provare l'app"
          onClick={async () => {
            if (busy) return;
            setBusy(true);
            await loadDemoData();
            haptic.confirm();
            toast('Dati di esempio caricati', 'success');
            setBusy(false);
            onClose();
          }}
        />
        <Row
          danger
          icon={<Trash size={20} />}
          title="Elimina tutti i dati"
          text="Giocatori, partite e resoconti"
          onClick={async () => {
            const ok = await confirmDialog({
              title: 'Eliminare tutti i dati?',
              message: "Operazione irreversibile. Consigliato esportare prima un backup.",
              confirmLabel: 'Elimina tutto',
              danger: true,
            });
            if (!ok) return;
            await wipeAll();
            resetSetup();
            haptic.heavy();
            toast('Dati eliminati');
            onClose();
          }}
        />
      </div>
      <p className="mt-5 flex items-start gap-2 text-[13px] leading-relaxed text-ink-muted">
        <Database size={16} className="mt-0.5 shrink-0" />
        L'app funziona offline: i dati restano nel browser di questo dispositivo. Esporta un backup periodicamente.
      </p>
      <input
        ref={fileRef}
        type="file"
        accept="application/json,.json"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = '';
          if (f) void doImport(f);
        }}
      />
    </Sheet>
  );
}
