import { useRef, useState } from 'react';
import { Cloud, Download, Settings2, Sparkles, Trash, Upload } from 'lucide-react';
import { CloudSheet } from '@/cloud/CloudSheet';
import { useCloud } from '@/cloud/client';
import { useSyncLabel } from '@/cloud/CloudSheet';
import { Sheet } from './ui/Sheet';
import { exportBackup, importBackup, loadDemoTeam, wipeAll } from '@/db/repo';
import { confirmDialog, toast } from '@/store/feedback';
import { useUI } from '@/store/ui';
import { APP } from '@/config';
import { todayISO } from '@/lib/dates';
import { haptic } from '@/lib/haptics';

function Row({ icon, title, text, onClick, danger }: { icon: React.ReactNode; title: string; text?: string; onClick: () => void; danger?: boolean }) {
  return (
    <button onClick={onClick} className="flex min-h-[56px] w-full items-center gap-3.5 border-t border-white/[.05] px-4 py-2.5 text-left first:border-t-0 active:bg-white/[.04]">
      <span className={`shrink-0 ${danger ? 'text-danger' : 'text-ink-muted'}`}>{icon}</span>
      <span className="min-w-0 flex-1">
        <span className={`block text-[15px] font-semibold ${danger ? 'text-danger' : ''}`}>{title}</span>
        {text && <span className="block truncate text-[12.5px] text-ink-muted">{text}</span>}
      </span>
    </button>
  );
}

/** Impostazioni: squadre, backup/ripristino dei dati locali, dati di esempio, reset. */
export function SettingsSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [cloud, setCloud] = useState(false);
  const cloudUser = useCloud((x) => x.session?.user.email);
  const syncLabel = useSyncLabel();
  const activeTeamId = useUI((s) => s.activeTeamId);
  const setActiveTeam = useUI((s) => s.setActiveTeam);
  const setTeamsOpen = useUI((s) => s.setTeamsOpen);
  const resetSetup = useUI((s) => s.resetSetup);

  const doExport = async () => {
    const blob = await exportBackup(activeTeamId);
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `courtlab-backup-${todayISO()}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    toast('Backup esportato', 'success');
  };

  const doImport = async (f: File) => {
    const ok = await confirmDialog({
      title: 'Importare il backup?',
      message: 'Tutti i dati attuali (squadre, giocatori, partite, resoconti) verranno sostituiti da quelli del file.',
      confirmLabel: 'Importa',
      danger: true,
    });
    if (!ok) return;
    setBusy(true);
    try {
      const r = await importBackup(f);
      resetSetup();
      setActiveTeam(r.activeTeamId);
      toast(`Importate ${r.teams} squadre, ${r.players} giocatori e ${r.games} partite`, 'success', 3500);
      onClose();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Importazione non riuscita', 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet open={open} onClose={onClose} title="Impostazioni" subtitle={cloudUser ? 'Dati sincronizzati con Courtlab Cloud' : 'Dati salvati solo su questo dispositivo'}>
      <div className="overflow-hidden rounded-2xl bg-surface">
        <Row icon={<Settings2 size={20} />} title="Gestisci squadre" text="Crea, archivia o duplica per una nuova stagione" onClick={() => (onClose(), setTeamsOpen(true))} />
        <Row icon={<Cloud size={20} />} title="Courtlab Cloud" text={cloudUser ? syncLabel.text : 'Dati su più dispositivi e link RPE'} onClick={() => setCloud(true)} />
        <Row icon={<Download size={20} />} title="Esporta backup" text="Tutti i dati in un file .json" onClick={doExport} />
        <Row icon={<Upload size={20} />} title="Importa backup" text="Ripristina da un file .json" onClick={() => fileRef.current?.click()} />
        <Row
          icon={<Sparkles size={20} />}
          title="Crea squadra di esempio"
          text="Per provare l'app"
          onClick={async () => {
            if (busy) return;
            setBusy(true);
            const id = await loadDemoTeam();
            setActiveTeam(id);
            haptic.confirm();
            toast('Squadra di esempio creata e attivata', 'success');
            setBusy(false);
            onClose();
          }}
        />
      </div>
      <div className="mt-3 overflow-hidden rounded-2xl bg-surface">
        <Row
          danger
          icon={<Trash size={20} />}
          title="Elimina tutti i dati"
          
          onClick={async () => {
            const ok = await confirmDialog({
              title: 'Eliminare tutti i dati?',
              message: cloudUser
                ? 'Operazione irreversibile. Consigliato esportare prima un backup. Dopo ti verrà chiesto se eliminare i dati anche dal cloud e dagli altri dispositivi.'
                : 'Operazione irreversibile. Consigliato esportare prima un backup.',
              confirmLabel: 'Elimina tutto',
              danger: true,
              requireText: 'ELIMINA',
            });
            if (!ok) return;
            const id = await wipeAll();
            resetSetup();
            setActiveTeam(id);
            haptic.heavy();
            toast('Dati eliminati');
            onClose();
          }}
        />
      </div>
      <p className="mt-6 text-center text-[12px] text-ink-faint">
        {APP.name} v{APP.version} · {APP.credit}
      </p>
      <CloudSheet open={cloud} onClose={() => setCloud(false)} />
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
