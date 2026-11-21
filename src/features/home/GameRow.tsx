import { ChevronRight, MapPin, Plane } from 'lucide-react';
import { MONTHS_SHORT, WEEKDAYS_SHORT, parseISODate, weekdayMon0 } from '@/lib/dates';
import { outcomeOf, type Game } from '@/db/types';
import { cx } from '@/lib/cx';

export function OutcomePill({ game, className }: { game: Game; className?: string }) {
  const o = outcomeOf(game);
  return (
    <span
      className={cx(
        'grid h-7 w-7 place-items-center rounded-lg font-display text-sm font-extrabold',
        o === 'W' ? 'bg-ok/20 text-ok' : o === 'L' ? 'bg-brand/20 text-brand' : 'bg-white/10 text-ink-muted',
        className,
      )}
    >
      {o === 'W' ? 'V' : o === 'L' ? 'P' : 'N'}
    </span>
  );
}

/** Riga partita: blocco data, avversario, ora/campo, risultato se conclusa. */
export function GameRow({ game, onClick }: { game: Game; onClick?: () => void }) {
  const d = parseISODate(game.date);
  const finished = game.status === 'finished';
  return (
    <button onClick={onClick} className="card pressable flex w-full items-center gap-3 p-3 text-left">
      <div className={cx('flex w-14 shrink-0 flex-col items-center rounded-xl py-1.5', finished ? 'bg-white/5' : 'bg-navy')}>
        <span className="text-[10px] font-bold uppercase tracking-widest text-ink-muted">{WEEKDAYS_SHORT[weekdayMon0(d)]}</span>
        <span className="font-display text-2xl font-bold leading-none">{d.getDate()}</span>
        <span className="text-[11px] font-semibold uppercase text-brand">{MONTHS_SHORT[d.getMonth()]}</span>
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-[17px] font-bold">
          <span className="mr-1 text-ink-muted">{game.home ? 'vs' : '@'}</span>
          {game.opponent || 'Avversario'}
        </div>
        <div className="mt-0.5 flex items-center gap-1.5 text-[13px] text-ink-muted">
          {game.home ? <MapPin size={13} /> : <Plane size={13} />}
          {game.home ? 'Casa' : 'Trasferta'} · {game.time}
          {game.status === 'live' && <span className="ml-1 rounded bg-brand px-1.5 text-[11px] font-bold text-white">LIVE</span>}
        </div>
      </div>
      {finished ? (
        <div className="flex items-center gap-2">
          <span className="font-display text-2xl font-bold tabular">
            {game.scoreUs ?? 0}
            <span className="mx-0.5 text-ink-faint">–</span>
            {game.scoreThem ?? 0}
          </span>
          <OutcomePill game={game} />
        </div>
      ) : (
        <ChevronRight size={20} className="text-ink-faint" />
      )}
    </button>
  );
}
