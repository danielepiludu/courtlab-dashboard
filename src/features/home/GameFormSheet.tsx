import { useEffect, useMemo, useState } from 'react';
import { MapPin, Plane, Trash } from 'lucide-react';
import { Sheet } from '@/components/ui/Sheet';
import { Button } from '@/components/ui/Button';
import { Segmented } from '@/components/ui/Chip';
import { Field } from '@/components/ui/misc';
import { deleteGame, saveGame } from '@/db/repo';
import { useGames } from '@/db/hooks';
import { OUTCOME_LABEL, outcomeOf, type Game } from '@/db/types';
import { confirmDialog, toast } from '@/store/feedback';
import { haptic } from '@/lib/haptics';
import { useUI } from '@/store/ui';
import { fmtLong } from '@/lib/dates';

interface Props {
  game: Game | null;
  /** squadra archiviata: solo consultazione */
  readOnly?: boolean;
  onClose: () => void;
  onSaved?: (id: number) => void;
}

/** Crea / modifica / elimina una partita del calendario. */
export function GameFormSheet({ game, readOnly = false, onClose, onSaved }: Props) {
  const [draft, setDraft] = useState<Game | null>(game);
  const [busy, setBusy] = useState(false);
  const openReport = useUI((s) => s.openReport);
  const games = useGames();
  useEffect(() => {
    if (game) setDraft(game);
  }, [game]);
  const opponents = useMemo(() => [...new Set((games ?? []).map((g) => g.opponent).filter(Boolean))].sort(), [games]);

  const up = (p: Partial<Game>) => setDraft((d) => (d ? { ...d, ...p } : d));
  const finished = draft?.status === 'finished';
  const valid = !!draft && draft.opponent.trim().length > 0 && !!draft.date;

  const save = async () => {
    if (!draft || !valid) return;
    setBusy(true);
    try {
      const id = await saveGame(draft);
      haptic.confirm();
      toast(draft.id ? 'Partita aggiornata' : 'Partita aggiunta al calendario', 'success');
      onSaved?.(id);
      onClose();
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!draft?.id) return;
    const ok = await confirmDialog({
      title: 'Eliminare la partita?',
      message: finished
        ? `La partita contro ${draft.opponent} è conclusa: verrà eliminato anche il suo resoconto.`
        : `La partita contro ${draft.opponent || 'avversario'} verrà rimossa dal calendario.`,
      confirmLabel: 'Elimina',
      danger: true,
    });
    if (!ok) return;
    await deleteGame(draft.id);
    haptic.heavy();
    toast('Partita eliminata');
    onClose();
  };

  return (
    <Sheet
      open={!!game}
      onClose={onClose}
      title={readOnly ? 'Partita' : draft?.id ? 'Modifica partita' : 'Nuova partita'}
      subtitle={draft?.date ? fmtLong(draft.date) : undefined}
      footer={
        !readOnly && (
        <div className="flex gap-3">
          {draft?.id && draft.status !== 'live' && (
            <Button variant="danger" size="lg" className="px-4" onClick={remove} aria-label="Elimina partita" icon={<Trash size={20} />} />
          )}
          <Button variant="primary" size="lg" className="flex-1" disabled={!valid || busy} onClick={save}>
            {draft?.id ? 'Salva modifiche' : 'Aggiungi partita'}
          </Button>
        </div>
        )
      }
    >
      {draft && (
        <fieldset disabled={readOnly} className="min-w-0">
          {finished && (
            <button
              type="button"
              onClick={() => {
                onClose();
                openReport(draft.id!);
              }}
              className="pressable mb-4 flex w-full items-center justify-between rounded-2xl bg-surface p-4 text-left"
            >
              <div>
                <div className="label !mb-0.5">Risultato finale</div>
                <div className="text-sm font-semibold text-ink-muted">{OUTCOME_LABEL[outcomeOf(draft)]} · apri il resoconto</div>
              </div>
              <div className="font-display text-4xl font-extrabold tabular">
                {draft.scoreUs ?? 0}
                <span className="mx-1 text-ink-faint">–</span>
                {draft.scoreThem ?? 0}
              </div>
            </button>
          )}
          <Field label="Avversario">
            <input
              className="input"
              placeholder="es. Basket Pisa"
              value={draft.opponent}
              list="dbbm-opponents"
              autoCapitalize="words"
              onChange={(e) => up({ opponent: e.target.value })}
            />
            <datalist id="dbbm-opponents">
              {opponents.map((o) => (
                <option key={o} value={o} />
              ))}
            </datalist>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Data">
              <input type="date" className="input" value={draft.date} onChange={(e) => up({ date: e.target.value })} />
            </Field>
            <Field label="Ora">
              <input type="time" className="input" value={draft.time} onChange={(e) => up({ time: e.target.value })} />
            </Field>
          </div>
          <div className="mb-4">
            <span className="label">Campo</span>
            <Segmented
              value={draft.home ? 'home' : 'away'}
              onChange={(v) => up({ home: v === 'home' })}
              options={[
                { value: 'home', label: (<><MapPin size={16} /> Casa</>) },
                { value: 'away', label: (<><Plane size={16} /> Trasferta</>) },
              ]}
            />
          </div>
          <Field label="Note">
            <textarea
              className="input h-24 resize-none py-3"
              placeholder="Palestra, convocazione, appunti tattici…"
              value={draft.notes}
              onChange={(e) => up({ notes: e.target.value })}
            />
          </Field>
        </fieldset>
      )}
    </Sheet>
  );
}
