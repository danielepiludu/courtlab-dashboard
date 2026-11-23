import { useEffect, useMemo, useRef, useState } from 'react';
import { Activity, ChevronRight, FileSpreadsheet, Link2, Plus } from 'lucide-react';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Button } from '@/components/ui/Button';
import { Segmented } from '@/components/ui/Chip';
import { Num } from '@/components/ui/Num';
import { Sheet } from '@/components/ui/Sheet';
import { EmptyState, SectionTitle } from '@/components/ui/misc';
import { useActiveTeam, usePlayers, useRpeEntries, useSessions } from '@/db/hooks';
import { newSession, saveSession, toLoadEntries } from '@/db/rpeRepo';
import { SESSION_TYPE_LABEL, type Player, type Team, type TrainingSession } from '@/db/types';
import { useCloud } from '@/cloud/client';
import { publishSurvey } from '@/cloud/surveys';
import { LOAD_CONFIG, entryTL } from '@/engine/load';
import { fmtMedium, todayISO } from '@/lib/dates';
import { haptic } from '@/lib/haptics';
import { toast } from '@/store/feedback';
import { LoadAnalysis } from './LoadAnalysis';
import { ExportSheet } from './ExportSheet';
import { useSurveySync } from '@/cloud/useSurveySync';
import { SessionSheet, rpeColor } from './SessionSheet';
import { applyImport, parseSrpeRows, planImport, type ImportPlan } from './importSrpe';

const fmt = (v: number | null | undefined, d = 0) => (v == null ? '–' : v.toFixed(d).replace('.', ','));

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

// una volta per avvio: aggiorna le pagine dei link aperti (elenco, ordine e foto dei giocatori)
let linksRefreshed = false;
function useRefreshOpenLinks(sessions: TrainingSession[] | undefined, team: Team | undefined, players: Player[]) {
  const logged = useCloud((x) => !!x.session);
  useEffect(() => {
    if (linksRefreshed || !logged || !team || !players.length || !sessions) return;
    const open = sessions.filter((s) => s.surveyToken && s.surveyOpen !== false);
    if (!open.length) return;
    linksRefreshed = true;
    void Promise.all(open.map((s) => publishSurvey(s, team, players, true))).catch(() => {
      linksRefreshed = false;
    });
  }, [sessions, team, players, logged]);
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
  const [exportFor, setExportFor] = useState<{ id?: number } | null>(null);
  const [windowDays, setWindowDays] = useState(readWindow);
  useSurveySync(sessions);
  useRefreshOpenLinks(sessions, team, players);

  const sessionsAsc = useMemo(() => [...(sessions ?? [])].sort((a, b) => a.date.localeCompare(b.date)), [sessions]);
  const matchDates = useMemo(() => new Set(sessionsAsc.filter((s) => s.type === 'partita').map((s) => s.date)), [sessionsAsc]);
  const loadEntries = useMemo(() => toLoadEntries(sessionsAsc, entries ?? [], players), [sessionsAsc, entries, players]);

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
          onChange={setView}
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
                            {s.surveyToken && (
                              <span className={s.surveyOpen === false ? 'text-ink-muted' : 'text-accent-light'}>
                                {' '}
                                · <Link2 size={13} className="inline -translate-y-px" /> {s.surveyOpen === false ? 'link chiuso' : 'link aperto'}
                              </span>
                            )}
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
          <LoadAnalysis
            players={players}
            entries={loadEntries}
            windowDays={windowDays}
            onWindowChange={changeWindow}
            matchDates={matchDates}
            onExport={(id) => setExportFor({ id })}
          />
        )}
        <div className="h-6" />
      </div>

      <SessionSheet session={open ? (sessions?.find((x) => x.id === open.id) ?? open) : null} players={players} entries={entries ?? []} readOnly={readOnly} onClose={() => setOpen(null)} />
      {team?.id != null && (
        <ExportSheet
          open={!!exportFor}
          onClose={() => setExportFor(null)}
          team={team}
          players={players}
          sessions={sessions ?? []}
          entries={entries ?? []}
          windowDays={windowDays}
          athleteId={exportFor?.id}
        />
      )}
      {team?.id != null && <ImportSheet open={importOpen} onClose={() => setImportOpen(false)} teamId={team.id} players={players} />}
    </>
  );
}
