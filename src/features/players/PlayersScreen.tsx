import { useState } from 'react';
import { Plus, UserRound, Users } from 'lucide-react';
import { HeaderAdd, ScreenHeader } from '@/components/ScreenHeader';
import { Avatar } from '@/components/ui/Avatar';
import { RoleBadge, STATUS_META, StatusBadge } from '@/components/ui/Badges';
import { Button } from '@/components/ui/Button';
import { Chip, Segmented } from '@/components/ui/Chip';
import { MeasuresView } from '@/features/anthro/MeasuresView';
import { newMeasureSession, saveMeasureSession } from '@/features/anthro/measuresRepo';
import { EmptyState } from '@/components/ui/misc';
import { useActiveTeam, useMeasureSessions, useMeasures, usePlayers } from '@/db/hooks';
import { newPlayer } from '@/db/repo';
import { ROLES, STATUSES, surnameFirst, type MeasureSession, type Player, type PlayerStatus, type Role } from '@/db/types';
import { fmtDayMonth } from '@/lib/dates';
import { haptic } from '@/lib/haptics';
import { PlayerFormSheet } from './PlayerFormSheet';

function PlayerRow({ p, onClick }: { p: Player; onClick: () => void }) {
  return (
    <button onClick={onClick} className="card pressable flex w-full items-center gap-3.5 px-3 py-2.5 text-left">
      <Avatar player={p} size={52} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="font-display text-xl font-bold leading-none text-brand-text">{p.number !== '' ? `#${p.number}` : '—'}</span>
          <b className="truncate text-[17px]">{surnameFirst(p.name)}</b>
        </div>
        <div className="mt-1.5 flex items-center gap-2">
          <RoleBadge role={p.role} />
          {p.status !== 'available' && <StatusBadge status={p.status} />}
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
  const [tab, setTab] = useState<'roster' | 'measures'>(() => {
    try {
      return localStorage.getItem('bm-players-tab') === 'measures' ? 'measures' : 'roster';
    } catch {
      return 'roster';
    }
  });
  const [openMeasure, setOpenMeasure] = useState<MeasureSession | null>(null);
  const msessions = useMeasureSessions();
  const measures = useMeasures();
  const switchTab = (t: 'roster' | 'measures') => {
    setTab(t);
    try {
      localStorage.setItem('bm-players-tab', t);
    } catch {
      /* ignora */
    }
  };
  const newMeasure = async () => {
    const s = newMeasureSession(teamId);
    const id = await saveMeasureSession(s);
    setOpenMeasure({ ...s, id });
  };
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
            <HeaderAdd label={tab === 'measures' ? 'Nuova rilevazione' : 'Aggiungi giocatore'} onClick={() => (tab === 'measures' ? void newMeasure() : setEditing(newPlayer(teamId)))} />
          )
        }
      />
      <div className="mx-auto max-w-2xl pt-3">
        <div className="px-4 pb-3">
          <Segmented
            value={tab}
            onChange={switchTab}
            options={[
              { value: 'roster', label: 'Rosa' },
              { value: 'measures', label: 'Misure' },
            ]}
          />
        </div>
        {tab === 'measures' ? (
          <div className="px-4">
            <MeasuresView teamId={teamId} players={all} sessions={msessions} measures={measures ?? []} readOnly={readOnly} open={openMeasure} onOpen={setOpenMeasure} />
            <div className="h-6" />
          </div>
        ) : (
        <>
        {all.length > 0 && (
          // un'unica riga di filtri: ruoli e, solo se servono, gli stati non disponibili
          <div className="no-scrollbar flex gap-2 overflow-x-auto px-4 chip-row">
            <Chip active={!role && !status} onClick={() => (setRole(null), setStatus(null))}>
              Tutti
            </Chip>
            {ROLES.map((r) => (
              <Chip key={r} active={role === r} onClick={() => setRole(role === r ? null : r)} className="min-w-[52px] justify-center">
                {r}
              </Chip>
            ))}
            {STATUSES.filter((st) => st !== 'available' && count(st) > 0).map((st) => (
              <Chip key={st} active={status === st} onClick={() => setStatus(status === st ? null : st)}>
                <i className={`h-2 w-2 rounded-full ${STATUS_META[st].dot}`} />
                {STATUS_META[st].short} {count(st)}
              </Chip>
            ))}
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
        </>
        )}
      </div>
      <PlayerFormSheet player={editing} readOnly={readOnly} onClose={() => setEditing(null)} />
    </>
  );
}

