import { surnameFirst } from '@/db/types';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, Trash } from 'lucide-react';
import { Sheet } from '@/components/ui/Sheet';
import { Button } from '@/components/ui/Button';
import { Field } from '@/components/ui/misc';
import { Segmented } from '@/components/ui/Chip';
import type { Player, RpeEntry, TrainingSession } from '@/db/types';
import { SESSION_TYPES, SESSION_TYPE_LABEL } from '@/db/types';
import { deleteSession, saveSession, setRpe } from '@/db/rpeRepo';
import { RPE_SCALE, entryTL } from '@/engine/load';
import { intColor } from '@/lib/intColor';
import { fmtLong } from '@/lib/dates';
import { haptic } from '@/lib/haptics';
import { cx } from '@/lib/cx';
import { confirmDialog, toast } from '@/store/feedback';
import { useActiveTeam } from '@/db/hooks';
import { useCloud } from '@/cloud/client';
import { deleteSurvey, publishSurvey } from '@/cloud/surveys';
import { SurveyPanel } from './SurveyPanel';

export const rpeColor = (v: number | null | undefined) => (v == null ? undefined : intColor(v / 10));
const fmtRpe = (v: number) => String(v).replace('.', ',');

/** Scelta dell'RPE con la scala descrittiva (CR-10). */
function RpePicker({ player, entry, session, onPick, onClose }: { player: Player | null; entry?: RpeEntry; session: TrainingSession; onPick: (rpe: number | null, minutes: number | null) => void; onClose: () => void }) {
  const [minutes, setMinutes] = useState<string>('');
  useEffect(() => {
    if (player) setMinutes(entry?.minutes != null ? String(entry.minutes) : '');
  }, [player, entry]);
  const mins = minutes.trim() === '' ? null : Math.max(0, Number(minutes));
  return (
    <Sheet open={!!player} onClose={onClose} elevated title={player ? `#${player.number} ${surnameFirst(player.name)}` : ''} subtitle={session.type === 'partita' ? 'Quanto è stata faticosa la partita?' : "Quanto è stato faticoso l'allenamento?"}>
      <div className="grid gap-1.5">
        {[...RPE_SCALE].reverse().map((s) => {
          const on = entry?.rpe === s.value;
          return (
            <button
              key={s.value}
              onClick={() => {
                haptic.select();
                onPick(s.value, mins);
              }}
              className={cx('pressable flex min-h-[46px] items-center gap-3 rounded-xl border px-3 text-left', on ? 'border-accent bg-accent/15 shadow-glow' : 'border-line bg-night/40')}
            >
              <span className="w-10 text-center font-display text-[24px] font-extrabold tabular" style={{ color: rpeColor(s.value) }}>
                {fmtRpe(s.value)}
              </span>
              <span className="flex-1 text-[15px] font-semibold">{s.label}</span>
              {s.note && <span className="text-[12px] text-ink-muted">{s.note}</span>}
              {on && <Check size={18} className="text-accent-light" />}
            </button>
          );
        })}
      </div>
      <div className="mt-4 grid grid-cols-[1fr_auto] items-end gap-3">
        <Field label={`Minuti per questo atleta (seduta: ${session.minutes}′)`} className="!mb-0">
          <input className="input" inputMode="numeric" placeholder={`${session.minutes}`} value={minutes} onChange={(e) => setMinutes(e.target.value.replace(/\D/g, '').slice(0, 3))} />
        </Field>
        <Button variant="danger" className="h-12" onClick={() => onPick(null, null)}>
          Nessuna risposta
        </Button>
      </div>
    </Sheet>
  );
}

/** Seduta: data e durata (le inserisce lo staff) e RPE di ogni atleta. */
export function SessionSheet({ session, players, entries, readOnly, onClose }: { session: TrainingSession | null; players: Player[]; entries: RpeEntry[]; readOnly: boolean; onClose: () => void }) {
  const [draft, setDraft] = useState<TrainingSession | null>(session);
  const [picking, setPicking] = useState<Player | null>(null);
  const team = useActiveTeam();
  const logged = useCloud((x) => !!x.session);
  const dirty = useRef(false);
  useEffect(() => {
    if (session) setDraft(session);
  }, [session]);
  const mine = useMemo(() => new Map(entries.filter((e) => e.sessionId === session?.id).map((e) => [e.playerId, e])), [entries, session?.id]);
  if (!draft && !session) return null;
  const s = draft ?? session!;
  const answered = players.filter((p) => mine.get(p.id!)?.rpe != null);
  const tls = answered.map((p) => entryTL({ rpe: mine.get(p.id!)!.rpe, minutes: mine.get(p.id!)!.minutes ?? s.minutes }) ?? 0);
  const avgRpe = answered.length ? answered.reduce((a, p) => a + (mine.get(p.id!)!.rpe ?? 0), 0) / answered.length : null;
  const avgTl = tls.length ? tls.reduce((a, b) => a + b, 0) / tls.length : null;

  const update = async (p: Partial<TrainingSession>) => {
    const next = { ...s, ...p };
    setDraft(next);
    dirty.current = true;
    if (next.id && next.date && next.minutes > 0) await saveSession(next);
  };

  // chiudendo: se data o durata sono cambiate, aggiorna anche la pagina del link
  const close = () => {
    if (dirty.current && s.surveyToken && logged && team) publishSurvey(s, team, players, s.surveyOpen !== false).catch(() => toast('Link non aggiornato: riprova con Aggiorna', 'error'));
    dirty.current = false;
    onClose();
  };

  const pick = async (rpe: number | null, minutes: number | null) => {
    if (!picking) return;
    await setRpe(s, picking.id!, rpe, minutes);
    haptic.confirm();
    (document.activeElement as HTMLElement | null)?.blur();
    // passa al prossimo atleta senza risposta
    const idx = players.findIndex((p) => p.id === picking.id);
    const next = [...players.slice(idx + 1), ...players.slice(0, idx)].find((p) => mine.get(p.id!)?.rpe == null && p.id !== picking.id);
    setPicking(rpe != null && next ? next : null);
  };

  return (
    <>
      <Sheet
        open={!!session}
        onClose={close}
        wide
        title={`${SESSION_TYPE_LABEL[s.type]}`}
        subtitle={fmtLong(s.date)}
        footer={
          !readOnly && (
            <div className="flex gap-3">
              <Button
                variant="danger"
                size="lg"
                className="px-4"
                aria-label="Elimina seduta"
                icon={<Trash size={20} />}
                onClick={async () => {
                  const ok = await confirmDialog({ title: 'Eliminare la seduta?', message: `Verranno eliminati anche i ${answered.length} RPE inseriti.`, confirmLabel: 'Elimina', danger: true });
                  if (!ok) return;
                  if (s.surveyToken && logged) await deleteSurvey(s.surveyToken).catch(() => undefined);
                  await deleteSession(s.id!);
                  toast('Seduta eliminata');
                  onClose();
                }}
              />
              <Button variant="primary" size="lg" className="flex-1" onClick={close}>
                Fatto
              </Button>
            </div>
          )
        }
      >
        <fieldset disabled={readOnly} className="min-w-0">
          <Segmented className="mb-4" value={s.type} onChange={(t) => (haptic.select(), void update({ type: t }))} options={SESSION_TYPES.map((t) => ({ value: t, label: SESSION_TYPE_LABEL[t] }))} />
          <div className="grid grid-cols-2 gap-3">
            <Field label="Data">
              <input type="date" className="input" value={s.date} onChange={(e) => void update({ date: e.target.value })} />
            </Field>
            <Field label="Durata (minuti)">
              <input className="input" inputMode="numeric" value={s.minutes || ''} onChange={(e) => void update({ minutes: Number(e.target.value.replace(/\D/g, '').slice(0, 3)) })} />
            </Field>
          </div>
          <p className="-mt-1 mb-4 px-1 text-[14px] text-ink-muted">
            <b className="text-ink">
              {answered.length}/{players.length}
            </b>{' '}
            risposte · RPE medio{' '}
            <b style={{ color: rpeColor(avgRpe) }}>{avgRpe == null ? '–' : avgRpe.toFixed(1).replace('.', ',')}</b> · TL medio <b className="text-ink">{avgTl == null ? '–' : Math.round(avgTl)}</b>
          </p>
          {!readOnly && s.id != null && <SurveyPanel session={s} players={players} />}
          <div className="overflow-hidden rounded-2xl bg-surface">
            {players.map((p) => {
              const e = mine.get(p.id!);
              return (
                <button key={p.id} onClick={() => (haptic.tap(), setPicking(p))} className="flex min-h-[56px] w-full items-center gap-3 border-t border-white/[.05] px-3 py-1.5 text-left first:border-t-0 active:bg-white/[.04]">
                  <span className="grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-full bg-surface-3 font-display text-sm font-bold">
                    {p.photo ? <img src={p.photo} alt="" className="h-full w-full object-cover" /> : p.number || '–'}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[15px] font-semibold">{surnameFirst(p.name)}</span>
                    {e?.rpe != null && (
                      <span className="block truncate text-[12px] text-ink-muted">
                        {RPE_SCALE.find((x) => x.value === e.rpe)?.label ?? ''}
                        {e.minutes != null ? ` · ${e.minutes}′` : ''}
                        {e.source === 'atleta' ? ' · dal link' : ''}
                      </span>
                    )}
                  </span>
                  <span className={cx('w-10 text-center font-display text-[24px] font-extrabold tabular', e?.rpe == null && 'text-ink-faint')} style={e?.rpe != null ? { color: rpeColor(e.rpe) } : undefined}>
                    {e?.rpe != null ? fmtRpe(e.rpe) : '–'}
                  </span>
                </button>
              );
            })}
          </div>
        </fieldset>
      </Sheet>
      {!readOnly && <RpePicker player={picking} entry={picking ? mine.get(picking.id!) : undefined} session={s} onPick={pick} onClose={() => setPicking(null)} />}
    </>
  );
}
