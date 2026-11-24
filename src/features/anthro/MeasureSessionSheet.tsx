import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Trash, TriangleAlert } from 'lucide-react';
import { Sheet } from '@/components/ui/Sheet';
import { Button } from '@/components/ui/Button';
import { Segmented } from '@/components/ui/Chip';
import { Field } from '@/components/ui/misc';
import { surnameFirst, type AthleteMeasures, type MeasureSession, type Player } from '@/db/types';
import { MEASURES, MEASURE_BY_ID, MEASURE_GROUP_LABEL, PAIRS, QUALITY_SCALE, fmtMeasure, type MeasureDef, type MeasureGroup } from '@/engine/anthro';
import { fmtLong } from '@/lib/dates';
import { haptic } from '@/lib/haptics';
import { cx } from '@/lib/cx';
import { confirmDialog, toast } from '@/store/feedback';
import { clearMeasureInSession, deleteMeasureSession, saveMeasureSession, sessionLabel, setMeasureNote, setMeasureValue } from './measuresRepo';

const GROUPS: MeasureGroup[] = ['generali', 'circonferenze', 'salti', 'valutazioni'];
const toInput = (v: number | string | undefined) => (v == null ? '' : typeof v === 'number' ? String(v).replace('.', ',') : v);
const parseNum = (s: string) => {
  const t = s.trim().replace(',', '.');
  if (t === '' || t === '.') return undefined;
  const n = Number(t);
  return Number.isFinite(n) ? n : undefined;
};
/** Valore molto diverso dalla misura precedente: probabile errore di battitura. */
/** Porta il campo al centro dello schermo (sopra la tastiera) e lo attiva. */
const focusField = (el: HTMLInputElement | null | undefined) => {
  if (!el) return false;
  el.focus({ preventScroll: true });
  el.scrollIntoView({ block: 'center', behavior: 'smooth' });
  return true;
};
const suspicious = (v: number | undefined, prev: number | undefined) => v != null && prev != null && prev > 0 && Math.abs(v - prev) / prev > 0.1;

/** Campi della rilevazione (scelti dallo staff); di default tutte le misure. */
const fieldsOf = (s: MeasureSession) => (s.fields?.length ? MEASURES.filter((m) => s.fields!.includes(m.id)) : MEASURES);

/** Ultimo valore precedente a questa rilevazione, per atleta e misura. */
function usePrevious(session: MeasureSession, allSessions: MeasureSession[], measures: AthleteMeasures[]) {
  return useMemo(() => {
    const before = allSessions.filter((x) => x.date < session.date || (x.date === session.date && (x.id ?? 0) < (session.id ?? 0))).sort((a, b) => b.date.localeCompare(a.date));
    const bySession = new Map<number, Map<number, AthleteMeasures>>();
    for (const m of measures) {
      if (!bySession.has(m.sessionId)) bySession.set(m.sessionId, new Map());
      bySession.get(m.sessionId)!.set(m.playerId, m);
    }
    return (playerId: number, id: string): number | string | undefined => {
      for (const s of before) {
        const v = bySession.get(s.id!)?.get(playerId)?.values[id];
        if (v != null && v !== '') return v;
      }
      return undefined;
    };
  }, [session.date, session.id, allSessions, measures]);
}

/** Input numerico veloce: salva all'uscita, "Avanti" della tastiera va al campo dopo. */
function NumInput({
  value,
  prev,
  def,
  placeholder,
  onCommit,
  onNext,
  inputRef,
  autoFocus,
}: {
  value: number | string | undefined;
  prev: number | string | undefined;
  def: MeasureDef;
  placeholder?: string;
  onCommit: (v: number | undefined) => void;
  onNext: () => void;
  inputRef: (el: HTMLInputElement | null) => void;
  autoFocus?: boolean;
}) {
  const [text, setText] = useState(toInput(value));
  const saved = useRef(toInput(value));
  useEffect(() => {
    saved.current = toInput(value);
    setText(toInput(value));
  }, [value]);
  const n = parseNum(text);
  const warn = suspicious(n, typeof prev === 'number' ? prev : undefined);
  const commit = () => {
    if (saved.current === text) return;
    saved.current = text;
    onCommit(n);
  };
  // salva anche se il foglio si chiude mentre il campo è attivo
  const commitRef = useRef(commit);
  commitRef.current = commit;
  useEffect(() => () => commitRef.current(), []);
  return (
    <div className="relative min-w-0 flex-1">
      <input
        ref={inputRef}
        className={cx('input h-12 pr-2 text-center text-[18px] font-semibold tabular', warn && '!border-warn !text-warn')}
        inputMode="decimal"
        enterKeyHint="next"
        autoFocus={autoFocus}
        placeholder={placeholder ?? def.unit}
        value={text}
        onFocus={(e) => e.target.select()}
        onChange={(e) => setText(e.target.value.replace(/[^\d.,]/g, '').slice(0, 6))}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            commit();
            onNext();
          }
        }}
        aria-label={def.label}
      />
      {warn && <TriangleAlert size={14} className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-warn" aria-label="Molto diverso dalla misura precedente" />}
    </div>
  );
}

/** Inserimento veloce per atleta: tutte le misure scelte, in ordine, con il valore precedente. */
function FastAthlete({
  session,
  players,
  index,
  setIndex,
  measures,
  prevOf,
  onClose,
}: {
  session: MeasureSession;
  players: Player[];
  index: number | null;
  setIndex: (i: number | null) => void;
  measures: Map<number, AthleteMeasures>;
  prevOf: (playerId: number, id: string) => number | string | undefined;
  onClose: () => void;
}) {
  const player = index != null ? players[index] : null;
  const mine = player ? measures.get(player.id!) : undefined;
  const fields = fieldsOf(session);
  const numeric = fields.filter((m) => m.kind === 'number');
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  const [note, setNote] = useState('');
  useEffect(() => setNote(mine?.note ?? ''), [player?.id, mine?.note]);

  const focusAt = (i: number) => {
    if (!focusField(refs.current[i])) nextAthlete();
  };
  const nextAthlete = () => {
    if (index == null) return;
    haptic.confirm();
    if (index + 1 < players.length) setIndex(index + 1);
    else {
      toast('Ultimo atleta: rilevazione completata', 'success');
      onClose();
    }
  };
  // ordine di inserimento: dx prima di sx, poi la misura seguente
  const order = numeric.map((m) => m.id);
  const idx = (id: string) => order.indexOf(id);

  if (!player) return null;
  const save = (id: string, v: number | string | undefined) => void setMeasureValue(session, player.id!, id, v);
  const groups = GROUPS.map((g) => ({ g, items: fields.filter((m) => m.group === g) })).filter((x) => x.items.length);
  const firstEmpty = numeric.findIndex((m) => mine?.values[m.id] == null);

  const row = (label: string, defs: MeasureDef[]) => (
    <div key={defs[0].id} className="flex items-center gap-2 border-t border-white/[.05] py-1.5 first:border-t-0">
      <div className="w-[38%] min-w-0">
        <div className="line-clamp-2 text-[14px] font-semibold leading-tight">{label}</div>
        <div className="text-[11px] text-ink-muted">
          {defs[0].unit}
          {defs.some((d) => prevOf(player.id!, d.id) != null) && (
            <button
              type="button"
              className="ml-1.5 inline-flex h-7 items-center rounded-md bg-white/[.07] px-2 text-[12px] font-semibold text-accent-light active:bg-white/[.12]"
              onClick={() => {
                for (const d of defs) {
                  const pv = prevOf(player.id!, d.id);
                  if (pv != null) save(d.id, pv);
                }
                haptic.tap();
              }}
              aria-label={`Copia il valore precedente di ${label}`}
            >
              = {defs.map((d) => fmtMeasure(prevOf(player.id!, d.id) ?? null, d)).join(' / ')}
            </button>
          )}
        </div>
      </div>
      {defs.map((d) => (
        <NumInput
          key={d.id + player.id}
          def={d}
          value={mine?.values[d.id]}
          prev={prevOf(player.id!, d.id)}
          placeholder={defs.length > 1 ? d.side : undefined}
          inputRef={(el) => (refs.current[idx(d.id)] = el)}
          autoFocus={idx(d.id) === (firstEmpty < 0 ? 0 : firstEmpty)}
          onCommit={(v) => save(d.id, v)}
          onNext={() => focusAt(idx(d.id) + 1)}
        />
      ))}
    </div>
  );

  return (
    <Sheet
      open={!!player}
      onClose={onClose}
      elevated
      wide
      title={surnameFirst(player.name)}
      subtitle={`Atleta ${index! + 1} di ${players.length} · ${sessionLabel(session)}`}
      footer={
        <div className="flex gap-2">
          <Button size="lg" className="px-4" aria-label="Atleta precedente" disabled={!index} icon={<ChevronLeft size={22} />} onClick={() => setIndex(Math.max(0, index! - 1))} />
          <Button variant="primary" size="lg" className="flex-1" icon={<ChevronRight size={22} />} onClick={nextAthlete}>
            {index! + 1 < players.length ? `Avanti: ${surnameFirst(players[index! + 1].name).split(' ')[0]}` : 'Fine'}
          </Button>
        </div>
      }
    >
      {groups.map(({ g, items }) => (
        <section key={g} className="mb-3">
          <h3 className="mb-1 px-0.5 text-[12px] font-semibold uppercase tracking-wider text-ink-faint">{MEASURE_GROUP_LABEL[g]}</h3>
          <div className="rounded-2xl bg-surface px-3 py-1">
            {g === 'valutazioni'
              ? items.map((m) => (
                  <div key={m.id} className="border-t border-white/[.05] py-2 first:border-t-0">
                    <div className="mb-1.5 text-[14px] font-semibold">{m.label}</div>
                    <div className="no-scrollbar flex gap-1.5 overflow-x-auto chip-row">
                      {QUALITY_SCALE.map((q) => {
                        const cur = String(mine?.values[m.id] ?? '');
                        const on = cur.toLowerCase().startsWith(q.toLowerCase());
                        return (
                          <button
                            key={q}
                            type="button"
                            onClick={() => (haptic.tap(), save(m.id, on ? undefined : q))}
                            className={cx('h-10 shrink-0 rounded-full px-3.5 text-[13px] font-semibold', on ? 'bg-accent/25 text-ink ring-1 ring-accent' : 'bg-white/[.06] text-ink-muted')}
                          >
                            {q}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))
              : (() => {
                  const done = new Set<string>();
                  return items.map((m) => {
                    if (done.has(m.id)) return null;
                    if (m.pair) {
                      const pair = items.filter((x) => x.pair === m.pair).sort((a) => (a.side === 'dx' ? -1 : 1));
                      pair.forEach((x) => done.add(x.id));
                      return row(PAIRS.find((x) => x.id === m.pair)?.short ?? m.short, pair);
                    }
                    done.add(m.id);
                    return row(m.short, [m]);
                  });
                })()}
          </div>
        </section>
      ))}
      <Field label="Note" className="!mb-1">
        <input className="input" value={note} placeholder="facoltative" onChange={(e) => setNote(e.target.value)} onBlur={() => void setMeasureNote(session, player.id!, note)} />
      </Field>
      <p className="px-1 text-[12px] text-ink-faint">Si salva da solo. «Avanti» (o la freccia) sulla tastiera passa al campo dopo; «= valore» copia la misura precedente; in giallo i valori molto diversi dall'ultima volta.</p>
    </Sheet>
  );
}

/** Modalità a stazioni: una misura per tutti gli atleti, uno dopo l'altro. */
function StationMode({ session, players, measures, prevOf }: { session: MeasureSession; players: Player[]; measures: Map<number, AthleteMeasures>; prevOf: (playerId: number, id: string) => number | string | undefined }) {
  const numeric = fieldsOf(session).filter((m) => m.kind === 'number');
  const [id, setId] = useState(numeric[0]?.id ?? 'weight');
  const def = MEASURE_BY_ID.get(id) ?? numeric[0];
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  if (!def) return null;
  const done = players.filter((p) => measures.get(p.id!)?.values[def.id] != null).length;
  return (
    <>
      <div className="no-scrollbar -mx-5 mb-2 flex gap-1.5 overflow-x-auto px-5 chip-row">
        {numeric.map((m) => (
          <button
            key={m.id}
            onClick={() => (haptic.tap(), setId(m.id))}
            className={cx('h-9 shrink-0 rounded-full px-3 text-[13px] font-semibold', m.id === def.id ? 'bg-accent/20 text-ink ring-1 ring-accent/60' : 'bg-white/[.05] text-ink-muted')}
          >
            {m.short}
          </button>
        ))}
      </div>
      <div className="mb-2 flex items-center gap-2 px-1">
        <p className="min-w-0 flex-1 text-[13px] text-ink-muted">
          <b className="text-ink">{def.label}</b> ({def.unit}) · {done}/{players.length}
        </p>
        {done > 0 && (
          <button
            type="button"
            className="-mr-2 h-9 shrink-0 rounded-lg px-2 text-[13px] font-semibold text-danger active:bg-danger/10"
            onClick={async () => {
              const ok = await confirmDialog({ title: `Svuotare ${def.short}?`, message: `Verranno tolti i valori di ${def.label} di ${done} atleti in questa rilevazione (es. test non eseguito).`, confirmLabel: 'Svuota', danger: true });
              if (!ok) return;
              const n = await clearMeasureInSession(session, def.id);
              toast(`${def.short}: tolti ${n} valori`);
            }}
          >
            Svuota
          </button>
        )}
      </div>
      <div className="rounded-2xl bg-surface px-3 py-1">
        {players.map((p, i) => {
          const prev = prevOf(p.id!, def.id);
          return (
            <div key={p.id + def.id} className="flex items-center gap-2 border-t border-white/[.05] py-1.5 first:border-t-0">
              <div className="min-w-0 flex-1">
                <div className="truncate text-[14px] font-semibold">{surnameFirst(p.name)}</div>
                {prev != null && (
                  <button type="button" className="mt-0.5 inline-flex h-7 items-center rounded-md bg-white/[.07] px-2 text-[12px] font-semibold text-accent-light active:bg-white/[.12]" onClick={() => (haptic.tap(), void setMeasureValue(session, p.id!, def.id, prev))}>
                    = {fmtMeasure(prev, def)}
                  </button>
                )}
              </div>
              <div className="w-28">
                <NumInput
                  def={def}
                  value={measures.get(p.id!)?.values[def.id]}
                  prev={prev}
                  inputRef={(el) => (refs.current[i] = el)}
                  onCommit={(v) => void setMeasureValue(session, p.id!, def.id, v)}
                  onNext={() => focusField(refs.current[i + 1])}
                />
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}

/** Rilevazione: data, misure da rilevare e inserimento (per atleta o per misura). */
export function MeasureSessionSheet({
  session,
  players,
  measures,
  allSessions,
  readOnly,
  onClose,
}: {
  session: MeasureSession | null;
  players: Player[];
  measures: AthleteMeasures[];
  allSessions: MeasureSession[];
  readOnly: boolean;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState<MeasureSession | null>(session);
  const [athleteIdx, setAthleteIdx] = useState<number | null>(null);
  const [mode, setMode] = useState<'athlete' | 'station'>('athlete');
  const [chooseFields, setChooseFields] = useState(false);
  useEffect(() => {
    if (session) setDraft(session);
  }, [session]);
  const mine = useMemo(() => new Map(measures.filter((m) => m.sessionId === session?.id).map((m) => [m.playerId, m])), [measures, session?.id]);
  const prevOf = usePrevious(draft ?? session ?? ({ date: '9999', id: 0 } as MeasureSession), allSessions, measures);
  if (!draft && !session) return null;
  const s = draft ?? session!;
  const fields = fieldsOf(s);
  const done = players.filter((p) => mine.has(p.id!)).length;

  const update = async (p: Partial<MeasureSession>) => {
    const next = { ...s, ...p };
    setDraft(next);
    if (next.id && next.date) await saveMeasureSession(next);
  };
  const toggleField = (id: string) => {
    const cur = new Set(fields.map((m) => m.id));
    if (cur.has(id)) cur.delete(id);
    else cur.add(id);
    void update({ fields: MEASURES.filter((m) => cur.has(m.id)).map((m) => m.id) });
  };

  return (
    <>
      <Sheet
        open={!!session}
        onClose={onClose}
        wide
        title={sessionLabel(s)}
        subtitle={`${s.label ? `${fmtLong(s.date)} · ` : ''}${done}/${players.length} atleti misurati`}
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
            {!readOnly && mode === 'athlete' ? (
              <Button
                variant="primary"
                size="lg"
                className="flex-1"
                icon={<ChevronRight size={22} />}
                onClick={() => {
                  const first = players.findIndex((p) => !mine.has(p.id!));
                  setAthleteIdx(first < 0 ? 0 : first);
                }}
              >
                {done ? (done < players.length ? 'Continua' : 'Rivedi') : 'Inizia'}
              </Button>
            ) : (
              <Button variant="primary" size="lg" className="flex-1" onClick={onClose}>
                {readOnly ? 'Chiudi' : 'Fatto'}
              </Button>
            )}
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
          <button type="button" onClick={() => setChooseFields((v) => !v)} className="mb-3 flex w-full items-center justify-between rounded-2xl bg-surface px-3 py-2.5 text-left text-[14px]">
            <span>
              <b>Misure da rilevare</b> <span className="text-ink-muted">· {fields.length} di {MEASURES.length}</span>
            </span>
            <span className="text-[13px] font-semibold text-accent-light">{chooseFields ? 'Chiudi' : 'Scegli'}</span>
          </button>
          {chooseFields && (
            <div className="mb-4 flex flex-wrap gap-1.5">
              {MEASURES.map((m) => {
                const on = fields.some((f) => f.id === m.id);
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => (haptic.tap(), toggleField(m.id))}
                    className={cx('h-9 rounded-full px-3 text-[13px] font-semibold', on ? 'bg-accent/20 text-ink ring-1 ring-accent/60' : 'bg-white/[.05] text-ink-faint line-through')}
                  >
                    {m.short}
                  </button>
                );
              })}
            </div>
          )}
          <Segmented
            className="mb-3"
            value={mode}
            onChange={setMode}
            options={[
              { value: 'athlete', label: 'Per atleta' },
              { value: 'station', label: 'Per misura' },
            ]}
          />
          {mode === 'station' ? (
            <StationMode session={s} players={players} measures={mine} prevOf={prevOf} />
          ) : (
            <div className="overflow-hidden rounded-2xl bg-surface">
              {players.map((p, i) => {
                const m = mine.get(p.id!);
                const n = m ? fields.filter((f) => m.values[f.id] != null).length : 0;
                return (
                  <button key={p.id} onClick={() => (haptic.tap(), setAthleteIdx(i))} className="flex min-h-[52px] w-full items-center gap-3 border-t border-white/[.05] px-3 py-1.5 text-left first:border-t-0 active:bg-white/[.04]">
                    <span className="min-w-0 flex-1 truncate text-[15px] font-semibold">{surnameFirst(p.name)}</span>
                    <span className={cx('text-[13px] tabular', n >= fields.length ? 'text-ok' : n ? 'text-warn' : 'text-ink-faint')}>
                      {n}/{fields.length}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </fieldset>
      </Sheet>
      {!readOnly && <FastAthlete session={s} players={players} index={athleteIdx} setIndex={setAthleteIdx} measures={mine} prevOf={prevOf} onClose={() => setAthleteIdx(null)} />}
    </>
  );
}
