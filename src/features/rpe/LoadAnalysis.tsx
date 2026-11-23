import { useEffect, useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, Check, ChevronLeft, ChevronRight, FileDown, Minus, Plus } from 'lucide-react';
import { Button } from '@/components/ui/Button';
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

function Metric({ color, label, value, children }: { color?: string; label: string; value: string; children?: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-ink-muted">
        {color && <i className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: color }} />}
        <span className="truncate">{label}</span>
      </div>
      <div className="mt-0.5">
        <Num value={value} className="text-[28px] leading-none" />
      </div>
      {children}
    </div>
  );
}

function WindowControl({ windowDays, onChange }: { windowDays: number; onChange: (d: number) => void }) {
  return (
    <div className="mt-4 flex items-center justify-between gap-3 rounded-2xl border border-line bg-surface px-3 py-2">
      <div className="text-[13px] leading-snug text-ink-muted">
        <b className="text-ink">Media mobile</b> · giorni di calendario
      </div>
      <div className="flex items-center gap-1.5">
        <Button size="icon" aria-label="Meno giorni" icon={<Minus size={18} />} onClick={() => onChange(-1)} />
        <Num value={windowDays} className="w-9 text-center text-[26px]" />
        <Button size="icon" aria-label="Più giorni" icon={<Plus size={18} />} onClick={() => onChange(1)} />
      </div>
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
        <WindowControl windowDays={windowDays} onChange={onWindowChange} />
        {onExport && (
          <Button className="mt-2 w-full" icon={<FileDown size={18} />} onClick={() => onExport()}>
            Report PDF ed Excel
          </Button>
        )}

        <SectionTitle>Squadra oggi</SectionTitle>
        <div className="grid grid-cols-3 gap-2">
          {(['high', 'ok', 'low'] as Zone[]).map((z) => {
            const { label, Icon, color } = ZONE_INFO[z];
            const on = filter === z;
            return (
              <button
                key={z}
                onClick={() => (haptic.tap(), setFilter(on ? null : z))}
                className={cx('pressable rounded-2xl border p-3 text-left', on ? 'shadow-glow' : 'border-line bg-surface')}
                style={on ? { borderColor: color, background: `color-mix(in srgb, ${color} 14%, var(--c-surface))` } : undefined}
              >
                <span className="grid h-7 w-7 place-items-center rounded-full" style={{ background: `color-mix(in srgb, ${color} 20%, transparent)`, color }}>
                  <Icon size={16} strokeWidth={3} />
                </span>
                <div className="mt-1.5">
                  <Num value={counts[z]} className="text-[30px] leading-none" />
                </div>
                <div className="text-[11px] font-bold uppercase tracking-wider text-ink-muted">{label}</div>
              </button>
            );
          })}
        </div>

        <SectionTitle>Carico della squadra</SectionTitle>
        {t && (
          <div className="mb-3 rounded-2xl border border-line bg-surface p-3">
            <div className="mb-2 text-[13px] font-semibold text-ink-muted first-letter:uppercase">{fmtLong(t.date)}</div>
            <div className="grid grid-cols-3 gap-3">
              <Metric color={SERIES.tl} label="TL medio" value={fmt(t.avg)} />
              <Metric color={SERIES.team} label="Media squadra" value={fmt(t.teamRol)} />
              <Metric label="Risposte" value={String(t.count)} />
            </div>
          </div>
        )}
        <Legend
          items={[
            { color: SERIES.tl, label: 'TL medio del giorno', kind: 'bar' as const },
            ...(hasMatches ? [{ color: SERIES.tl, label: 'Partita', kind: 'hatch' as const }] : []),
            { color: SERIES.team, label: `Media squadra ${windowDays} gg`, kind: 'dash' as const },
          ]}
        />
        <LoadPanels days={team.map((d) => ({ date: d.date, bar: d.avg, team: d.teamRol, match: isMatch(d.date) }))} selected={di} onSelect={pick} barTitle="TL medio" />

        <SectionTitle right={filter && <button onClick={() => setFilter(null)} className="h-8 rounded-full px-3 text-sm font-bold text-accent-light">Mostra tutti</button>}>
          Atleti · Work Load
        </SectionTitle>
        <div className="stagger space-y-2">
          {visible.map(({ p, last, wl, rol }) => (
            <button key={p.id} onClick={() => (haptic.tap(), setAthlete(p.id!))} className="card pressable flex w-full items-center gap-3 p-3 text-left">
              <span className="grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-full bg-surface-3 font-display text-lg font-bold">
                {p.photo ? <img src={p.photo} alt="" className="h-full w-full object-cover" /> : p.number || initials(p.name)}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <b className="truncate text-[15px]">
                    {p.number && <span className="text-brand-text">{p.number} </span>}
                    {p.name}
                  </b>
                  <Num value={fmt(wl, 2)} className="shrink-0 text-[22px] leading-none" />
                </div>
                <WlGauge value={wl} />
                <div className="mt-1.5 flex items-center justify-between gap-2 text-[12px] text-ink-muted">
                  <span className="truncate">
                    Ultimo TL <b className="text-ink">{fmt(last?.tl)}</b> · media <b className="text-ink">{fmt(rol)}</b>
                  </span>
                  <ZoneChip value={wl} />
                </div>
              </div>
              <ChevronRight size={18} className="shrink-0 text-ink-faint" />
            </button>
          ))}
          {!visible.length && <div className="rounded-2xl border border-dashed border-line p-4 text-center text-sm text-ink-muted">Nessun atleta in questa fascia.</div>}
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
      <div className="no-scrollbar -mx-4 mb-3 flex gap-2 overflow-x-auto px-4">
        {rows.map(({ p }) => (
          <button
            key={p.id}
            onClick={() => (haptic.tap(), setAthlete(p.id!))}
            className={cx('h-9 shrink-0 rounded-full border px-3 text-[13px] font-semibold', p.id === athlete ? 'border-accent bg-accent/20 text-ink' : 'border-line text-ink-muted')}
          >
            {p.name.split(' ').slice(-1)[0]}
          </button>
        ))}
      </div>

      {d && (
        <div className="mb-3 rounded-2xl border border-line bg-surface p-3">
          <div className="mb-2 flex items-center justify-between gap-2">
            <span className="text-[13px] font-semibold text-ink-muted first-letter:uppercase">{fmtLong(d.date)}</span>
            <ZoneChip value={d.acwr} />
          </div>
          <div className="grid grid-cols-2 gap-x-3 gap-y-3 sm:grid-cols-4">
            <Metric color={SERIES.tl} label="TL del giorno" value={fmt(d.tl)} />
            <Metric color={SERIES.personal} label="Media personale" value={fmt(d.rolAvg)} />
            <Metric color={SERIES.team} label="Media squadra" value={fmt(d.teamRol)} />
            <Metric color={acwrZone(d.acwr) ? ZONE_COLOR[acwrZone(d.acwr)!] : undefined} label="Work Load" value={fmt(d.acwr, 2)} />
          </div>
          {d.tl == null && d.acwr != null && <p className="mt-2 text-[12px] text-ink-muted">Nessun RPE in questa data: il Work Load resta quello precedente.</p>}
        </div>
      )}
      <Legend
        items={[
          { color: SERIES.tl, label: 'TL', kind: 'bar' as const },
          ...(hasMatches ? [{ color: SERIES.tl, label: 'Partita', kind: 'hatch' as const }] : []),
          { color: SERIES.personal, label: 'Media personale', kind: 'line' as const },
          { color: SERIES.team, label: 'Media squadra', kind: 'dash' as const },
          { color: ZONE_COLOR.ok, label: `Zona ${lim(LOAD_CONFIG.lowerLimit)}–${lim(LOAD_CONFIG.upperLimit)}`, kind: 'band' as const },
        ]}
      />
      <LoadPanels days={selSeries.map((x) => ({ date: x.date, bar: x.tl, match: isMatch(x.date), personal: x.rolAvg, team: x.teamRol, wl: x.acwr }))} selected={di} onSelect={pick} />
      <AthleteGames games={games.get(selected.id!) ?? []} />

      <SectionTitle>Giorno per giorno</SectionTitle>
      <div className="overflow-hidden rounded-2xl border border-line">
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
      <Explain windowDays={windowDays} />
    </>
  );
}

function Explain({ windowDays }: { windowDays: number }) {
  return (
    <p className="mt-4 px-1 text-[12px] leading-relaxed text-ink-muted">
      TL = RPE × minuti. Media personale = media dei TL dell'atleta negli ultimi {windowDays} giorni; media squadra = media di tutti i TL della squadra nello stesso periodo; Work Load = TL
      del giorno ÷ media personale (senza allenamento resta il valore precedente). Formule identiche al foglio sRPE.
    </p>
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
      <div className="overflow-hidden rounded-2xl border border-line">
        {shown.map((g) => (
          <div key={g.date + g.opponent} className="flex items-center gap-3 border-t border-line/60 px-3 py-2 first:border-t-0">
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
