import { useMemo, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, FileSpreadsheet, Ruler } from 'lucide-react';
import { Sheet } from '@/components/ui/Sheet';
import { Button } from '@/components/ui/Button';
import { Segmented } from '@/components/ui/Chip';
import { EmptyState, Field, SectionTitle } from '@/components/ui/misc';
import { Num } from '@/components/ui/Num';
import { compareSurname, surnameFirst, type AthleteMeasures, type MeasureSession, type Player } from '@/db/types';
import { MEASURES, MEASURE_BY_ID, NUMERIC_MEASURES, PAIRS, ageAt, asymmetry, bmi, deltas, fmtDelta, fmtMeasure, type MeasureDef } from '@/engine/anthro';
import { haptic } from '@/lib/haptics';
import { cx } from '@/lib/cx';
import { toast } from '@/store/feedback';
import { MeasureSessionSheet } from './MeasureSessionSheet';
import { sessionLabel } from './measuresRepo';
import { applyMeasureImport, parseMeasureSheet, planMeasureImport, type MeasureImportPlan } from './importMeasures';

const BMI_DEF: MeasureDef = { id: 'bmi', label: 'BMI (con l’altezza con scarpa)', short: 'BMI', unit: 'kg/m²', group: 'generali', kind: 'number', decimals: 1, match: /^$/ };
const valueOf = (m: AthleteMeasures | undefined, id: string): number | null => {
  if (!m) return null;
  if (id === 'bmi') return bmi(m.values);
  const v = m.values[id];
  return typeof v === 'number' ? v : null;
};

/** Mini-grafico dei valori nelle rilevazioni. */
function Spark({ values }: { values: (number | null)[] }) {
  const pts = values.map((v, i) => ({ v, i })).filter((p): p is { v: number; i: number } => p.v != null);
  if (pts.length < 2) return <span className="w-16" />;
  const min = Math.min(...pts.map((p) => p.v));
  const max = Math.max(...pts.map((p) => p.v));
  const W = 64;
  const H = 22;
  const x = (i: number) => 3 + (i / Math.max(1, values.length - 1)) * (W - 6);
  const y = (v: number) => (max === min ? H / 2 : H - 3 - ((v - min) / (max - min)) * (H - 6));
  return (
    <svg width={W} height={H} className="shrink-0" aria-hidden>
      <polyline points={pts.map((p) => `${x(p.i)},${y(p.v)}`).join(' ')} fill="none" stroke="var(--c-select-text)" strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round" />
      {pts.map((p) => (
        <circle key={p.i} cx={x(p.i)} cy={y(p.v)} r={p.i === pts[pts.length - 1].i ? 2.8 : 1.8} fill="var(--c-select-text)" />
      ))}
    </svg>
  );
}

function Delta({ v, def }: { v: number | null; def?: MeasureDef }) {
  if (v == null) return <span className="text-ink-faint">–</span>;
  const Icon = v > 0 ? ArrowUp : v < 0 ? ArrowDown : null;
  return (
    <span className="inline-flex items-center justify-end gap-0.5 tabular">
      {Icon && <Icon size={12} strokeWidth={3} className="text-ink-muted" />}
      {fmtDelta(v, def)}
    </span>
  );
}

/** Scheda antropometrica dell'atleta: andamento di ogni misura, asimmetrie, valutazioni e note. */
function AthleteSheet({ player, sessions, measures, onClose }: { player: Player | null; sessions: MeasureSession[]; measures: AthleteMeasures[]; onClose: () => void }) {
  const asc = [...sessions].sort((a, b) => a.date.localeCompare(b.date));
  const mine = new Map(measures.filter((m) => m.playerId === player?.id).map((m) => [m.sessionId, m]));
  const series = (id: string) => asc.map((s) => valueOf(mine.get(s.id!), id));
  const lastSession = [...asc].reverse().find((s) => mine.has(s.id!));
  const age = player && lastSession ? ageAt(player.birthDate, lastSession.date) : null;
  const shown = [...NUMERIC_MEASURES.filter((m) => !m.pair), BMI_DEF, ...NUMERIC_MEASURES.filter((m) => m.pair)].filter((m) => series(m.id).some((v) => v != null));
  return (
    <Sheet open={!!player} onClose={onClose} wide title={player ? surnameFirst(player.name) : ''} subtitle={[age != null && `${age.toFixed(1).replace('.', ',')} anni`, `${mine.size} rilevazioni`].filter(Boolean).join(' · ')}>
      {!mine.size ? (
        <p className="py-6 text-center text-sm text-ink-muted">Nessuna misura per questo atleta.</p>
      ) : (
        <>
          <div className="overflow-hidden rounded-2xl bg-surface">
            <div className="grid grid-cols-[1fr_64px_62px_52px_52px] items-center gap-2 px-3 pb-1 pt-2.5 text-[11px] font-semibold text-ink-muted">
              <span>Misura</span>
              <span />
              <span className="text-right">Ultima</span>
              <span className="text-right">Δ prec.</span>
              <span className="text-right">Δ base</span>
            </div>
            {shown.map((m) => {
              const pts = series(m.id);
              const d = deltas(asc.map((s, i) => ({ date: s.date, sessionId: s.id!, value: pts[i] })));
              return (
                <div key={m.id} className="grid grid-cols-[1fr_64px_62px_52px_52px] items-center gap-2 border-t border-white/[.05] px-3 py-2 text-[13px]">
                  <span className="truncate font-semibold">
                    {m.short} <span className="font-normal text-ink-faint">{m.unit}</span>
                  </span>
                  <Spark values={pts} />
                  <span className="text-right text-[15px] font-bold tabular">{fmtMeasure(d.last, m)}</span>
                  <span className="text-right text-ink-muted">
                    <Delta v={d.dPrev} def={m} />
                  </span>
                  <span className="text-right text-ink-muted">
                    <Delta v={d.dBase} def={m} />
                  </span>
                </div>
              );
            })}
          </div>

          <SectionTitle>Asimmetria destra / sinistra</SectionTitle>
          <div className="overflow-hidden rounded-2xl bg-surface">
            {PAIRS.map((pr) => {
              const last = lastSession ? mine.get(lastSession.id!) : undefined;
              const dx = valueOf(last, pr.dx);
              const sx = valueOf(last, pr.sx);
              const a = asymmetry(dx, sx);
              return (
                <div key={pr.id} className="flex items-center gap-3 border-t border-white/[.05] px-3 py-2.5 text-[13px] first:border-t-0">
                  <span className="flex-1 font-semibold">{pr.label}</span>
                  <span className="text-ink-muted tabular">
                    {fmtMeasure(dx, { decimals: 1 })} / {fmtMeasure(sx, { decimals: 1 })} cm
                  </span>
                  <span className={cx('w-16 text-right font-bold tabular', a != null && a >= 5 ? 'text-warn' : '')}>{a == null ? '–' : `${a.toFixed(1).replace('.', ',')}%`}</span>
                </div>
              );
            })}
          </div>
          <p className="mt-1.5 px-1 text-[12px] text-ink-faint">Ultima rilevazione. In arancio dal 5% di differenza.</p>

          {MEASURES.filter((m) => m.kind === 'text' && asc.some((s) => mine.get(s.id!)?.values[m.id])).length > 0 && (
            <>
              <SectionTitle>Valutazioni</SectionTitle>
              <div className="overflow-hidden rounded-2xl bg-surface">
                {MEASURES.filter((m) => m.kind === 'text').map((m) =>
                  asc
                    .filter((s) => mine.get(s.id!)?.values[m.id])
                    .map((s) => (
                      <div key={m.id + s.id} className="flex items-center gap-3 border-t border-white/[.05] px-3 py-2.5 text-[13px] first:border-t-0">
                        <span className="w-24 shrink-0 font-semibold">{m.label}</span>
                        <span className="w-16 shrink-0 text-ink-muted">{sessionLabel(s, true)}</span>
                        <span className="min-w-0 flex-1 truncate">{String(mine.get(s.id!)!.values[m.id])}</span>
                      </div>
                    )),
                )}
              </div>
            </>
          )}

          {asc.some((s) => mine.get(s.id!)?.note) && (
            <>
              <SectionTitle>Note</SectionTitle>
              <div className="overflow-hidden rounded-2xl bg-surface">
                {asc
                  .filter((s) => mine.get(s.id!)?.note)
                  .map((s) => (
                    <div key={s.id} className="border-t border-white/[.05] px-3 py-2.5 text-[13px] first:border-t-0">
                      <span className="mr-2 text-ink-muted">{sessionLabel(s, true)}</span>
                      {mine.get(s.id!)!.note}
                    </div>
                  ))}
              </div>
            </>
          )}
        </>
      )}
    </Sheet>
  );
}

/** Importazione dal foglio "Misurazioni" (.xlsx): una scheda per rilevazione. */
function ImportSheet({ open, onClose, teamId, players }: { open: boolean; onClose: () => void; teamId: number; players: Player[] }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [plan, setPlan] = useState<MeasureImportPlan | null>(null);
  const [busy, setBusy] = useState(false);
  const pick = async (f: File | undefined) => {
    if (!f) return;
    setBusy(true);
    try {
      const { default: readXlsxFile, readSheetNames } = await import('read-excel-file');
      const sheets = [];
      for (const name of await readSheetNames(f)) {
        const parsed = parseMeasureSheet(name, (await readXlsxFile(f, { sheet: name })) as never);
        if (parsed) sheets.push(parsed);
      }
      if (!sheets.length) throw new Error('Nel file non trovo schede con atleti in colonna e misure in riga');
      setPlan(planMeasureImport(sheets, players));
    } catch (e) {
      toast(e instanceof Error ? e.message : 'File non leggibile', 'error', 4000);
    } finally {
      setBusy(false);
    }
  };
  const run = async () => {
    if (!plan) return;
    setBusy(true);
    try {
      const r = await applyMeasureImport(teamId, plan);
      haptic.confirm();
      toast(`Importate ${r.sessions} rilevazioni${r.newPlayers ? ` · ${r.newPlayers} nuovi giocatori` : ''}`, 'success', 4000);
      setPlan(null);
      onClose();
    } finally {
      setBusy(false);
    }
  };
  return (
    <Sheet
      open={open}
      onClose={() => (setPlan(null), onClose())}
      title="Importa misure da Excel"
      subtitle="Una scheda per rilevazione, atleti in colonna"
      footer={
        plan && (
          <Button variant="primary" size="lg" className="w-full" disabled={busy} onClick={run}>
            Importa {plan.sheets.length} rilevazioni
          </Button>
        )
      }
    >
      {!plan ? (
        <>
          <p className="mb-4 text-[14px] leading-relaxed text-ink-muted">
            Scarica il foglio Google come <b className="text-ink">Microsoft Excel (.xlsx)</b> e selezionalo. Ogni scheda diventa una rilevazione (il nome della scheda dà la data, es. 20082026);
            gli atleti vengono abbinati per cognome e le date di nascita completano le schede dei giocatori.
          </p>
          <Button size="lg" className="w-full" disabled={busy} icon={<FileSpreadsheet size={20} />} onClick={() => fileRef.current?.click()}>
            {busy ? 'Lettura…' : 'Scegli il file .xlsx'}
          </Button>
          <input ref={fileRef} type="file" accept=".xlsx" hidden onChange={(e) => (void pick(e.target.files?.[0]), (e.target.value = ''))} />
        </>
      ) : (
        <>
          <SectionTitle>Rilevazioni</SectionTitle>
          <div className="space-y-2">
            {plan.sheets.map((s, i) => (
              <div key={s.sheetName} className="rounded-2xl bg-surface p-3">
                <div className="mb-2 flex items-center justify-between text-[13px]">
                  <b>Scheda «{s.sheetName}»</b>
                  <span className="text-ink-muted">{s.athletes.filter((a) => Object.keys(a.values).length).length} atleti</span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Field label={s.date ? 'Data' : 'Data (da controllare)'} className="!mb-0">
                    <input
                      type="date"
                      className={cx('input', !s.date && '!border-warn')}
                      value={s.chosenDate}
                      onChange={(e) => setPlan({ ...plan, sheets: plan.sheets.map((x, k) => (k === i ? { ...x, chosenDate: e.target.value } : x)) })}
                    />
                  </Field>
                  <Field label="Nome" className="!mb-0">
                    <input className="input" value={s.label} placeholder="facoltativo" onChange={(e) => setPlan({ ...plan, sheets: plan.sheets.map((x, k) => (k === i ? { ...x, label: e.target.value } : x)) })} />
                  </Field>
                </div>
              </div>
            ))}
          </div>
          <SectionTitle>Atleti</SectionTitle>
          <div className="overflow-hidden rounded-2xl bg-surface">
            {plan.matches.map((m) => (
              <div key={m.sheetName} className="flex items-center justify-between border-t border-white/[.05] px-3 py-2 text-[14px] first:border-t-0">
                <span className="font-semibold">{m.sheetName}</span>
                <span className={m.playerId != null ? 'text-ok' : 'text-warn'}>{m.playerId != null ? `→ ${surnameFirst(m.playerName ?? '')}` : 'nuovo giocatore'}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </Sheet>
  );
}

/** Antropometria della squadra: confronto tra rilevazioni per misura, rilevazioni e importazione. */
export function MeasuresView({
  teamId,
  players,
  sessions,
  measures,
  readOnly,
  open,
  onOpen,
}: {
  teamId: number;
  players: Player[];
  sessions: MeasureSession[] | undefined;
  measures: AthleteMeasures[];
  readOnly: boolean;
  /** rilevazione aperta (anche appena creata dal + nell'header) */
  open: MeasureSession | null;
  onOpen: (s: MeasureSession | null) => void;
}) {
  const [view, setView] = useState<'compare' | 'sessions'>('compare');
  const [measureId, setMeasureId] = useState('weight');
  const [athlete, setAthlete] = useState<Player | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const asc = useMemo(() => [...(sessions ?? [])].sort((a, b) => a.date.localeCompare(b.date)), [sessions]);
  const byKey = useMemo(() => new Map(measures.map((m) => [`${m.sessionId}:${m.playerId}`, m])), [measures]);
  const def = measureId === 'bmi' ? BMI_DEF : MEASURE_BY_ID.get(measureId)!;
  const roster = [...players].sort(compareSurname);
  const measured = roster.filter((p) => asc.some((s) => byKey.has(`${s.id}:${p.id}`)));
  const current = open ? (sessions?.find((x) => x.id === open.id) ?? open) : null;

  if (sessions === undefined) return null;
  if (!sessions.length)
    return (
      <>
        <EmptyState
          icon={<Ruler size={30} />}
          title="Nessuna rilevazione"
          text="Crea una rilevazione con il + in alto e inserisci le misure di ogni atleta, oppure importa il tuo foglio Excel."
          action={
            !readOnly && (
              <Button icon={<FileSpreadsheet size={18} />} onClick={() => setImportOpen(true)}>
                Importa da Excel
              </Button>
            )
          }
        />
        <ImportSheet open={importOpen} onClose={() => setImportOpen(false)} teamId={teamId} players={players} />
        <MeasureSessionSheet session={current} players={roster} measures={measures} readOnly={readOnly} onClose={() => onOpen(null)} />
      </>
    );

  const options = [...NUMERIC_MEASURES.filter((m) => !m.pair), BMI_DEF, ...NUMERIC_MEASURES.filter((m) => m.pair)].filter((m) =>
    m.id === 'bmi' ? measures.some((x) => bmi(x.values) != null) : measures.some((x) => typeof x.values[m.id] === 'number'),
  );
  const avg = (vals: (number | null)[]) => {
    const v = vals.filter((x): x is number => x != null);
    return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
  };

  return (
    <>
      <Segmented
        className="mb-3"
        value={view}
        onChange={setView}
        options={[
          { value: 'compare', label: 'Confronto' },
          { value: 'sessions', label: `Rilevazioni (${sessions.length})` },
        ]}
      />
      {view === 'compare' ? (
        <>
          <div className="no-scrollbar -mx-4 mb-3 flex gap-2 overflow-x-auto px-4">
            {options.map((m) => (
              <button
                key={m.id}
                onClick={() => (haptic.tap(), setMeasureId(m.id))}
                className={cx('h-9 shrink-0 rounded-full px-3.5 text-[13px] font-semibold', m.id === measureId ? 'bg-accent/20 text-ink ring-1 ring-accent/60' : 'bg-white/[.05] text-ink-muted')}
              >
                {m.short}
              </button>
            ))}
          </div>
          <div className="overflow-x-auto rounded-2xl bg-surface">
            <table className="w-full min-w-[340px] text-[13px] tabular">
              <thead className="text-[11px] text-ink-muted">
                <tr>
                  <th className="px-3 py-2.5 text-left font-semibold">
                    {def.short} <span className="font-normal">({def.unit})</span>
                  </th>
                  {asc.map((s) => (
                    <th key={s.id} className="px-2 text-right font-semibold">
                      {sessionLabel(s, true)}
                    </th>
                  ))}
                  <th className="px-3 text-right font-semibold">Δ</th>
                </tr>
              </thead>
              <tbody>
                {measured.map((p) => {
                  const vals = asc.map((s) => valueOf(byKey.get(`${s.id}:${p.id}`), def.id));
                  const d = deltas(asc.map((s, i) => ({ date: s.date, sessionId: s.id!, value: vals[i] })));
                  return (
                    <tr key={p.id} onClick={() => (haptic.tap(), setAthlete(p))} className="cursor-pointer border-t border-white/[.05] active:bg-white/[.04]">
                      <td className="max-w-[140px] truncate px-3 py-2.5 font-semibold">{surnameFirst(p.name)}</td>
                      {vals.map((v, i) => (
                        <td key={asc[i].id} className={cx('px-2 text-right', i === vals.length - 1 ? 'font-bold' : 'text-ink-muted')}>
                          {fmtMeasure(v, def)}
                        </td>
                      ))}
                      <td className="px-3 text-right text-ink-muted">
                        <Delta v={d.dBase} def={def} />
                      </td>
                    </tr>
                  );
                })}
                <tr className="border-t border-white/10 text-ink-muted">
                  <td className="px-3 py-2.5 font-semibold">Media squadra</td>
                  {asc.map((s) => (
                    <td key={s.id} className="px-2 text-right font-semibold">
                      {fmtMeasure(avg(measured.map((p) => valueOf(byKey.get(`${s.id}:${p.id}`), def.id))), { decimals: 1 })}
                    </td>
                  ))}
                  <td />
                </tr>
              </tbody>
            </table>
          </div>
          <p className="mt-2 px-1 text-[12px] text-ink-faint">Δ = ultima misura rispetto alla prima disponibile. Tocca un atleta per la sua scheda.</p>
        </>
      ) : (
        <>
          <div className="space-y-2">
            {sessions.map((s) => {
              const n = measures.filter((m) => m.sessionId === s.id).length;
              return (
                <button key={s.id} onClick={() => (haptic.tap(), onOpen(s))} className="card pressable flex w-full items-center gap-3 px-3 py-2.5 text-left">
                  <div className="w-11 shrink-0 text-center">
                    <div className="font-display text-[22px] font-bold leading-none">{+s.date.slice(8, 10)}</div>
                    <div className="text-[11px] font-semibold uppercase text-ink-muted">{new Date(`${s.date}T12:00:00`).toLocaleDateString('it-IT', { month: 'short' })}</div>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[15px] font-semibold">{s.label || 'Rilevazione'}</div>
                    <div className="text-[13px] text-ink-muted">{n} atleti misurati</div>
                  </div>
                  <Num value={n} className="text-[22px]" />
                </button>
              );
            })}
          </div>
          {!readOnly && (
            <button onClick={() => setImportOpen(true)} className="mx-auto mt-5 flex h-10 items-center gap-1.5 rounded-full px-4 text-[13px] font-semibold text-ink-muted active:scale-95">
              <FileSpreadsheet size={15} /> Importa da Excel
            </button>
          )}
        </>
      )}
      <MeasureSessionSheet session={current} players={roster} measures={measures} readOnly={readOnly} onClose={() => onOpen(null)} />
      <AthleteSheet player={athlete} sessions={asc} measures={measures} onClose={() => setAthlete(null)} />
      <ImportSheet open={importOpen} onClose={() => setImportOpen(false)} teamId={teamId} players={players} />
    </>
  );
}
