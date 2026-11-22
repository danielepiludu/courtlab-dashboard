import { useEffect, useMemo, useState } from 'react';
import { Check, Trash } from 'lucide-react';
import { Sheet } from '@/components/ui/Sheet';
import { Button } from '@/components/ui/Button';
import { Num } from '@/components/ui/Num';
import { Field } from '@/components/ui/misc';
import type { Player, RpeEntry, TrainingSession } from '@/db/types';
import { SESSION_TYPE_LABEL } from '@/db/types';
import { deleteSession, saveSession, setRpe } from '@/db/rpeRepo';
import { RPE_SCALE, entryTL } from '@/engine/load';
import { intColor } from '@/features/live/PlayerCards';
import { fmtLong } from '@/lib/dates';
import { haptic } from '@/lib/haptics';
import { cx } from '@/lib/cx';
import { confirmDialog, toast } from '@/store/feedback';

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
    <Sheet open={!!player} onClose={onClose} elevated title={player ? `#${player.number} ${player.name}` : ''} subtitle="Quanto è stato faticoso l'allenamento?">
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
    if (next.id && next.date && next.minutes > 0) await saveSession(next);
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
        onClose={onClose}
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
                  await deleteSession(s.id!);
                  toast('Seduta eliminata');
                  onClose();
                }}
              />
              <Button variant="primary" size="lg" className="flex-1" onClick={onClose}>
                Fatto
              </Button>
            </div>
          )
        }
      >
        <fieldset disabled={readOnly} className="min-w-0">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Data">
              <input type="date" className="input" value={s.date} onChange={(e) => void update({ date: e.target.value })} />
            </Field>
            <Field label="Durata (minuti)">
              <input className="input" inputMode="numeric" value={s.minutes || ''} onChange={(e) => void update({ minutes: Number(e.target.value.replace(/\D/g, '').slice(0, 3)) })} />
            </Field>
          </div>
          <div className="mb-3 grid grid-cols-3 gap-2 text-center">
            <div className="card py-2">
              <Num value={`${answered.length}/${players.length}`} className="text-[22px]" />
              <div className="text-[10px] font-bold uppercase tracking-widest text-ink-muted">Risposte</div>
            </div>
            <div className="card py-2">
              <Num value={avgRpe == null ? '–' : avgRpe.toFixed(1).replace('.', ',')} className="text-[22px]" style={{ color: rpeColor(avgRpe) }} />
              <div className="text-[10px] font-bold uppercase tracking-widest text-ink-muted">RPE medio</div>
            </div>
            <div className="card py-2">
              <Num value={avgTl == null ? '–' : Math.round(avgTl)} className="text-[22px]" />
              <div className="text-[10px] font-bold uppercase tracking-widest text-ink-muted">TL medio</div>
            </div>
          </div>
          <div className="space-y-1.5">
            {players.map((p) => {
              const e = mine.get(p.id!);
              const tl = e?.rpe != null ? entryTL({ rpe: e.rpe, minutes: e.minutes ?? s.minutes }) : null;
              return (
                <button key={p.id} onClick={() => (haptic.tap(), setPicking(p))} className="pressable flex min-h-[54px] w-full items-center gap-3 rounded-xl border border-line bg-surface px-3 py-1.5 text-left">
                  <span className="grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-full bg-surface-3 font-display text-sm font-bold">
                    {p.photo ? <img src={p.photo} alt="" className="h-full w-full object-cover" /> : p.number || '–'}
                  </span>
                  <span className="min-w-0 flex-1">
                    <b className="block truncate text-[15px]">
                      <span className="text-brand-text">{p.number}</span> {p.name}
                    </b>
                    <span className="text-[12px] text-ink-muted">
                      {e?.rpe != null ? `${RPE_SCALE.find((x) => x.value === e.rpe)?.label ?? ''}${e.minutes != null ? ` · ${e.minutes}′` : ''}${e.source === 'atleta' ? ' · dall\'atleta' : ''}` : 'Nessuna risposta'}
                    </span>
                  </span>
                  {tl != null && <span className="text-[12px] font-semibold text-ink-muted">TL {tl}</span>}
                  <span className={cx('grid h-11 w-11 place-items-center rounded-xl font-display text-[22px] font-extrabold tabular', e?.rpe == null && 'border border-dashed border-line text-ink-faint')} style={e?.rpe != null ? { color: rpeColor(e.rpe), background: 'rgba(0,0,0,.35)' } : undefined}>
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
