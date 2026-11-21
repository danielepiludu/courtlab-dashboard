import { useState } from 'react';
import { createPortal } from 'react-dom';
import { Archive, ArchiveRestore, ArrowLeft, Check, ChevronRight, Copy, Eye, Pencil, Plus, Trash } from 'lucide-react';
import { Sheet, useMountTransition } from '@/components/ui/Sheet';
import { Button } from '@/components/ui/Button';
import { SectionTitle } from '@/components/ui/misc';
import { TeamLogo } from '@/components/TeamLogo';
import { useActiveTeamId, useTeamCounts, useTeams } from '@/db/hooks';
import { deleteTeam, duplicateTeamForNewSeason, ensureTeam, newTeam, setTeamArchived } from '@/db/repo';
import type { Team } from '@/db/types';
import { useBackClose } from '@/lib/backNav';
import { haptic } from '@/lib/haptics';
import { cx } from '@/lib/cx';
import { confirmDialog, toast } from '@/store/feedback';
import { useUI } from '@/store/ui';
import { nextSeason } from '@/config';
import { TeamFormSheet } from './TeamFormSheet';

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

export function TeamCard({ team, active, players, onClick }: { team: Team; active: boolean; players: number; onClick: () => void }) {
  return (
    <button onClick={onClick} className={cx('card pressable flex w-full items-center gap-3.5 p-3 text-left', active && 'border-accent/70 shadow-glow', team.archived && 'opacity-80')}>
      <TeamLogo team={team} size={54} />
      <div className="min-w-0 flex-1">
        <b className="block truncate text-[17px] leading-tight">{team.name}</b>
        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-ink-muted">
          <span className="font-semibold text-ink">{team.season}</span>
          <span>· {plural(players, 'giocatore', 'giocatori')}</span>
          {active && <span className="rounded-full bg-accent/20 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider text-accent-light">In uso</span>}
          {team.archived && <span className="rounded-full bg-warn/15 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider text-warn">Archiviata</span>}
        </div>
      </div>
      <span className="flex gap-1">
        <i className="h-4 w-4 rounded-full border border-white/20" style={{ background: team.primary }} />
        <i className="h-4 w-4 rounded-full border border-white/20" style={{ background: team.secondary }} />
      </span>
      <ChevronRight size={20} className="text-ink-faint" />
    </button>
  );
}

function ActionRow({ icon, label, hint, onClick, danger }: { icon: React.ReactNode; label: string; hint?: string; onClick: () => void; danger?: boolean }) {
  return (
    <button onClick={onClick} className="pressable flex min-h-[56px] w-full items-center gap-3.5 rounded-2xl px-2 text-left hover:bg-white/5">
      <span className={cx('grid h-10 w-10 shrink-0 place-items-center rounded-xl', danger ? 'bg-danger/15 text-danger' : 'bg-surface-3 text-accent-light')}>{icon}</span>
      <span className="min-w-0 flex-1">
        <b className={cx('block text-[16px]', danger && 'text-danger')}>{label}</b>
        {hint && <span className="block text-[13px] text-ink-muted">{hint}</span>}
      </span>
    </button>
  );
}

/** Schermata Squadre (aperta dal selettore squadre; non è una tab). */
export function TeamsScreen() {
  const open = useUI((s) => s.teamsOpen);
  const setOpen = useUI((s) => s.setTeamsOpen);
  const setActiveTeam = useUI((s) => s.setActiveTeam);
  const resetSetup = useUI((s) => s.resetSetup);
  const activeId = useActiveTeamId();
  const teams = useTeams() ?? [];
  const counts = useTeamCounts();
  const [selected, setSelected] = useState<Team | null>(null);
  const [editing, setEditing] = useState<Team | null>(null);
  const { mounted, shown } = useMountTransition(open, 260);
  useBackClose(open, () => setOpen(false));

  const activeTeams = teams.filter((t) => !t.archived);
  const archived = teams.filter((t) => t.archived);

  const activate = (t: Team) => {
    haptic.select();
    setActiveTeam(t.id!);
    toast(t.archived ? `${t.name}: consultazione in sola lettura` : `Squadra attiva: ${t.name}`, 'success');
  };

  const run = async (fn: () => Promise<void>) => {
    setSelected(null);
    await fn();
  };

  const duplicate = (t: Team) =>
    run(async () => {
      const ok = await confirmDialog({
        title: `Nuova stagione ${nextSeason(t.season)}?`,
        message: `Verrà creata una copia di ${t.name} con lo stesso roster.\nPartite e resoconti non vengono copiati; infortuni e statistiche ripartono da zero.`,
        confirmLabel: 'Duplica',
      });
      if (!ok) return;
      const id = await duplicateTeamForNewSeason(t.id!);
      setActiveTeam(id);
      haptic.confirm();
      toast(`Creata la stagione ${nextSeason(t.season)}`, 'success');
    });

  const toggleArchive = (t: Team) =>
    run(async () => {
      if (!t.archived) {
        const ok = await confirmDialog({
          title: `Archiviare ${t.name}?`,
          message: 'Giocatori, calendario e resoconti restano consultabili in sola lettura. Potrai riattivarla in qualsiasi momento.',
          confirmLabel: 'Archivia',
        });
        if (!ok) return;
      }
      await setTeamArchived(t.id!, !t.archived);
      haptic.confirm();
      if (!t.archived && t.id === activeId) {
        const other = activeTeams.find((x) => x.id !== t.id);
        if (other) setActiveTeam(other.id!);
      }
      toast(t.archived ? 'Squadra riattivata' : 'Squadra archiviata', 'success');
    });

  const remove = (t: Team) =>
    run(async () => {
      if (teams.length <= 1) {
        haptic.warn();
        toast('Deve restare almeno una squadra', 'error');
        return;
      }
      const c = counts[t.id!] ?? { players: 0, games: 0, finished: 0 };
      const ok = await confirmDialog({
        title: `Eliminare ${t.name} (${t.season})?`,
        message: `Verranno eliminati definitivamente anche:\n• ${plural(c.players, 'giocatore', 'giocatori')}\n• ${plural(c.games, 'partita', 'partite')}\n• ${plural(c.finished, 'resoconto', 'resoconti')}\n\nL'operazione non si può annullare.`,
        confirmLabel: 'Elimina tutto',
        danger: true,
        requireText: 'ELIMINA',
      });
      if (!ok) return;
      await deleteTeam(t.id!);
      resetSetup(t.id!);
      if (t.id === activeId) setActiveTeam(await ensureTeam(null));
      haptic.heavy();
      toast('Squadra eliminata');
    });

  if (!mounted) return null;
  const sel = selected;
  return createPortal(
    <div
      className={cx(
        'fixed inset-0 z-50 flex flex-col bg-night transition duration-[260ms] ease-out',
        shown ? 'translate-x-0 opacity-100' : 'translate-x-8 opacity-0',
      )}
    >
      <header className="shrink-0 border-b border-white/5 bg-bar" style={{ paddingTop: 'var(--safe-top)' }}>
        <div className="mx-auto flex h-16 max-w-2xl items-center gap-2 px-2">
          <button onClick={() => setOpen(false)} aria-label="Indietro" className="grid h-11 w-11 place-items-center rounded-full active:scale-90">
            <ArrowLeft size={24} />
          </button>
          <h1 className="flex-1 font-display text-[26px] font-bold tracking-wide">Squadre</h1>
          <Button variant="primary" size="sm" icon={<Plus size={18} />} onClick={() => setEditing(newTeam())}>
            Nuova
          </Button>
        </div>
      </header>
      <div className="flex-1 overflow-y-auto overscroll-contain">
        <div className="mx-auto max-w-2xl px-4 pb-10" style={{ paddingBottom: 'calc(var(--safe-bottom) + 32px)' }}>
          <SectionTitle>Attive · {activeTeams.length}</SectionTitle>
          <div className="stagger space-y-2">
            {activeTeams.map((t) => (
              <TeamCard key={t.id} team={t} active={t.id === activeId} players={counts[t.id!]?.players ?? 0} onClick={() => (haptic.tap(), setSelected(t))} />
            ))}
            {!activeTeams.length && <div className="rounded-2xl border border-dashed border-line p-4 text-center text-sm text-ink-muted">Nessuna squadra attiva</div>}
          </div>
          {archived.length > 0 && (
            <>
              <SectionTitle>Archiviate · {archived.length}</SectionTitle>
              <div className="stagger space-y-2">
                {archived.map((t) => (
                  <TeamCard key={t.id} team={t} active={t.id === activeId} players={counts[t.id!]?.players ?? 0} onClick={() => (haptic.tap(), setSelected(t))} />
                ))}
              </div>
            </>
          )}
          <p className="mt-6 px-1 text-[13px] leading-relaxed text-ink-muted">
            Ogni squadra ha giocatori, calendario e resoconti separati. Per iniziare una nuova stagione usa <b className="text-ink">Duplica per nuova stagione</b>: il roster viene
            copiato e la stagione precedente può essere archiviata.
          </p>
        </div>
      </div>

      {/* Azioni sulla squadra */}
      <Sheet open={!!selected} onClose={() => setSelected(null)} elevated title={sel?.name ?? ''} subtitle={sel ? `Stagione ${sel.season}` : undefined}>
        {sel && (
          <div className="space-y-1 pb-2">
            {sel.id !== activeId && (
              <ActionRow
                icon={sel.archived ? <Eye size={20} /> : <Check size={20} />}
                label={sel.archived ? 'Consulta (sola lettura)' : 'Usa questa squadra'}
                onClick={() => run(async () => activate(sel))}
              />
            )}
            {!sel.archived && <ActionRow icon={<Pencil size={20} />} label="Modifica" hint="Nome, stagione, logo e colori" onClick={() => run(async () => setEditing(sel))} />}
            <ActionRow icon={<Copy size={20} />} label="Duplica per nuova stagione" hint={`Roster copiato in ${nextSeason(sel.season)}, senza partite`} onClick={() => duplicate(sel)} />
            <ActionRow
              icon={sel.archived ? <ArchiveRestore size={20} /> : <Archive size={20} />}
              label={sel.archived ? 'Riattiva' : 'Archivia'}
              hint={sel.archived ? 'Torna modificabile' : 'Resta consultabile in sola lettura'}
              onClick={() => toggleArchive(sel)}
            />
            <ActionRow icon={<Trash size={20} />} label="Elimina" hint="Elimina anche giocatori, partite e resoconti" danger onClick={() => remove(sel)} />
          </div>
        )}
      </Sheet>

      <TeamFormSheet
        team={editing}
        onClose={() => setEditing(null)}
        onSaved={(id, created) => {
          if (created) {
            setActiveTeam(id);
            toast('Squadra creata e attivata', 'success');
          } else toast('Squadra aggiornata', 'success');
        }}
      />
    </div>,
    document.body,
  );
}
