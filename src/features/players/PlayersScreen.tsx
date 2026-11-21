import { useState } from 'react';
import { Plus, UserRound, Users } from 'lucide-react';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Avatar } from '@/components/ui/Avatar';
import { RoleBadge, STATUS_META, StatusBadge } from '@/components/ui/Badges';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { EmptyState } from '@/components/ui/misc';
import { useActiveTeam, usePlayers } from '@/db/hooks';
import { newPlayer } from '@/db/repo';
import { ROLES, STATUSES, type Player, type PlayerStatus, type Role } from '@/db/types';
import { fmtDayMonth } from '@/lib/dates';
import { haptic } from '@/lib/haptics';
import { PlayerFormSheet } from './PlayerFormSheet';

function PlayerRow({ p, onClick }: { p: Player; onClick: () => void }) {
  return (
    <button onClick={onClick} className="card pressable flex w-full items-center gap-3.5 p-3 text-left">
      <Avatar player={p} size={60} ring />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="font-display text-xl font-bold leading-none text-brand-text">{p.number !== '' ? `#${p.number}` : '—'}</span>
          <b className="truncate text-[17px]">{p.name}</b>
        </div>
        <div className="mt-1.5 flex items-center gap-2">
          <RoleBadge role={p.role} />
          {p.status !== 'available' ? (
            <StatusBadge status={p.status} />
          ) : (
            p.traits.length > 0 && <span className="truncate text-[13px] text-ink-muted">{p.traits.slice(0, 2).join(' · ')}</span>
          )}
        </div>
        {p.status !== 'available' && (p.statusDetails || p.statusDate) && (
          <div className="mt-1 truncate text-[12.5px] text-ink-muted">
            dal {fmtDayMonth(p.statusDate)}
            {p.statusDetails && ` · ${p.statusDetails}`}
          </div>
        )}
      </div>
    </button>
  );
}

export function PlayersScreen() {
  const players = usePlayers();
  const team = useActiveTeam();
  const readOnly = !!team?.archived;
  const teamId = team?.id ?? 0;
  const [role, setRole] = useState<Role | null>(null);
  const [status, setStatus] = useState<PlayerStatus | null>(null);
  const [editing, setEditing] = useState<Player | null>(null);
  const all = players ?? [];
  const list = all.filter((p) => (!role || p.role === role) && (!status || p.status === status));
  const count = (s: PlayerStatus) => all.filter((p) => p.status === s).length;

  return (
    <>
      <ScreenHeader
        title="Giocatori"
        subtitle={all.length ? `${all.length} in rosa · ${count('available')} disponibili` : team?.name}
        right={
          !readOnly && (
            <Button variant="primary" size="sm" icon={<Plus size={18} />} onClick={() => setEditing(newPlayer(teamId))}>
              Aggiungi
            </Button>
          )
        }
      />
      <div className="mx-auto max-w-2xl pt-3">
        {all.length > 0 && (
          <div className="space-y-2">
            <div className="no-scrollbar flex gap-2 overflow-x-auto px-4">
              <Chip active={!role} onClick={() => setRole(null)}>
                Tutti i ruoli
              </Chip>
              {ROLES.map((r) => (
                <Chip key={r} active={role === r} onClick={() => setRole(role === r ? null : r)} className="min-w-[56px] justify-center font-display text-[15px]">
                  {r}
                </Chip>
              ))}
            </div>
            <div className="no-scrollbar flex gap-2 overflow-x-auto px-4">
              <Chip active={!status} onClick={() => setStatus(null)}>
                Ogni stato
              </Chip>
              {STATUSES.map((s) => (
                <Chip key={s} active={status === s} onClick={() => setStatus(status === s ? null : s)}>
                  <i className={`h-2 w-2 rounded-full ${STATUS_META[s].dot}`} />
                  {STATUS_META[s].short}
                  <span className="ml-0.5 rounded-full bg-white/10 px-1.5 text-xs">{count(s)}</span>
                </Chip>
              ))}
            </div>
          </div>
        )}
        <div className="px-4 pt-4">
          {players === undefined ? null : all.length === 0 ? (
            <EmptyState
              icon={<Users size={30} />}
              title="Nessun giocatore"
              text="Aggiungi i giocatori della squadra con foto, numero e ruolo."
              action={
                !readOnly && (
                  <Button variant="primary" icon={<Plus size={20} />} onClick={() => setEditing(newPlayer(teamId))}>
                    Aggiungi giocatore
                  </Button>
                )
              }
            />
          ) : list.length === 0 ? (
            <EmptyState icon={<UserRound size={30} />} title="Nessun risultato" text="Nessun giocatore corrisponde ai filtri selezionati." />
          ) : (
            <div key={`${role}-${status}`} className="stagger space-y-2">
              {list.map((p) => (
                <PlayerRow
                  key={p.id}
                  p={p}
                  onClick={() => {
                    haptic.tap();
                    setEditing(p);
                  }}
                />
              ))}
            </div>
          )}
          <div className="h-6" />
        </div>
      </div>
      <PlayerFormSheet player={editing} readOnly={readOnly} onClose={() => setEditing(null)} />
    </>
  );
}

