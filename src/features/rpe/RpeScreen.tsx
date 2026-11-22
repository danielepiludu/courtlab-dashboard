import { useMemo, useRef, useState } from 'react';
import { Activity, ChevronLeft, ChevronRight, FileSpreadsheet, Minus, Plus } from 'lucide-react';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Button } from '@/components/ui/Button';
import { Segmented } from '@/components/ui/Chip';
import { Num } from '@/components/ui/Num';
import { Sheet } from '@/components/ui/Sheet';
import { EmptyState, SectionTitle } from '@/components/ui/misc';
import { useActiveTeam, usePlayers, useRpeEntries, useSessions } from '@/db/hooks';
import { newSession, saveSession, toLoadEntries } from '@/db/rpeRepo';
import { SESSION_TYPE_LABEL, type Player, type TrainingSession } from '@/db/types';
import { LOAD_CONFIG, acwrZone, athleteSeries, entryTL, type AthleteDay } from '@/engine/load';
import { fmtMedium, todayISO } from '@/lib/dates';
import { haptic } from '@/lib/haptics';
import { cx } from '@/lib/cx';
import { toast } from '@/store/feedback';
import { LoadChart } from './LoadChart';
import { SessionSheet, rpeColor } from './SessionSheet';
import { applyImport, parseSrpeRows, planImport, type ImportPlan } from './importSrpe';

const fmt = (v: number | null | undefined, d = 0) => (v == null ? '–' : v.toFixed(d).replace('.', ','));
const ZONE = {
  high: { label: 'Sopra 1,3', cls: 'bg-danger/15 text-danger' },
  low: { label: 'Sotto 0,8', cls: 'bg-ok/15 text-ok' },
  ok: { label: 'In zona', cls: 'bg-white/10 text-ink' },
} as const;

function readWindow(): number {
  try {
    return Math.min(28, Math.max(2, Number(localStorage.getItem('bm-rpe-window')) || LOAD_CONFIG.windowDays));
  } catch {
    return LOAD_CONFIG.windowDays;
  }
}

/** Importazione dello storico da Excel con anteprima prima di scrivere. */
function ImportSheet({ open, onClose, teamId, players }: { open: boolean; onClose: () => void; teamId: number; players: Player[] }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [plan, setPlan] = useState<ImportPlan | null>(null);
  const [busy, setBusy] = useState(false);
  const pickFile = async (f: File | undefined) => {
    if (!f) return;
    setBusy(true);
    try {
      const { default: readXlsxFile, readSheetNames } = await import('read-excel-file');
      const names = await readSheetNames(f);
      let parsed = null;
      for (const sheet of names) {
        try {
          const rows = await readXlsxFile(f, { sheet });
          const p = parseSrpeRows(rows as never);
          if (p.length) {
            parsed = p;
            break;
          }
        } catch {
          /* foglio senza le colonne giuste: si prova il successivo */
        }
      }
      if (!parsed) throw new Error('Nel file non trovo un foglio con NOME ATLETA, DATA, RPE, TEMPO');
      setPlan(planImport(parsed, players));
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
      const r = await applyImport(teamId, plan);
      haptic.confirm();
      toast(`Importate ${r.sessions} sedute e ${r.entries} RPE${r.newPlayers ? ` · ${r.newPlayers} nuovi giocatori` : ''}`, 'success', 4000);
      setPlan(null);
      onClose();
    } finally {
      setBusy(false);
    }
  };
  const created = plan?.matches.filter((m) => m.playerId == null) ?? [];
  return (
    <Sheet
      open={open}
      onClose={() => (setPlan(null), onClose())}
      title="Importa da Excel"
      subtitle="Foglio con colonne NOME ATLETA, DATA, RPE, TEMPO"
      footer={
        plan && (
          <Button variant="primary" size="lg" className="w-full" disabled={busy} onClick={run}>
            Importa {plan.withRpe} RPE
          </Button>
        )
      }
    >
      {!plan ? (
        <>
          <p className="mb-4 text-[14px] leading-relaxed text-ink-muted">
            Scarica il tuo foglio Google come <b className="text-ink">Microsoft Excel (.xlsx)</b> (File → Scarica) e selezionalo qui. Ogni data diventa una seduta di allenamento tecnico; i
            nomi vengono abbinati ai giocatori della squadra (anche solo per cognome).
          </p>
          <Button size="lg" className="w-full" disabled={busy} icon={<FileSpreadsheet size={20} />} onClick={() => fileRef.current?.click()}>
            {busy ? 'Lettura…' : 'Scegli il file .xlsx'}
          </Button>
          <input ref={fileRef} type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" hidden onChange={(e) => (void pickFile(e.target.files?.[0]), (e.target.value = ''))} />
        </>
      ) : (
        <>
          <div className="mb-4 grid grid-cols-3 gap-2 text-center">
            <div className="card py-2">
              <Num value={plan.sessions.length} className="text-[24px]" />
              <div className="text-[10px] font-bold uppercase tracking-widest text-ink-muted">Sedute</div>
            </div>
            <div className="card py-2">
              <Num value={plan.withRpe} className="text-[24px]" />
              <div className="text-[10px] font-bold uppercase tracking-widest text-ink-muted">RPE</div>
            </div>
            <div className="card py-2">
              <Num value={plan.matches.length} className="text-[24px]" />
              <div className="text-[10px] font-bold uppercase tracking-widest text-ink-muted">Atleti</div>
            </div>
          </div>
          <div className="mb-2 text-[13px] text-ink-muted">
            Dal {fmtMedium(plan.sessions[0]?.date ?? todayISO())} al {fmtMedium(plan.sessions[plan.sessions.length - 1]?.date ?? todayISO())}. Abbinamento atleti:
          </div>
          <div className="space-y-1">
            {plan.matches.map((m) => (
              <div key={m.sheetName} className="flex items-center justify-between rounded-lg bg-night/40 px-3 py-2 text-[14px]">
                <span className="font-semibold">{m.sheetName}</span>
                <span className={m.playerId != null ? 'text-ok' : 'text-warn'}>{m.playerId != null ? `→ ${m.playerName}` : 'nuovo giocatore'}</span>
              </div>
            ))}
          </div>
          {created.length > 0 && <p className="mt-3 text-[13px] text-ink-muted">{created.length} nomi non corrispondono a giocatori della squadra: verranno creati (potrai completare foto e numero).</p>}
        </>
      )}
    </Sheet>
  );
}

export function RpeScreen() {
  const team = useActiveTeam();
  const readOnly = !!team?.archived;
  const sessions = useSessions();
  const entries = useRpeEntries();
  const allPlayers = usePlayers();
  const players = useMemo(() => allPlayers ?? [], [allPlayers]);
  const [view, setView] = useState<'sessions' | 'analysis'>('sessions');
  const [open, setOpen] = useState<TrainingSession | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [athlete, setAthlete] = useState<number | null>(null);
  const [windowDays, setWindowDays] = useState(readWindow);

  const sessionsAsc = useMemo(() => [...(sessions ?? [])].sort((a, b) => a.date.localeCompare(b.date)), [sessions]);
  const loadEntries = useMemo(() => toLoadEntries(sessionsAsc, entries ?? [], players), [sessionsAsc, entries, players]);
  const seriesByPlayer = useMemo(() => {
    const m = new Map<number, AthleteDay[]>();
    for (const p of players) m.set(p.id!, athleteSeries(loadEntries, p.id!, windowDays));
    return m;
  }, [loadEntries, players, windowDays]);

  const changeWindow = (d: number) => {
    const v = Math.min(28, Math.max(2, windowDays + d));
    setWindowDays(v);
    try {
      localStorage.setItem('bm-rpe-window', String(v));
    } catch {
      /* ignora */
    }
  };

  const createSession = async () => {
    if (!team?.id) return;
    haptic.select();
    const s = newSession(team.id);
    const id = await saveSession(s);
    setOpen({ ...s, id });
  };

  const overview = players
    .map((p) => {
      const series = seriesByPlayer.get(p.id!) ?? [];
      const last = [...series].reverse().find((d) => d.tl != null);
      const latest = series[series.length - 1];
      return { p, last, latest, answered: series.filter((d) => d.tl != null).length };
    })
    .sort((a, b) => (b.latest?.acwr ?? -1) - (a.latest?.acwr ?? -1));

  const selected = athlete != null ? players.find((p) => p.id === athlete) : undefined;
  const selSeries = athlete != null ? (seriesByPlayer.get(athlete) ?? []) : [];

  return (
    <>
      <ScreenHeader
        title="RPE"
        subtitle={team ? `${team.name} · carico interno (sRPE)` : 'Carico interno'}
        right={
          !readOnly &&
          view === 'sessions' && (
            <Button variant="primary" size="sm" icon={<Plus size={18} />} onClick={createSession}>
              Seduta
            </Button>
          )
        }
      />
      <div className="mx-auto max-w-3xl px-4 pt-3">
        <Segmented
          value={view}
          onChange={(v) => (setView(v), setAthlete(null))}
          options={[
            { value: 'sessions', label: 'Sedute' },
            { value: 'analysis', label: 'Analisi carico' },
          ]}
        />

        {view === 'sessions' ? (
          <>
            {sessions === undefined ? null : !sessions.length ? (
              <div className="mt-4">
                <EmptyState
                  icon={<Activity size={30} />}
                  title="Nessuna seduta"
                  text="Crea una seduta di allenamento e inserisci l'RPE di ogni atleta, oppure importa lo storico dal tuo foglio Excel."
                  action={
                    !readOnly && (
                      <div className="flex flex-wrap justify-center gap-2">
                        <Button icon={<FileSpreadsheet size={18} />} onClick={() => setImportOpen(true)}>
                          Importa Excel
                        </Button>
                        <Button variant="primary" icon={<Plus size={18} />} onClick={createSession}>
                          Nuova seduta
                        </Button>
                      </div>
                    )
                  }
                />
              </div>
            ) : (
              <>
                <SectionTitle
                  right={
                    !readOnly && (
                      <button onClick={() => setImportOpen(true)} className="flex h-9 items-center gap-1 rounded-full px-3 text-sm font-bold text-accent-light active:scale-95">
                        <FileSpreadsheet size={15} /> Importa Excel
                      </button>
                    )
                  }
                >
                  Sedute · {sessions.length}
                </SectionTitle>
                <div className="stagger space-y-2">
                  {sessions.map((s) => {
                    const es = (entries ?? []).filter((e) => e.sessionId === s.id && e.rpe != null && players.some((p) => p.id === e.playerId));
                    const avgRpe = es.length ? es.reduce((a, e) => a + (e.rpe ?? 0), 0) / es.length : null;
                    const avgTl = es.length ? es.reduce((a, e) => a + (entryTL({ rpe: e.rpe, minutes: e.minutes ?? s.minutes }) ?? 0), 0) / es.length : null;
                    const complete = es.length >= players.length && players.length > 0;
                    return (
                      <button key={s.id} onClick={() => (haptic.tap(), setOpen(s))} className="card pressable flex w-full items-center gap-3 p-3 text-left">
                        <div className="flex w-14 shrink-0 flex-col items-center rounded-xl bg-bar py-1.5">
                          <span className="text-[10px] font-bold uppercase tracking-widest text-ink-muted">{fmtMedium(s.date).split(' ')[0]}</span>
                          <span className="font-display text-2xl font-bold leading-none">{+s.date.slice(8, 10)}</span>
                          <span className="text-[11px] font-semibold uppercase text-brand-text">{fmtMedium(s.date).split(' ')[2]}</span>
                        </div>
                        <div className="min-w-0 flex-1">
                          <b className="block truncate text-[16px]">{SESSION_TYPE_LABEL[s.type]}</b>
                          <div className="text-[13px] text-ink-muted">
                            {s.minutes}′ ·{' '}
                            <span className={complete ? 'text-ok' : es.length ? 'text-warn' : 'text-ink-muted'}>
                              {es.length}/{players.length} risposte
                            </span>
                          </div>
                        </div>
                        <div className="text-right">
                          <Num value={fmt(avgRpe, 1)} className="text-[24px]" style={{ color: rpeColor(avgRpe) }} />
                          <div className="text-[10px] font-bold uppercase tracking-widest text-ink-muted">TL {fmt(avgTl)}</div>
                        </div>
                        <ChevronRight size={18} className="text-ink-faint" />
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </>
        ) : (
          <>
            <div className="mt-4 flex items-center justify-between gap-3 rounded-2xl border border-line bg-surface p-3">
              <div className="text-[13px] leading-snug text-ink-muted">
                <b className="text-ink">Media mobile</b>
                <br />
                ultimi giorni di calendario
              </div>
              <div className="flex items-center gap-2">
                <Button size="icon" aria-label="Meno giorni" icon={<Minus size={18} />} onClick={() => changeWindow(-1)} />
                <Num value={windowDays} className="w-10 text-center text-[28px]" />
                <Button size="icon" aria-label="Più giorni" icon={<Plus size={18} />} onClick={() => changeWindow(1)} />
              </div>
            </div>

            {!selected ? (
              <>
                <SectionTitle>Squadra · ultimo Work Load</SectionTitle>
                {!loadEntries.some((e) => e.rpe != null) ? (
                  <div className="rounded-2xl border border-dashed border-line p-5 text-center text-sm text-ink-muted">Ancora nessun RPE inserito.</div>
                ) : (
                  <div className="stagger space-y-2">
                    {overview.map(({ p, last, latest, answered }) => {
                      const z = acwrZone(latest?.acwr ?? null);
                      return (
                        <button key={p.id} onClick={() => (haptic.tap(), setAthlete(p.id!))} className="card pressable flex w-full items-center gap-3 p-3 text-left">
                          <span className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-full bg-surface-3 font-display font-bold">
                            {p.photo ? <img src={p.photo} alt="" className="h-full w-full object-cover" /> : p.number || '–'}
                          </span>
                          <div className="min-w-0 flex-1">
                            <b className="block truncate text-[15px]">
                              <span className="text-brand-text">{p.number}</span> {p.name}
                            </b>
                            <span className="text-[12px] text-ink-muted">
                              Ultimo TL {fmt(last?.tl)} · media {fmt(latest?.rolAvg)} · {answered} sedute
                            </span>
                          </div>
                          <div className="text-right">
                            <Num value={fmt(latest?.acwr, 2)} className="text-[24px]" />
                            {z && <div className={cx('mt-0.5 rounded px-1.5 text-[10px] font-bold uppercase', ZONE[z].cls)}>{ZONE[z].label}</div>}
                          </div>
                          <ChevronRight size={18} className="text-ink-faint" />
                        </button>
                      );
                    })}
                  </div>
                )}
              </>
            ) : (
              <>
                <div className="mb-2 mt-5 flex items-center gap-2">
                  <button onClick={() => setAthlete(null)} aria-label="Torna alla squadra" className="grid h-11 w-11 place-items-center rounded-full bg-white/5 active:scale-90">
                    <ChevronLeft size={22} />
                  </button>
                  <div className="min-w-0 flex-1">
                    <b className="block truncate text-[18px]">
                      <span className="text-brand-text">{selected.number}</span> {selected.name}
                    </b>
                    <span className="text-[12px] text-ink-muted">Media personale su {windowDays} giorni · limiti 1,3 e 0,8</span>
                  </div>
                </div>
                <div className="no-scrollbar -mx-4 mb-3 flex gap-2 overflow-x-auto px-4">
                  {players.map((p) => (
                    <button key={p.id} onClick={() => (haptic.tap(), setAthlete(p.id!))} className={cx('h-9 shrink-0 rounded-full border px-3 text-[13px] font-semibold', p.id === athlete ? 'border-accent bg-accent/20' : 'border-line text-ink-muted')}>
                      {p.name.split(' ').slice(-1)[0]}
                    </button>
                  ))}
                </div>
                <LoadChart data={selSeries} />
                <SectionTitle>Giorno per giorno</SectionTitle>
                <div className="overflow-hidden rounded-2xl border border-line">
                  <table className="w-full text-[13px] tabular">
                    <thead className="bg-bar text-[11px] uppercase tracking-wider text-ink-muted">
                      <tr>
                        <th className="px-2 py-2 text-left">Data</th>
                        <th className="px-2 text-right">TL</th>
                        <th className="px-2 text-right">Media pers.</th>
                        <th className="px-2 text-right">Media squadra</th>
                        <th className="px-2 text-right">Work Load</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[...selSeries].reverse().map((d) => {
                        const z = acwrZone(d.acwr);
                        return (
                          <tr key={d.date} className="border-t border-line/60">
                            <td className="whitespace-nowrap px-2 py-1.5">{fmtMedium(d.date)}</td>
                            <td className="px-2 text-right font-bold">{fmt(d.tl)}</td>
                            <td className="px-2 text-right">{fmt(d.rolAvg, 1)}</td>
                            <td className="px-2 text-right">{fmt(d.teamRol, 1)}</td>
                            <td className="px-2 text-right">
                              <span className={cx('rounded px-1.5 py-0.5 font-bold', z ? ZONE[z].cls : 'text-ink-faint')}>{fmt(d.acwr, 2)}</span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </>
            )}
            <p className="mt-4 px-1 text-[12px] leading-relaxed text-ink-muted">
              TL = RPE × minuti. Media personale = media dei TL dell'atleta negli ultimi {windowDays} giorni; media squadra = media di tutti i TL della squadra nello stesso periodo;
              Work Load = TL del giorno ÷ media personale (senza allenamento resta il valore precedente). Formule identiche al foglio sRPE.
            </p>
          </>
        )}
        <div className="h-6" />
      </div>

      <SessionSheet session={open} players={players} entries={entries ?? []} readOnly={readOnly} onClose={() => setOpen(null)} />
      {team?.id != null && <ImportSheet open={importOpen} onClose={() => setImportOpen(false)} teamId={team.id} players={players} />}
    </>
  );
}
