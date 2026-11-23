import { useLiveQuery } from 'dexie-react-hooks';
import { BarChart3, ChevronRight, ClipboardList, MapPin, Plane, Trash } from 'lucide-react';
import { ScreenHeader } from '@/components/ScreenHeader';
import { EmptyState } from '@/components/ui/misc';
import { Num } from '@/components/ui/Num';
import { db } from '@/db/db';
import { useActiveTeam, useGames } from '@/db/hooks';
import { OUTCOME_LABEL, outcomeOf, type Game } from '@/db/types';
import { fmtMedium } from '@/lib/dates';
import { haptic } from '@/lib/haptics';
import { cx } from '@/lib/cx';
import { useUI } from '@/store/ui';
import { OutcomePill } from '../home/GameRow';
import { askDeleteGame } from '../report/deleteGame';

function ReportRow({ g, hasData, onClick }: { g: Game; hasData: boolean; onClick: () => void }) {
  const o = outcomeOf(g);
  return (
    <button onClick={onClick} className="card pressable relative flex w-full items-center gap-3 overflow-hidden p-3.5 pl-5 text-left">
      <span className={cx('absolute inset-y-0 left-0 w-1.5', o === 'W' ? 'bg-ok' : o === 'L' ? 'bg-brand' : 'bg-ink-faint')} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 text-[12px] font-semibold uppercase tracking-wider text-ink-muted">
          {fmtMedium(g.date)}
          {g.home ? <MapPin size={12} /> : <Plane size={12} />}
        </div>
        <div className="mt-0.5 truncate text-[18px] font-bold">
          <span className="mr-1 text-ink-muted">{g.home ? 'vs' : '@'}</span>
          {g.opponent}
        </div>
        <div className="mt-0.5 flex items-center gap-2 text-[13px] font-semibold">
          <span className={o === 'W' ? 'text-ok' : o === 'L' ? 'text-brand-text' : 'text-ink-muted'}>{OUTCOME_LABEL[o]}</span>
          {hasData && (
            <span className="flex items-center gap-1 rounded-full bg-accent/15 px-2 text-[11px] text-accent-light">
              <BarChart3 size={12} /> Minuti e INT
            </span>
          )}
        </div>
      </div>
      <div className="flex items-baseline gap-1">
        {/* sempre "noi – loro" */}
        <Num value={g.scoreUs ?? 0} className="text-[30px]" />
        <span className="text-ink-faint">–</span>
        <Num value={g.scoreThem ?? 0} className="text-[30px] text-ink-muted" />
      </div>
      <OutcomePill game={g} />
      <ChevronRight size={18} className="-ml-1 text-ink-faint" />
    </button>
  );
}

export function ReportsScreen() {
  const games = useGames();
  const team = useActiveTeam();
  const readOnly = !!team?.archived;
  const openReport = useUI((s) => s.openReport);
  const finished = (games ?? []).filter((g) => g.status === 'finished').reverse();
  const withData = useLiveQuery(async () => new Set((await db.reports.where('teamId').equals(team?.id ?? -1).primaryKeys()) as number[]), [team?.id]) ?? new Set<number>();
  const w = finished.filter((g) => outcomeOf(g) === 'W').length;
  const l = finished.filter((g) => outcomeOf(g) === 'L').length;
  const avg = (k: 'scoreUs' | 'scoreThem') => (finished.length ? Math.round(finished.reduce((s, g) => s + (g[k] ?? 0), 0) / finished.length) : 0);

  return (
    <>
      <ScreenHeader title="Resoconti" subtitle={team ? `${team.name} · ${team.season}` : 'Storico delle partite concluse'} />
      <div className="mx-auto max-w-2xl px-4 pt-4">
        {games === undefined ? null : finished.length === 0 ? (
          <EmptyState icon={<ClipboardList size={30} />} title="Nessun resoconto" text="Al termine di ogni partita il resoconto completo (minuti, INT, grafici, PDF) viene salvato qui." />
        ) : (
          <>
            <div className="mb-4 grid grid-cols-4 gap-2">
              {[
                { l: 'Partite', v: finished.length, c: 'text-ink' },
                { l: 'Vinte', v: w, c: 'text-ok' },
                { l: 'Perse', v: l, c: 'text-brand-text' },
                { l: 'Media', v: `${avg('scoreUs')}-${avg('scoreThem')}`, c: 'text-ink' },
              ].map((x) => (
                <div key={x.l} className="card px-1 py-2.5 text-center">
                  <Num value={x.v} className={cx('text-[24px]', x.c)} />
                  <div className="mt-1 text-[10px] font-semibold uppercase tracking-widest text-ink-muted">{x.l}</div>
                </div>
              ))}
            </div>
            <div className="stagger space-y-2">
              {finished.map((g) => (
                <div key={g.id} className="flex items-stretch gap-1">
                  <div className="min-w-0 flex-1">
                    <ReportRow
                      g={g}
                      hasData={withData.has(g.id!)}
                      onClick={() => {
                        haptic.tap();
                        openReport(g.id!);
                      }}
                    />
                  </div>
                  {!readOnly && (
                    <button
                      onClick={() => void askDeleteGame(g)}
                      aria-label={`Elimina la partita contro ${g.opponent}`}
                      className="grid w-9 shrink-0 place-items-center rounded-full text-ink-faint transition active:scale-90 hover:text-danger"
                    >
                      <Trash size={17} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
        <div className="h-6" />
      </div>
    </>
  );
}
