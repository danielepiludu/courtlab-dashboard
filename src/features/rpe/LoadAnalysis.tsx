import { useEffect, useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, Check, ChevronLeft, ChevronDown, FileDown, Minus, Plus } from 'lucide-react';
import { Num } from '@/components/ui/Num';
import { SectionTitle } from '@/components/ui/misc';
import type { Player } from '@/db/types';
import { LOAD_CONFIG, acwrZone, athleteSeries, teamSeries, type AthleteDay, type LoadEntry } from '@/engine/load';
import { fmtLong, fmtMedium } from '@/lib/dates';
import { haptic } from '@/lib/haptics';
import { cx } from '@/lib/cx';
import { Legend, LoadPanels, SERIES, WlGauge, ZONE_COLOR } from './LoadChart';
import type { MatchLoad } from './loadReport';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/db/db';
import { useGames } from '@/db/hooks';
import { useUI } from '@/store/ui';
import { summarize } from '@/features/report/reportModel';
import { mmss } from '@/features/live/liveModel';
import { fmtInt } from '@/engine/int';
import { intColor } from '@/lib/intColor';

type Zone = 'high' | 'ok' | 'low';
const fmt = (v: number | null | undefined, d = 0) => (v == null ? '–' : v.toFixed(d).replace('.', ','));
const lim = (v: number) => String(v).replace('.', ',');
const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join('');

export const ZONE_INFO: Record<Zone, { label: string; short: string; Icon: typeof Check; color: string }> = {
  high: { label: `Sopra ${lim(LOAD_CONFIG.upperLimit)}`, short: 'Alto', Icon: ArrowUp, color: ZONE_COLOR.high },
  ok: { label: 'In zona', short: 'In zona', Icon: Check, color: ZONE_COLOR.ok },
  low: { label: `Sotto ${lim(LOAD_CONFIG.lowerLimit)}`, short: 'Basso', Icon: ArrowDown, color: ZONE_COLOR.low },
};

/** Stato del Work Load: icona + testo, mai solo colore. */
export function ZoneChip({ value, className }: { value: number | null | undefined; className?: string }) {
  const z = acwrZone(value ?? null);
  if (!z) return null;
  const { label, Icon, color } = ZONE_INFO[z];
  return (
    <span className={cx('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide', className)} style={{ color, background: `color-mix(in srgb, ${color} 16%, transparent)` }}>
      <Icon size={12} strokeWidth={3} />
      {label}
    </span>
  );
}

/** Valore del Work Load con icona dello stato (mai solo colore). */
function WlValue({ value }: { value: number | null }) {
  const z = acwrZone(value);
  const Icon = z ? ZONE_INFO[z].Icon : null;
  return (
    <span className="flex shrink-0 items-center gap-1" style={{ color: z ? ZONE_COLOR[z] : undefined }}>
      {Icon && <Icon size={14} strokeWidth={3} aria-label={ZONE_INFO[z!].label} />}
      <Num value={fmt(value, 2)} className="text-[20px] leading-none text-ink" />
    </span>
  );
}

function Metric({ color, label, value, children }: { color?: string; label: string; value: string; children?: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <div className="flex items-center gap-1 text-[11px] font-semibold text-ink-muted">
        {color && <i className="h-2 w-2 shrink-0 rounded-full" style={{ background: color }} />}
        <span className="truncate">{label}</span>
      </div>
      <div className="mt-0.5">
        <Num value={value} className="text-[22px] leading-none" />
      </div>
      {children}
    </div>
  );
}

function Toolbar({ windowDays, onChange, onExport }: { windowDays: number; onChange: (d: number) => void; onExport?: () => void }) {
  const step = 'grid h-8 w-8 place-items-center rounded-full bg-white/[.06] text-ink-muted active:scale-90';
  return (
    <div className="mt-3 flex items-center gap-2 px-1">
      <span className="text-[13px] text-ink-muted">Media mobile</span>
      <button className={step} aria-label="Meno giorni" onClick={() => onChange(-1)}>
        <Minus size={15} />
      </button>
      <span className="min-w-[44px] text-center text-[14px] font-semibold tabular">{windowDays} gg</span>
      <button className={step} aria-label="Più giorni" onClick={() => onChange(1)}>
        <Plus size={15} />
      </button>
      {onExport && (
        <button onClick={onExport} className="ml-auto flex h-9 items-center gap-1.5 rounded-full px-3 text-[13px] font-semibold text-accent-light active:scale-95">
          <FileDown size={16} /> Report
        </button>
      )}
    </div>
  );
}

export function LoadAnalysis({
  players,
  entries,
  windowDays,
  onWindowChange,
  matchDates,
  onExport,
}: {
  players: Player[];
  entries: LoadEntry<number>[];
  windowDays: number;
  onWindowChange: (d: number) => void;
  /** date delle sedute di tipo Partita (barre tratteggiate) */
  matchDates?: Set<string>;
  /** apre il report/export (con l'atleta selezionato, se c'è) */
  onExport?: (athleteId?: number) => void;
}) {
  const isMatch = (date: string) => !!matchDates?.has(date);
  const hasMatches = !!matchDates?.size;
  const games = useAthleteGames();
  const [athlete, setAthlete] = useState<number | null>(null);
  const [filter, setFilter] = useState<Zone | null>(null);
  const [day, setDay] = useState<number>(-1);
  const [showTable, setShowTable] = useState(false);

  const series = useMemo(() => {
    const m = new Map<number, AthleteDay[]>();
    for (const p of players) m.set(p.id!, athleteSeries(entries, p.id!, windowDays));
    return m;
  }, [entries, players, windowDays]);
  const team = useMemo(() => teamSeries(entries, windowDays).filter((d) => d.count > 0), [entries, windowDays]);

  const rows = useMemo(
    () =>
      players
        .map((p) => {
          const s = series.get(p.id!) ?? [];
          const last = [...s].reverse().find((d) => d.tl != null);
          const latest = s[s.length - 1];
          return { p, last, wl: latest?.acwr ?? null, rol: [...s].reverse().find((d) => d.rolAvg != null)?.rolAvg ?? null, answered: s.filter((d) => d.tl != null).length };
        })
        .filter((r) => r.answered > 0)
        .sort((a, b) => (b.wl ?? -1) - (a.wl ?? -1)),
    [players, series],
  );
  const counts = { high: 0, ok: 0, low: 0 } as Record<Zone, number>;
  for (const r of rows) {
    const z = acwrZone(r.wl);
    if (z) counts[z]++;
  }

  const selected = athlete != null ? players.find((p) => p.id === athlete) : undefined;
  const selSeries = athlete != null ? (series.get(athlete) ?? []) : [];
  const chartLen = selected ? selSeries.length : team.length;
  // giorno selezionato: l'ultimo, quando cambia atleta o i dati
  useEffect(() => setDay(chartLen - 1), [athlete, chartLen]);
  const di = Math.min(Math.max(day, 0), chartLen - 1);

  if (!rows.length) return <div className="mt-4 rounded-2xl border border-dashed border-line p-5 text-center text-sm text-ink-muted">Ancora nessun RPE inserito.</div>;

  const pick = (i: number) => (haptic.select(), setDay(i));

  if (!selected) {
    const t = team[di];
    const visible = filter ? rows.filter((r) => acwrZone(r.wl) === filter) : rows;
    return (
      <>
        <Toolbar windowDays={windowDays} onChange={onWindowChange} onExport={onExport && (() => onExport())} />

        <div className="mt-3 grid grid-cols-3 gap-2">
          {(['high', 'ok', 'low'] as Zone[]).map((z) => {
            const { label, Icon, color } = ZONE_INFO[z];
            const on = filter === z;
            return (
              <button
                key={z}
                onClick={() => (haptic.tap(), setFilter(on ? null : z))}
                aria-pressed={on}
                className={cx('flex items-center gap-2 rounded-xl px-2.5 py-2 text-left transition active:scale-95', on ? 'ring-1' : 'bg-surface')}
                style={on ? { background: `color-mix(in srgb, ${color} 16%, transparent)`, ['--tw-ring-color' as string]: color } : undefined}
              >
                <Icon size={16} strokeWidth={3} style={{ color }} className="shrink-0" />
                <Num value={counts[z]} className="text-[22px] leading-none" />
                <span className="truncate text-[11px] font-semibold text-ink-muted">{label}</span>
              </button>
            );
          })}
        </div>

        <SectionTitle>Carico della squadra</SectionTitle>
        {t && (
          <p className="mb-2 px-1 text-[13px] text-ink-muted">
            <span className="first-letter:uppercase">{fmtMedium(t.date)}</span> · TL medio <b className="text-ink">{fmt(t.avg)}</b> · media <b className="text-ink">{fmt(t.teamRol)}</b> · {t.count} risposte
          </p>
        )}
        <LoadPanels days={team.map((d) => ({ date: d.date, bar: d.avg, team: d.teamRol, match: isMatch(d.date) }))} selected={di} onSelect={pick} barTitle="TL medio" />
        <Legend
          items={[
            { color: SERIES.tl, label: 'TL medio', kind: 'bar' as const },
            ...(hasMatches ? [{ color: SERIES.tl, label: 'Partita', kind: 'hatch' as const }] : []),
            { color: SERIES.team, label: `Media squadra ${windowDays} gg`, kind: 'dash' as const },
          ]}
        />

        <SectionTitle right={filter && <button onClick={() => setFilter(null)} className="h-8 rounded-full px-3 text-sm font-bold text-accent-light">Mostra tutti</button>}>
          Work Load per atleta
        </SectionTitle>
        <div className="overflow-hidden rounded-2xl bg-surface">
          {visible.map(({ p, wl }) => (
            <button key={p.id} onClick={() => (haptic.tap(), setAthlete(p.id!))} className="flex w-full items-center gap-3 border-t border-white/[.05] px-3 py-2.5 text-left first:border-t-0 active:bg-white/[.04]">
              <span className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-full bg-surface-3 font-display text-base font-bold">
                {p.photo ? <img src={p.photo} alt="" className="h-full w-full object-cover" /> : p.number || initials(p.name)}
              </span>
              <div className="min-w-0 flex-1">
                <span className="block truncate text-[15px] font-semibold">{p.name}</span>
                <WlGauge value={wl} />
              </div>
              <WlValue value={wl} />
            </button>
          ))}
          {!visible.length && <p className="p-4 text-center text-sm text-ink-muted">Nessun atleta in questa fascia.</p>}
        </div>
        <Explain windowDays={windowDays} />
      </>
    );
  }

  const d = selSeries[di];
  return (
    <>
      <div className="mb-2 mt-4 flex items-center gap-2">
        <button onClick={() => setAthlete(null)} aria-label="Torna alla squadra" className="grid h-11 w-11 place-items-center rounded-full bg-white/5 active:scale-90">
          <ChevronLeft size={22} />
        </button>
        <span className="grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-full bg-surface-3 font-display text-lg font-bold">
          {selected.photo ? <img src={selected.photo} alt="" className="h-full w-full object-cover" /> : selected.number || initials(selected.name)}
        </span>
        <div className="min-w-0 flex-1">
          <b className="block truncate text-[18px]">
            {selected.number && <span className="text-brand-text">{selected.number} </span>}
            {selected.name}
          </b>
          <span className="text-[12px] text-ink-muted">Media mobile su {windowDays} giorni</span>
        </div>
        {onExport && (
          <button onClick={() => onExport(selected.id)} aria-label="Report PDF dell'atleta" className="grid h-11 w-11 place-items-center rounded-full bg-white/5 text-accent-light active:scale-90">
            <FileDown size={20} />
          </button>
        )}
      </div>
      {d && (
        <div className="mb-3 rounded-2xl bg-surface p-3">
          <div className="mb-2 flex items-center justify-between gap-2">
            <span className="text-[13px] text-ink-muted first-letter:uppercase">{fmtLong(d.date)}</span>
            <ZoneChip value={d.acwr} />
          </div>
          <div className="grid grid-cols-4 gap-2">
            <Metric color={SERIES.tl} label="TL" value={fmt(d.tl)} />
            <Metric color={SERIES.personal} label="Media pers." value={fmt(d.rolAvg)} />
            <Metric color={SERIES.team} label="Squadra" value={fmt(d.teamRol)} />
            <Metric color={acwrZone(d.acwr) ? ZONE_COLOR[acwrZone(d.acwr)!] : undefined} label="Work Load" value={fmt(d.acwr, 2)} />
          </div>
          {d.tl == null && d.acwr != null && <p className="mt-2 text-[12px] text-ink-muted">Nessun RPE in questa data: il Work Load resta quello precedente.</p>}
        </div>
      )}
      <LoadPanels days={selSeries.map((x) => ({ date: x.date, bar: x.tl, match: isMatch(x.date), personal: x.rolAvg, team: x.teamRol, wl: x.acwr }))} selected={di} onSelect={pick} />
      <Legend
        items={[
          { color: SERIES.tl, label: 'TL', kind: 'bar' as const },
          ...(hasMatches ? [{ color: SERIES.tl, label: 'Partita', kind: 'hatch' as const }] : []),
          { color: SERIES.personal, label: 'Media personale', kind: 'line' as const },
          { color: SERIES.team, label: 'Media squadra', kind: 'dash' as const },
          { color: ZONE_COLOR.ok, label: `Zona ${lim(LOAD_CONFIG.lowerLimit)}–${lim(LOAD_CONFIG.upperLimit)}`, kind: 'band' as const },
        ]}
      />
      <AthleteGames games={games.get(selected.id!) ?? []} />

      <button onClick={() => setShowTable((v) => !v)} className="mx-auto mt-5 flex h-10 items-center gap-1.5 rounded-full px-4 text-[13px] font-semibold text-ink-muted active:scale-95">
        {showTable ? 'Nascondi' : 'Mostra'} giorno per giorno <ChevronDown size={15} className={cx('transition', showTable && 'rotate-180')} />
      </button>
      {showTable && (
      <div className="overflow-hidden rounded-2xl bg-surface">
        <table className="w-full text-[13px] tabular">
          <thead className="bg-bar text-[11px] uppercase tracking-wider text-ink-muted">
            <tr>
              <th className="px-2 py-2 text-left">Data</th>
              <th className="px-2 text-right">TL</th>
              <th className="px-2 text-right">Media pers.</th>
              <th className="px-2 text-right">Media sq.</th>
              <th className="px-2 text-right">Work Load</th>
            </tr>
          </thead>
          <tbody>
            {selSeries
              .map((x, i) => ({ x, i }))
              .reverse()
              .map(({ x, i }) => {
                const z = acwrZone(x.acwr);
                return (
                  <tr key={x.date} onClick={() => pick(i)} className={cx('border-t border-line/60', i === di && 'bg-white/[.06]')}>
                    <td className="whitespace-nowrap px-2 py-1.5">{fmtMedium(x.date)}</td>
                    <td className="px-2 text-right font-bold">{fmt(x.tl)}</td>
                    <td className="px-2 text-right">{fmt(x.rolAvg)}</td>
                    <td className="px-2 text-right">{fmt(x.teamRol)}</td>
                    <td className="px-2 text-right">
                      <span className="inline-flex items-center gap-1 font-bold">
                        {z && <i className="h-2 w-2 rounded-full" style={{ background: ZONE_COLOR[z] }} />}
                        {fmt(x.acwr, 2)}
                      </span>
                    </td>
                  </tr>
                );
              })}
          </tbody>
        </table>
      </div>
      )}
      <Explain windowDays={windowDays} />
    </>
  );
}

function Explain({ windowDays }: { windowDays: number }) {
  return (
    <details className="group mt-4 px-1 text-[12px] leading-relaxed text-ink-muted">
      <summary className="mx-auto flex h-9 w-fit cursor-pointer list-none items-center gap-1 rounded-full px-3 text-[13px] font-semibold [&::-webkit-details-marker]:hidden">
        Come si calcola? <ChevronDown size={14} className="transition group-open:rotate-180" />
      </summary>
      TL = RPE × minuti. Media personale = media dei TL dell'atleta negli ultimi {windowDays} giorni; media squadra = media di tutti i TL della squadra nello stesso periodo; Work Load = TL
      del giorno ÷ media personale (senza allenamento resta il valore precedente). Fascia ideale 0,8–1,3. Formule identiche al foglio sRPE.
    </details>
  );
}

/** Minuti e INT delle partite monitorate con la schermata live, per atleta (dalla più recente). */
function useAthleteGames(): Map<number, MatchLoad[]> {
  const teamId = useUI((x) => x.activeTeamId);
  const games = useGames();
  const reports = useLiveQuery(async () => (teamId == null ? [] : db.reports.where('teamId').equals(teamId).toArray()), [teamId]);
  return useMemo(() => {
    const m = new Map<number, MatchLoad[]>();
    const byId = new Map((games ?? []).map((g) => [g.id, g]));
    for (const r of reports ?? []) {
      const g = byId.get(r.gameId);
      if (!g) continue;
      try {
        for (const p of summarize(r).players) {
          const list = m.get(p.id) ?? [];
          list.push({ date: g.date, opponent: g.opponent, playedMs: p.playedMs, intAvg: Number.isFinite(p.intAvg) ? p.intAvg : null, intPeak: p.intPeak });
          m.set(p.id, list);
        }
      } catch {
        /* resoconto non leggibile: si salta */
      }
    }
    for (const list of m.values()) list.sort((a, b) => b.date.localeCompare(a.date));
    return m;
  }, [games, reports]);
}

function AthleteGames({ games }: { games: MatchLoad[] }) {
  if (!games.length) return null;
  const shown = games.slice(0, 6);
  return (
    <>
      <SectionTitle>Partite monitorate</SectionTitle>
      <div className="overflow-hidden rounded-2xl bg-surface">
        {shown.map((g) => (
          <div key={g.date + g.opponent} className="flex items-center gap-3 border-t border-white/[.05] px-3 py-2 first:border-t-0">
            <div className="min-w-0 flex-1">
              <b className="block truncate text-[14px]">vs {g.opponent}</b>
              <span className="text-[12px] text-ink-muted">{fmtMedium(g.date)}</span>
            </div>
            <div className="text-right">
              <Num value={g.playedMs ? mmss(g.playedMs) : '–'} className="text-[18px]" />
              <div className="text-[10px] font-bold uppercase tracking-wider text-ink-muted">minuti</div>
            </div>
            <div className="w-16 text-right">
              <Num value={g.intAvg == null ? '–' : fmtInt(g.intAvg)} className="text-[18px]" style={{ color: g.intAvg == null ? undefined : intColor(g.intAvg) }} />
              <div className="text-[10px] font-bold uppercase tracking-wider text-ink-muted">INT medio</div>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
