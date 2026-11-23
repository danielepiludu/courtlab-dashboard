import { useRef, useState } from 'react';
import { Cloud, Database, Download, Settings2, Sparkles, Trash, Upload } from 'lucide-react';
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

function Row({ icon, title, text, onClick, danger }: { icon: React.ReactNode; title: string; text: string; onClick: () => void; danger?: boolean }) {
  return (
    <button onClick={onClick} className="pressable flex w-full items-center gap-4 rounded-2xl border border-line bg-night/40 p-4 text-left">
      <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ${danger ? 'bg-danger/15 text-danger' : 'bg-bar text-accent-light'}`}>{icon}</span>
      <span className="min-w-0 flex-1">
        <b className={`block text-[16px] ${danger ? 'text-danger' : ''}`}>{title}</b>
        <span className="text-[13px] text-ink-muted">{text}</span>
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
      <div className="mb-5 flex items-center gap-4 rounded-2xl bg-bar p-4">
        <img src={`${import.meta.env.BASE_URL}icons/app-logo.png`} alt={APP.name} width={56} height={56} className="h-14 w-14 shrink-0" draggable={false} />
        <div className="min-w-0">
          <b className="font-display text-xl tracking-wide">{APP.name}</b>
          <div className="truncate text-[13px] text-ink-muted">
            v{APP.version} · {APP.credit}
          </div>
        </div>
      </div>
      <div className="space-y-2.5">
        <Row icon={<Settings2 size={20} />} title="Gestisci squadre" text="Crea, modifica, archivia o duplica per nuova stagione" onClick={() => (onClose(), setTeamsOpen(true))} />
        <Row icon={<Cloud size={20} />} title="Courtlab Cloud" text={cloudUser ? `${cloudUser} · ${syncLabel.text}` : 'Accedi per avere i dati su più dispositivi e il link RPE per gli atleti'} onClick={() => setCloud(true)} />
        <Row icon={<Download size={20} />} title="Esporta backup" text="Tutte le squadre, giocatori, partite, resoconti e immagini in un file .json" onClick={doExport} />
        <Row icon={<Upload size={20} />} title="Importa backup" text="Ripristina da un file .json (es. dopo il cambio di telefono)" onClick={() => fileRef.current?.click()} />
        <Row
          icon={<Sparkles size={20} />}
          title="Crea squadra di esempio"
          text="Nuova squadra con 12 giocatori e alcune partite per provare l'app"
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
        <Row
          danger
          icon={<Trash size={20} />}
          title="Elimina tutti i dati"
          text="Tutte le squadre, giocatori, partite e resoconti"
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
      <p className="mt-5 flex items-start gap-2 text-[13px] leading-relaxed text-ink-muted">
        <Database size={16} className="mt-0.5 shrink-0" />
        {cloudUser
          ? "L'app funziona offline: i dati sono salvati su questo dispositivo e sincronizzati con Courtlab Cloud appena c'è connessione."
          : "L'app funziona offline: i dati restano nel browser di questo dispositivo. Esporta un backup periodicamente e prima di cambiare telefono, oppure attiva Courtlab Cloud."}
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
