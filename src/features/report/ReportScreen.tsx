import { surnameFirst } from '@/db/types';
import { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { Clock3, FileDown, MapPin, Plane, Repeat, Share2, Timer, Trash, TrendingUp, X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Segmented } from '@/components/ui/Chip';
import { Num } from '@/components/ui/Num';
import { TeamLogo } from '@/components/TeamLogo';
import { useMountTransition } from '@/components/ui/Sheet';
import { db } from '@/db/db';
import { fmtInt } from '@/engine/int';
import { useBackClose } from '@/lib/backNav';
import { fmtLong } from '@/lib/dates';
import { haptic } from '@/lib/haptics';
import { cx } from '@/lib/cx';
import { toast } from '@/store/feedback';
import { useUI } from '@/store/ui';
import { teamLogoSrc } from '@/theme/apply';
import { mmss } from '@/features/live/liveModel';
import { IntBar, intColor } from '@/features/live/PlayerCards';
import { IntSparkline, type PeriodSpan } from './IntSparkline';
import { askDeleteGame } from './deleteGame';
import { summarize, type PlayerSummary } from './reportModel';
import { exportReportPdf, logoForPdf } from './pdf';

type SortKey = 'minutes' | 'peak' | 'avg' | 'number';
const OUTCOME = { W: 'Vittoria', L: 'Sconfitta', D: 'Pareggio' } as const;

function Leader({ icon, label, p, value, photo }: { icon: React.ReactNode; label: string; p?: PlayerSummary; value: string; photo?: string }) {
  return (
    <div className="card flex min-w-0 items-center gap-3 p-3">
      <div className="relative shrink-0">
        <div className="grid h-12 w-12 place-items-center overflow-hidden rounded-full bg-gradient-to-br from-bar to-surface-3 font-display text-lg font-bold ring-2 ring-white/10">
          {photo ? <img src={photo} alt="" className="h-full w-full object-cover" /> : p ? p.number : '–'}
        </div>
        <span className="absolute -bottom-1 -right-1 grid h-6 w-6 place-items-center rounded-full bg-accent text-on-accent ring-2 ring-surface">{icon}</span>
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[10.5px] font-bold uppercase tracking-widest text-ink-muted">{label}</div>
        <div className="truncate text-[14px] font-bold">{p ? `#${p.number} ${surnameFirst(p.name)}` : '—'}</div>
      </div>
      <Num value={value} className="text-[26px]" />
    </div>
  );
}

function PlayerRow({ p, photo, durationMs, marks, spans }: { p: PlayerSummary; photo?: string; durationMs: number; marks: { t: number; label: string }[]; spans: PeriodSpan[] }) {
  const peakC = intColor(p.intPeak);
  const avgC = intColor(p.intAvg);
  return (
    <div className="card grid gap-x-4 gap-y-2 p-3 sm:grid-cols-[minmax(170px,1.1fr)_minmax(250px,1.4fr)_minmax(160px,1fr)] sm:items-center">
      <div className="flex min-w-0 items-center gap-3">
        <div className="relative shrink-0">
          <div className="grid h-11 w-11 place-items-center overflow-hidden rounded-full bg-gradient-to-br from-bar to-surface-3 font-display font-bold ring-2 ring-white/10">
            {photo ? <img src={photo} alt="" className="h-full w-full object-cover" /> : p.name.slice(0, 2).toUpperCase()}
          </div>
          <span className="absolute -bottom-1 -right-1.5 grid h-[22px] min-w-[22px] place-items-center rounded-full bg-brand px-1 font-display text-[13px] font-extrabold leading-none text-on-brand ring-2 ring-surface">{p.number || '–'}</span>
        </div>
        <div className="min-w-0">
          <b className="block truncate text-[15px] leading-tight">{surnameFirst(p.name)}</b>
          <div className="mt-0.5 flex items-center gap-1.5 text-[11px] font-bold text-ink-muted">
            <span className="rounded bg-accent/15 px-1.5 text-accent-light">{p.role}</span>
            {p.starter && <span className="rounded bg-white/10 px-1.5">Titolare</span>}
            {p.playedMs === 0 && <span className="rounded bg-white/5 px-1.5 text-ink-faint">Non entrato</span>}
          </div>
        </div>
      </div>
      <div className="grid grid-cols-4 gap-1.5">
        <div className="rounded-lg bg-black/30 px-2 py-1.5 ring-1 ring-white/5">
          <div className="text-[9.5px] font-bold uppercase text-ink-muted">Minuti</div>
          <Num value={mmss(p.playedMs)} className="text-[20px]" />
        </div>
        <div className="rounded-lg bg-black/30 px-2 py-1.5 ring-1 ring-white/5">
          <div className="text-[9.5px] font-bold uppercase text-ink-muted">Ingressi</div>
          <Num value={p.entries} className="text-[20px]" />
        </div>
        <div className="rounded-lg bg-black/30 px-2 py-1.5 ring-1 ring-white/5">
          <div className="text-[9.5px] font-bold uppercase text-ink-muted">INT medio</div>
          <Num value={Number.isNaN(p.intAvg) ? '–' : fmtInt(p.intAvg)} className="text-[20px]" style={{ color: avgC }} />
        </div>
        <div className="rounded-lg bg-black/30 px-2 py-1.5 ring-1 ring-white/5">
          <div className="text-[9.5px] font-bold uppercase text-ink-muted">INT picco</div>
          <Num value={fmtInt(p.intPeak)} className="text-[20px]" style={{ color: peakC, textShadow: p.intPeak > 0.6 ? `0 0 10px ${peakC}` : undefined }} />
        </div>
      </div>
      <IntSparkline series={p.series} durationMs={durationMs} marks={marks} spans={spans} height={46} className="block" />
    </div>
  );
}

/** Resoconto finale di una partita (aperto a fine partita o dalla tab Resoconti). */
export function ReportScreen() {
  const gameId = useUI((s) => s.reportGameId);
  const close = useUI((s) => s.closeReport);
  const open = gameId != null;
  const { mounted, shown } = useMountTransition(open, 260);
  useBackClose(open, close);
  const [sort, setSort] = useState<SortKey>('minutes');
  const [busy, setBusy] = useState(false);

  const data = useLiveQuery(async () => {
    if (gameId == null) return null;
    const [report, game] = await Promise.all([db.reports.get(gameId), db.games.get(gameId)]);
    const team = await db.teams.get(report?.teamId ?? game?.teamId ?? -1);
    const photos = report ? await db.players.bulkGet(report.players.map((p) => p.id)) : [];
    return { report, game, team, photos: Object.fromEntries(photos.filter(Boolean).map((p) => [p!.id!, p!.photo])) as Record<number, string | undefined> };
  }, [gameId]);

  const summary = useMemo(() => (data?.report ? summarize(data.report) : null), [data?.report]);
  const players = useMemo(() => {
    if (!summary) return [];
    const list = [...summary.players];
    if (sort === 'peak') list.sort((a, b) => b.intPeak - a.intPeak);
    if (sort === 'avg') list.sort((a, b) => (b.intAvg || 0) - (a.intAvg || 0));
    if (sort === 'number') list.sort((a, b) => Number(a.number || 999) - Number(b.number || 999));
    return list;
  }, [summary, sort]);

  if (!mounted) return null;
  const { game, team } = data ?? {};

  const doExport = async (mode: 'download' | 'share') => {
    if (!summary || !game || !team || busy) return;
    setBusy(true);
    haptic.select();
    try {
      const logo = await logoForPdf(teamLogoSrc(team));
      const r = await exportReportPdf({ summary, team, game, logo }, mode);
      toast(r === 'shared' ? 'PDF condiviso' : 'PDF salvato nei download', 'success');
    } catch (e) {
      if ((e as Error)?.name !== 'AbortError') toast('Esportazione PDF non riuscita', 'error');
    } finally {
      setBusy(false);
    }
  };

  const canShare = typeof navigator !== 'undefined' && 'canShare' in navigator;
  const left = game?.home ? summary?.us : summary?.them;
  const right = game?.home ? summary?.them : summary?.us;

  return createPortal(
    <div className={cx('fixed inset-0 z-50 flex flex-col bg-night transition duration-[260ms] ease-out', shown ? 'translate-y-0 opacity-100' : 'translate-y-6 opacity-0')}>
      <header className="shrink-0 border-b border-white/5 bg-bar" style={{ paddingTop: 'var(--safe-top)' }}>
        <div className="mx-auto flex h-16 max-w-5xl items-center gap-2 px-2 sm:px-4">
          <button onClick={close} aria-label="Chiudi resoconto" className="grid h-11 w-11 place-items-center rounded-full active:scale-90">
            <X size={24} />
          </button>
          <div className="min-w-0 flex-1">
            <h1 className="truncate font-display text-[24px] font-bold leading-none tracking-wide">Resoconto</h1>
            {game && <div className="mt-1 truncate text-[13px] text-ink-muted">{fmtLong(game.date)}</div>}
          </div>
          {game && !team?.archived && (
            <Button
              size="icon"
              aria-label="Elimina partita"
              onClick={async () => {
                if (await askDeleteGame(game)) close();
              }}
              icon={<Trash size={19} />}
            />
          )}
          {canShare && (
            <Button size="icon" aria-label="Condividi PDF" disabled={!summary || busy} onClick={() => doExport('share')} icon={<Share2 size={20} />} />
          )}
          <Button variant="primary" size="sm" disabled={!summary || busy} icon={<FileDown size={18} />} onClick={() => doExport('download')}>
            Esporta PDF
          </Button>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto overscroll-contain">
        <div className="mx-auto max-w-5xl px-3 pb-10 pt-4 sm:px-4" style={{ paddingBottom: 'calc(var(--safe-bottom) + 32px)' }}>
          {data === undefined ? null : !game ? (
            <div className="card p-6 text-center text-ink-muted">Partita non trovata.</div>
          ) : (
            <>
              {/* Tabellone */}
              <div className="anim-rise relative overflow-hidden rounded-3xl border border-white/5 bg-gradient-to-br from-bar via-surface to-surface p-5 shadow-card">
                <div className="flex items-center justify-center gap-3 sm:gap-6">
                  <div className="flex min-w-0 flex-1 flex-col items-center gap-2 text-center">
                    {game.home ? <TeamLogo team={team} size={56} /> : <span className="grid h-14 w-14 place-items-center rounded-full bg-white/10 font-display text-xl font-bold">{game.opponent.slice(0, 2).toUpperCase()}</span>}
                    <b className="line-clamp-2 text-[13px] leading-tight sm:text-[15px]">{game.home ? team?.name : game.opponent}</b>
                  </div>
                  <div className="flex flex-col items-center">
                    <div className="flex items-baseline gap-2">
                      <Num value={left ?? game.scoreUs ?? 0} className="text-[56px] sm:text-[72px]" />
                      <span className="font-display text-3xl text-ink-faint">–</span>
                      <Num value={right ?? game.scoreThem ?? 0} className="text-[56px] sm:text-[72px]" />
                    </div>
                    {summary && (
                      <span className={cx('mt-1 rounded-full px-3 py-1 text-[12px] font-extrabold uppercase tracking-widest', summary.outcome === 'W' ? 'bg-ok/20 text-ok' : summary.outcome === 'L' ? 'bg-brand/20 text-brand-text' : 'bg-white/10 text-ink-muted')}>
                        {OUTCOME[summary.outcome]}
                      </span>
                    )}
                  </div>
                  <div className="flex min-w-0 flex-1 flex-col items-center gap-2 text-center">
                    {!game.home ? <TeamLogo team={team} size={56} /> : <span className="grid h-14 w-14 place-items-center rounded-full bg-white/10 font-display text-xl font-bold">{game.opponent.slice(0, 2).toUpperCase()}</span>}
                    <b className="line-clamp-2 text-[13px] leading-tight sm:text-[15px]">{game.home ? game.opponent : team?.name}</b>
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-[13px] text-ink-muted">
                  <span className="flex items-center gap-1">
                    {game.home ? <MapPin size={14} /> : <Plane size={14} />} {game.home ? 'Casa' : 'Trasferta'} · ore {game.time}
                  </span>
                  {summary?.started && (
                    <>
                      <span>{summary.overtimes ? `4 quarti + ${summary.overtimes} OT` : `${summary.periods} ${summary.periods === 1 ? 'quarto' : 'quarti'}`}</span>
                      <span className="flex items-center gap-1">
                        <Timer size={14} /> {Math.round(summary.durationMs / 60_000)} min reali
                      </span>
                    </>
                  )}
                </div>
              </div>

              {!summary ? (
                <div className="mt-4 rounded-2xl border border-dashed border-line p-5 text-center text-[14px] text-ink-muted">
                  Per questa partita non ci sono dati di minuti e INT (inserita senza usare la schermata partita).
                </div>
              ) : (
                <>
                  {/* Migliori */}
                  <div className="mt-4 grid gap-2 sm:grid-cols-3">
                    <Leader icon={<Clock3 size={13} />} label="Più minuti" p={summary.leaders.minutes} value={summary.leaders.minutes ? mmss(summary.leaders.minutes.playedMs) : '–'} photo={summary.leaders.minutes && data?.photos[summary.leaders.minutes.id]} />
                    <Leader icon={<TrendingUp size={13} />} label="INT di picco" p={summary.leaders.peak} value={summary.leaders.peak ? fmtInt(summary.leaders.peak.intPeak) : '–'} photo={summary.leaders.peak && data?.photos[summary.leaders.peak.id]} />
                    <Leader icon={<Repeat size={13} />} label="Più ingressi" p={summary.leaders.entries} value={summary.leaders.entries ? String(summary.leaders.entries.entries) : '–'} photo={summary.leaders.entries && data?.photos[summary.leaders.entries.id]} />
                  </div>

                  {/* Giocatori */}
                  <div className="mb-2 mt-6 flex flex-wrap items-end justify-between gap-2 px-1">
                    <h2 className="font-display text-[13px] font-bold uppercase tracking-[0.18em] text-ink-muted">Convocati · {players.length}</h2>
                    <Segmented
                      className="w-full sm:w-[380px]"
                      value={sort}
                      onChange={setSort}
                      options={[
                        { value: 'minutes', label: 'Minuti' },
                        { value: 'peak', label: 'Picco' },
                        { value: 'avg', label: 'Medio' },
                        { value: 'number', label: 'Numero' },
                      ]}
                    />
                  </div>
                  <div className="stagger space-y-2">
                    {players.map((p) => (
                      <PlayerRow key={p.id} p={p} photo={data?.photos[p.id]} durationMs={summary.durationMs} marks={summary.periodMarks} spans={summary.periodSpans} />
                    ))}
                  </div>

                  {/* Legenda */}
                  <div className="mt-5 grid gap-3 rounded-2xl bg-surface p-4 text-[12.5px] leading-relaxed text-ink-muted sm:grid-cols-2">
                    <div>
                      <b className="text-ink">INT</b>: carico di fatica dello stint (0 fresco, 1 massimo). <b className="text-ink">Medio</b> = media sull'intera partita, campo e panchina;{' '}
                      <b className="text-ink">picco</b> = valore massimo raggiunto.
                      <IntBar value={1} height={6} style={{ marginTop: 8 }} />
                    </div>
                    <div>
                      <b className="text-ink">Grafico</b>: andamento dell'INT dall'inizio alla fine della partita. Le fasce colorate sono i momenti in campo, le linee tratteggiate l'inizio di ogni periodo.
                    </div>
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
