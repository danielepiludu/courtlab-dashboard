import { useState } from 'react';
import { Check, ChevronDown, Plus, Settings2 } from 'lucide-react';
import { Sheet } from '@/components/ui/Sheet';
import { Button } from '@/components/ui/Button';
import { TeamLogo } from '@/components/TeamLogo';
import { useActiveTeamId, useTeamCounts, useTeams } from '@/db/hooks';
import { newTeam } from '@/db/repo';
import type { Team } from '@/db/types';
import { haptic } from '@/lib/haptics';
import { cx } from '@/lib/cx';
import { toast } from '@/store/feedback';
import { useUI } from '@/store/ui';
import { TeamFormSheet } from './TeamFormSheet';

function Row({ team, active, players, onClick }: { team: Team; active: boolean; players: number; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={cx('pressable flex min-h-[64px] w-full items-center gap-3 rounded-2xl border px-3 py-2 text-left transition-shadow', active ? 'border-accent bg-accent/10 shadow-glow' : 'border-transparent hover:bg-white/5')}
    >
      <TeamLogo team={team} size={46} />
      <div className="min-w-0 flex-1">
        <b className="block truncate text-[16px] leading-tight">{team.name}</b>
        <span className="text-[13px] text-ink-muted">
          {team.season} · {players} giocator{players === 1 ? 'e' : 'i'}
        </span>
      </div>
      {active && (
        <span className="anim-pop grid h-7 w-7 place-items-center rounded-full bg-accent text-on-accent">
          <Check size={16} strokeWidth={3} />
        </span>
      )}
    </button>
  );
}

/** Selettore della squadra attiva (bottom sheet aperto dall'header della Home). */
export function TeamSwitcherSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const teams = useTeams() ?? [];
  const counts = useTeamCounts();
  const activeId = useActiveTeamId();
  const setActiveTeam = useUI((s) => s.setActiveTeam);
  const setTeamsOpen = useUI((s) => s.setTeamsOpen);
  const [showArchived, setShowArchived] = useState(false);
  const [creating, setCreating] = useState<Team | null>(null);
  const active = teams.filter((t) => !t.archived);
  const archived = teams.filter((t) => t.archived);

  const pick = (t: Team) => {
    if (t.id !== activeId) {
      haptic.select();
      setActiveTeam(t.id!);
      toast(t.archived ? `${t.name}: sola lettura` : `Squadra attiva: ${t.name}`, 'success');
    }
    onClose();
  };

  return (
    <>
      <Sheet
        open={open}
        onClose={onClose}
        title="Squadre"
        subtitle="Scegli la squadra attiva"
        footer={
          <div className="flex gap-3">
            <Button size="lg" className="flex-1" icon={<Settings2 size={20} />} onClick={() => (onClose(), setTeamsOpen(true))}>
              Gestisci squadre
            </Button>
            <Button variant="primary" size="lg" className="px-4" aria-label="Nuova squadra" icon={<Plus size={22} />} onClick={() => setCreating(newTeam())} />
          </div>
        }
      >
        <div className="space-y-1.5">
          {active.map((t) => (
            <Row key={t.id} team={t} active={t.id === activeId} players={counts[t.id!]?.players ?? 0} onClick={() => pick(t)} />
          ))}
        </div>
        {archived.length > 0 && (
          <div className="mt-4">
            <button onClick={() => setShowArchived((v) => !v)} className="flex h-11 w-full items-center gap-2 px-1 text-[13px] font-bold uppercase tracking-[0.14em] text-ink-muted">
              <span className="flex-1 text-left">Stagioni archiviate · {archived.length}</span>
              <ChevronDown size={18} className={cx('transition-transform', showArchived && 'rotate-180')} />
            </button>
            {showArchived && (
              <div className="anim-rise space-y-1.5">
                {archived.map((t) => (
                  <Row key={t.id} team={t} active={t.id === activeId} players={counts[t.id!]?.players ?? 0} onClick={() => pick(t)} />
                ))}
              </div>
            )}
          </div>
        )}
      </Sheet>
      <TeamFormSheet
        team={creating}
        onClose={() => setCreating(null)}
        onSaved={(id) => {
          setActiveTeam(id);
          toast('Squadra creata e attivata', 'success');
          onClose();
        }}
      />
    </>
  );
}
