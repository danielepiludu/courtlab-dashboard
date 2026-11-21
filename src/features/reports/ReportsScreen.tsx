import { useState } from 'react';
import { ClipboardList, FileText, MapPin, Plane } from 'lucide-react';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Sheet } from '@/components/ui/Sheet';
import { EmptyState } from '@/components/ui/misc';
import { useActiveTeam, useGames } from '@/db/hooks';
import { OUTCOME_LABEL, outcomeOf, type Game } from '@/db/types';
import { fmtLong, fmtMedium } from '@/lib/dates';
import { haptic } from '@/lib/haptics';
import { cx } from '@/lib/cx';
import { OutcomePill } from '../home/GameRow';

function ReportRow({ g, onClick }: { g: Game; onClick: () => void }) {
  const o = outcomeOf(g);
  return (
    <button onClick={onClick} className="card pressable relative flex w-full items-center gap-3 overflow-hidden p-3.5 pl-5 text-left">
      <span className={cx('absolute inset-y-0 left-0 w-1.5', o === 'W' ? 'bg-ok' : o === 'L' ? 'bg-brand' : 'bg-ink-faint')} />
      <div className="min-w-0 flex-1">
        <div className="text-[12px] font-semibold uppercase tracking-wider text-ink-muted">{fmtMedium(g.date)}</div>
        <div className="mt-0.5 truncate text-[18px] font-bold">
          <span className="mr-1 text-ink-muted">{g.home ? 'vs' : '@'}</span>
          {g.opponent}
        </div>
        <div className={cx('text-[13px] font-semibold', o === 'W' ? 'text-ok' : o === 'L' ? 'text-brand-text' : 'text-ink-muted')}>{OUTCOME_LABEL[o]}</div>
      </div>
      <div className="font-display text-[32px] font-extrabold leading-none tabular">
        {g.scoreUs ?? 0}
        <span className="mx-1 text-ink-faint">–</span>
        {g.scoreThem ?? 0}
      </div>
      <OutcomePill game={g} />
    </button>
  );
}

export function ReportsScreen() {
  const games = useGames();
  const team = useActiveTeam();
  const [open, setOpen] = useState<Game | null>(null);
  const finished = (games ?? []).filter((g) => g.status === 'finished').reverse();
  const w = finished.filter((g) => outcomeOf(g) === 'W').length;
  const l = finished.filter((g) => outcomeOf(g) === 'L').length;
  const avg = (k: 'scoreUs' | 'scoreThem') => (finished.length ? Math.round(finished.reduce((s, g) => s + (g[k] ?? 0), 0) / finished.length) : 0);

  return (
    <>
      <ScreenHeader title="Resoconti" subtitle={finished.length ? `${team?.name ?? ''} · ${w}V ${l}P` : team ? `${team.name} · ${team.season}` : 'Storico delle partite concluse'} />
      <div className="mx-auto max-w-2xl px-4 pt-4">
        {games === undefined ? null : finished.length === 0 ? (
          <EmptyState icon={<ClipboardList size={30} />} title="Nessun resoconto" text="Al termine di ogni partita il resoconto completo verrà salvato qui." />
        ) : (
          <>
            <div className="mb-4 grid grid-cols-2 gap-2">
              <div className="card p-3 text-center">
                <div className="font-display text-3xl font-bold leading-none text-ink">{avg('scoreUs')}</div>
                <div className="mt-1 text-[11px] font-semibold uppercase tracking-widest text-ink-muted">Punti fatti / gara</div>
              </div>
              <div className="card p-3 text-center">
                <div className="font-display text-3xl font-bold leading-none text-ink-muted">{avg('scoreThem')}</div>
                <div className="mt-1 text-[11px] font-semibold uppercase tracking-widest text-ink-muted">Punti subiti / gara</div>
              </div>
            </div>
            <div className="stagger space-y-2">
              {finished.map((g) => (
                <ReportRow
                  key={g.id}
                  g={g}
                  onClick={() => {
                    haptic.tap();
                    setOpen(g);
                  }}
                />
              ))}
            </div>
          </>
        )}
        <div className="h-6" />
      </div>

      {/* FASE 1: anteprima. Il resoconto completo (tabella, grafici INT, PDF) arriva nella Fase 4. */}
      <Sheet open={!!open} onClose={() => setOpen(null)} title={open ? `${open.home ? 'vs' : '@'} ${open.opponent}` : ''} subtitle={open ? fmtLong(open.date) : undefined}>
        {open && (
          <>
            <div className="flex items-center justify-center gap-6 rounded-2xl bg-bar p-5">
              <div className="text-center">
                <div className="max-w-[140px] truncate text-[12px] font-bold uppercase tracking-widest text-ink-muted">{team?.name}</div>
                <div className="font-display text-6xl font-extrabold tabular">{open.scoreUs ?? 0}</div>
              </div>
              <span className="font-display text-3xl text-ink-faint">–</span>
              <div className="text-center">
                <div className="max-w-[140px] truncate text-[12px] font-bold uppercase tracking-widest text-ink-muted">{open.opponent}</div>
                <div className="font-display text-6xl font-extrabold tabular text-ink-muted">{open.scoreThem ?? 0}</div>
              </div>
            </div>
            <div className="mt-3 flex items-center justify-center gap-2 text-sm text-ink-muted">
              {open.home ? <MapPin size={14} /> : <Plane size={14} />} {open.home ? 'Casa' : 'Trasferta'} · ore {open.time}
            </div>
            <div className="mt-5 flex items-start gap-3 rounded-2xl border border-dashed border-line p-4 text-[14px] text-ink-muted">
              <FileText size={20} className="mt-0.5 shrink-0 text-accent-light" />
              Il resoconto dettagliato (minuti, INT medio e di picco, ingressi, grafici ed export PDF) sarà disponibile dalla Fase 4.
            </div>
          </>
        )}
      </Sheet>
    </>
  );
}
