import { useRef } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { MONTHS, toISODate, todayISO, weekdayMon0 } from '@/lib/dates';
import { outcomeOf, type Game } from '@/db/types';
import { haptic } from '@/lib/haptics';
import { cx } from '@/lib/cx';

interface Props {
  month: Date; // primo giorno del mese
  dir: 1 | -1;
  onMonth: (delta: 1 | -1) => void;
  onToday: () => void;
  games: Game[];
  selected: string;
  onSelect: (iso: string) => void;
}

/** Calendario mensile (lunedì primo giorno). Swipe orizzontale per cambiare mese. */
export function MonthCalendar({ month, dir, onMonth, onToday, games, selected, onSelect }: Props) {
  const today = todayISO();
  const y = month.getFullYear();
  const m = month.getMonth();
  const lead = weekdayMon0(month);
  const days = new Date(y, m + 1, 0).getDate();
  const cells = [...Array<null>(lead).fill(null), ...Array.from({ length: days }, (_, i) => i + 1)];
  while (cells.length % 7) cells.push(null);
  const byDate = new Map<string, Game[]>();
  for (const g of games) byDate.set(g.date, [...(byDate.get(g.date) ?? []), g]);
  const touch = useRef<{ x: number; y: number } | null>(null);
  const isCurrentMonth = today.slice(0, 7) === toISODate(month).slice(0, 7);

  return (
    <section
      className="card overflow-hidden p-3"
      onTouchStart={(e) => (touch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY })}
      onTouchEnd={(e) => {
        const s = touch.current;
        touch.current = null;
        if (!s) return;
        const dx = e.changedTouches[0].clientX - s.x;
        const dy = e.changedTouches[0].clientY - s.y;
        if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) onMonth(dx < 0 ? 1 : -1);
      }}
    >
      <div className="mb-2 flex items-center gap-1">
        <button onClick={() => onMonth(-1)} aria-label="Mese precedente" className="grid h-11 w-11 place-items-center rounded-full text-ink-muted transition hover:bg-white/5 active:scale-90">
          <ChevronLeft size={22} />
        </button>
        <div className="flex-1 text-center font-display text-xl font-bold uppercase tracking-[0.12em]">
          {MONTHS[m]} <span className="text-ink-muted">{y}</span>
        </div>
        <button onClick={() => onMonth(1)} aria-label="Mese successivo" className="grid h-11 w-11 place-items-center rounded-full text-ink-muted transition hover:bg-white/5 active:scale-90">
          <ChevronRight size={22} />
        </button>
      </div>
      <div className="grid grid-cols-7 pb-1 text-center text-[11px] font-bold uppercase tracking-wider text-ink-faint">
        {['L', 'M', 'M', 'G', 'V', 'S', 'D'].map((d, i) => (
          <span key={i} className={i === 6 ? 'text-brand-text/70' : undefined}>
            {d}
          </span>
        ))}
      </div>
      <div key={`${y}-${m}`} className={cx('grid grid-cols-7 gap-1', dir > 0 ? 'anim-slide-l' : 'anim-slide-r')}>
        {cells.map((d, i) => {
          if (d === null) return <span key={i} className="h-12" />;
          const iso = toISODate(new Date(y, m, d));
          const gs = byDate.get(iso) ?? [];
          const isSel = iso === selected;
          const isToday = iso === today;
          return (
            <button
              key={i}
              onClick={() => {
                haptic.tap();
                onSelect(iso);
              }}
              className={cx(
                'relative flex h-12 flex-col items-center justify-center rounded-xl text-[15px] font-semibold transition duration-150 active:scale-90',
                isSel ? 'bg-accent text-on-accent shadow-select' : gs.length ? 'bg-bar text-ink' : 'text-ink-muted hover:bg-white/5',
                isToday && !isSel && 'ring-1 ring-inset ring-accent text-ink',
              )}
            >
              {d}
              {gs.length > 0 && (
                <span className="absolute bottom-1.5 flex gap-0.5">
                  {gs.slice(0, 3).map((g) => (
                    <i
                      key={g.id}
                      className={cx(
                        'h-1.5 w-1.5 rounded-full',
                        g.status === 'finished' ? (outcomeOf(g) === 'W' ? 'bg-ok' : 'bg-ink-muted') : isSel ? 'bg-on-accent' : 'bg-brand',
                      )}
                    />
                  ))}
                </span>
              )}
            </button>
          );
        })}
      </div>
      <div className="mt-2 flex items-center justify-between px-1 text-[11px] text-ink-muted">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1.5"><i className="h-1.5 w-1.5 rounded-full bg-brand" />In programma</span>
          <span className="flex items-center gap-1.5"><i className="h-1.5 w-1.5 rounded-full bg-ok" />Vinta</span>
          <span className="flex items-center gap-1.5"><i className="h-1.5 w-1.5 rounded-full bg-ink-muted" />Persa</span>
        </div>
        {!isCurrentMonth && (
          <button onClick={onToday} className="h-8 rounded-full px-3 font-bold text-accent-light active:scale-95">
            Oggi
          </button>
        )}
      </div>
    </section>
  );
}
