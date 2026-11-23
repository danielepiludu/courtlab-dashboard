import { useEffect, useMemo, useState } from 'react';
import { Trash } from 'lucide-react';
import { Sheet } from '@/components/ui/Sheet';
import { Button } from '@/components/ui/Button';
import { Field } from '@/components/ui/misc';
import { surnameFirst, type AthleteMeasures, type MeasureSession, type Player } from '@/db/types';
import { MEASURES, MEASURE_GROUP_LABEL, QUALITY_SCALE, fmtMeasure, type MeasureDef, type MeasureGroup } from '@/engine/anthro';
import { fmtLong } from '@/lib/dates';
import { haptic } from '@/lib/haptics';
import { cx } from '@/lib/cx';
import { confirmDialog, toast } from '@/store/feedback';
import { deleteMeasureSession, saveAthleteMeasures, saveMeasureSession, sessionLabel } from './measuresRepo';

const toInput = (v: number | string | undefined) => (v == null ? '' : typeof v === 'number' ? String(v).replace('.', ',') : v);
const parseNum = (s: string) => {
  const t = s.trim().replace(',', '.');
  return t === '' ? undefined : Number.isFinite(Number(t)) ? Number(t) : undefined;
};

/** Inserimento delle misure di un atleta, raggruppate; le misure dx/sx affiancate. */
function AthleteMeasureForm({ player, session, existing, onSaved, onClose }: { player: Player | null; session: MeasureSession; existing?: AthleteMeasures; onSaved: () => void; onClose: () => void }) {
  const [vals, setVals] = useState<Record<string, string>>({});
  const [note, setNote] = useState('');
  useEffect(() => {
    if (!player) return;
    setVals(Object.fromEntries(Object.entries(existing?.values ?? {}).map(([k, v]) => [k, toInput(v)])));
    setNote(existing?.note ?? '');
  }, [player, existing]);

  const save = async () => {
    if (!player) return;
    const values: AthleteMeasures['values'] = {};
    for (const m of MEASURES) {
      const raw = vals[m.id] ?? '';
      if (m.kind === 'number') {
        const n = parseNum(raw);
        if (n != null) values[m.id] = n;
      } else if (raw.trim()) values[m.id] = raw.trim();
    }
    await saveAthleteMeasures(session, player.id!, values, note);
    haptic.confirm();
    onSaved();
  };

  const input = (m: MeasureDef, placeholder?: string) => (
    <input
      className="input"
      inputMode="decimal"
      placeholder={placeholder ?? m.unit}
      value={vals[m.id] ?? ''}
      onChange={(e) => setVals((v) => ({ ...v, [m.id]: e.target.value.replace(/[^\d.,]/g, '').slice(0, 6) }))}
    />
  );

  const groups = (['generali', 'circonferenze', 'salti', 'valutazioni'] as MeasureGroup[]).map((g) => ({ g, items: MEASURES.filter((m) => m.group === g) }));
  return (
    <Sheet
      open={!!player}
      onClose={onClose}
      elevated
      wide
      title={player ? surnameFirst(player.name) : ''}
      subtitle={`Misure del ${fmtLong(session.date, false).toLowerCase()}`}
      footer={
        <Button variant="primary" size="lg" className="w-full" onClick={() => void save()}>
          Salva
        </Button>
      }
    >
      {groups.map(({ g, items }) => (
        <section key={g} className="mb-5">
          <h3 className="mb-2 px-1 text-[14px] font-semibold text-ink-muted">{MEASURE_GROUP_LABEL[g]}</h3>
          {g === 'circonferenze' ? (
            <>
              {items
                .filter((m) => !m.pair)
                .map((m) => (
                  <Field key={m.id} label={`${m.label} (${m.unit})`}>
                    {input(m)}
                  </Field>
                ))}
              {[...new Set(items.filter((m) => m.pair).map((m) => m.pair!))].map((pair) => {
                const dx = items.find((m) => m.pair === pair && m.side === 'dx')!;
                const sx = items.find((m) => m.pair === pair && m.side === 'sx')!;
                return (
                  <div key={pair} className="mb-4">
                    <span className="label">{dx.label.replace(/ dx$/, '')} (cm)</span>
                    <div className="grid grid-cols-2 gap-3">
                      {input(dx, 'destra')}
                      {input(sx, 'sinistra')}
                    </div>
                  </div>
                );
              })}
            </>
          ) : g === 'valutazioni' ? (
            items.map((m) => (
              <div key={m.id} className="mb-4">
                <span className="label">{m.label}</span>
                <div className="no-scrollbar mb-2 flex gap-1.5 overflow-x-auto">
                  {QUALITY_SCALE.map((q) => {
                    const on = (vals[m.id] ?? '').toLowerCase().startsWith(q.toLowerCase());
                    return (
                      <button
                        key={q}
                        type="button"
                        onClick={() => setVals((v) => ({ ...v, [m.id]: on ? '' : q }))}
                        className={cx('h-9 shrink-0 rounded-full px-3 text-[13px] font-semibold', on ? 'bg-accent/20 text-ink ring-1 ring-accent/60' : 'bg-white/[.05] text-ink-muted')}
                      >
                        {q}
                      </button>
                    );
                  })}
                </div>
                <input className="input" placeholder="Giudizio o nota (es. collassa piede sx)" value={vals[m.id] ?? ''} onChange={(e) => setVals((v) => ({ ...v, [m.id]: e.target.value }))} />
              </div>
            ))
          ) : (
            <div className="grid grid-cols-2 gap-x-3">
              {items.map((m) => (
                <Field key={m.id} label={`${m.short} (${m.unit})`}>
                  {input(m)}
                </Field>
              ))}
            </div>
          )}
        </section>
      ))}
      <Field label="Note">
        <textarea className="input min-h-[80px] py-3" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Altre misure o osservazioni" />
      </Field>
    </Sheet>
  );
}

/** Rilevazione: data, nome e misure di ogni atleta. */
export function MeasureSessionSheet({ session, players, measures, readOnly, onClose }: { session: MeasureSession | null; players: Player[]; measures: AthleteMeasures[]; readOnly: boolean; onClose: () => void }) {
  const [draft, setDraft] = useState<MeasureSession | null>(session);
  const [editing, setEditing] = useState<Player | null>(null);
  useEffect(() => {
    if (session) setDraft(session);
  }, [session]);
  const mine = useMemo(() => new Map(measures.filter((m) => m.sessionId === session?.id).map((m) => [m.playerId, m])), [measures, session?.id]);
  if (!draft && !session) return null;
  const s = draft ?? session!;
  const done = players.filter((p) => mine.has(p.id!)).length;

  const update = async (p: Partial<MeasureSession>) => {
    const next = { ...s, ...p };
    setDraft(next);
    if (next.id && next.date) await saveMeasureSession(next);
  };

  const afterSave = () => {
    // passa al prossimo atleta non ancora misurato
    const idx = players.findIndex((p) => p.id === editing?.id);
    const next = [...players.slice(idx + 1), ...players.slice(0, idx)].find((p) => !mine.has(p.id!) && p.id !== editing?.id);
    setEditing(next ?? null);
    if (!next) toast('Misure salvate', 'success');
  };

  return (
    <>
      <Sheet
        open={!!session}
        onClose={onClose}
        wide
        title={sessionLabel(s)}
        subtitle={s.label ? fmtLong(s.date) : 'Rilevazione'}
        footer={
          <div className="flex gap-3">
            {!readOnly && (
              <Button
                variant="danger"
                size="lg"
                className="px-4"
                aria-label="Elimina rilevazione"
                icon={<Trash size={20} />}
                onClick={async () => {
                  const ok = await confirmDialog({ title: 'Eliminare la rilevazione?', message: `Verranno eliminate le misure di ${done} atleti.`, confirmLabel: 'Elimina', danger: true });
                  if (!ok) return;
                  await deleteMeasureSession(s.id!);
                  toast('Rilevazione eliminata');
                  onClose();
                }}
              />
            )}
            <Button variant="primary" size="lg" className="flex-1" onClick={onClose}>
              {readOnly ? 'Chiudi' : 'Fatto'}
            </Button>
          </div>
        }
      >
        <fieldset disabled={readOnly} className="min-w-0">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Data">
              <input type="date" className="input" value={s.date} onChange={(e) => void update({ date: e.target.value })} />
            </Field>
            <Field label="Nome (facoltativo)">
              <input className="input" placeholder="es. Pre-season" value={s.label} onChange={(e) => void update({ label: e.target.value })} />
            </Field>
          </div>
          <p className="-mt-1 mb-4 px-1 text-[14px] text-ink-muted">
            <b className="text-ink">
              {done}/{players.length}
            </b>{' '}
            atleti misurati
          </p>
          <div className="overflow-hidden rounded-2xl bg-surface">
            {players.map((p) => {
              const m = mine.get(p.id!);
              const preview = m ? [m.values.height != null && `${fmtMeasure(m.values.height)} cm`, m.values.weight != null && `${fmtMeasure(m.values.weight, { decimals: 1 })} kg`, `${Object.keys(m.values).length} misure`].filter(Boolean).join(' · ') : 'Da misurare';
              return (
                <button key={p.id} onClick={() => (haptic.tap(), setEditing(p))} className="flex min-h-[56px] w-full items-center gap-3 border-t border-white/[.05] px-3 py-1.5 text-left first:border-t-0 active:bg-white/[.04]">
                  <span className="grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-full bg-surface-3 font-display text-sm font-bold">
                    {p.photo ? <img src={p.photo} alt="" className="h-full w-full object-cover" /> : p.number || '–'}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[15px] font-semibold">{surnameFirst(p.name)}</span>
                    <span className={cx('block truncate text-[12px]', m ? 'text-ink-muted' : 'text-ink-faint')}>{preview}</span>
                  </span>
                  {m && <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-ok" aria-label="misurato" />}
                </button>
              );
            })}
          </div>
        </fieldset>
      </Sheet>
      {!readOnly && <AthleteMeasureForm player={editing} session={s} existing={editing ? mine.get(editing.id!) : undefined} onSaved={afterSave} onClose={() => setEditing(null)} />}
    </>
  );
}
