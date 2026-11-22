import { Activity, CirclePlay, ClipboardList, House, Users } from 'lucide-react';
import { useUI, type Tab } from '@/store/ui';
import { haptic } from '@/lib/haptics';
import { cx } from '@/lib/cx';

const TABS: { id: Tab; label: string; Icon: typeof House }[] = [
  { id: 'home', label: 'Home', Icon: House },
  { id: 'players', label: 'Giocatori', Icon: Users },
  { id: 'match', label: 'Partita', Icon: CirclePlay },
  { id: 'rpe', label: 'RPE', Icon: Activity },
  { id: 'reports', label: 'Resoconti', Icon: ClipboardList },
];

export function TabBar() {
  const tab = useUI((s) => s.tab);
  const setTab = useUI((s) => s.setTab);
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-white/5 bg-bar/95 shadow-[0_-12px_30px_-16px_rgba(0,0,0,.9)] backdrop-blur"
      style={{ paddingBottom: 'var(--safe-bottom)' }}
    >
      <div className="mx-auto grid h-[var(--tabbar-h)] max-w-2xl grid-cols-5 px-1">
        {TABS.map(({ id, label, Icon }) => {
          const active = tab === id;
          return (
            <button
              key={id}
              aria-label={label}
              aria-current={active ? 'page' : undefined}
              onClick={() => {
                if (!active) haptic.tap();
                setTab(id);
                if (active) document.getElementById('tab-scroll')?.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              className="group relative flex flex-col items-center justify-center gap-1 transition active:scale-90"
            >
              <span
                className={cx(
                  'grid h-8 w-12 place-items-center rounded-full transition-all duration-300 ease-out',
                  active ? 'bg-brand/20 text-brand-text' : 'text-ink-muted',
                )}
              >
                <Icon size={22} strokeWidth={active ? 2.4 : 2} />
              </span>
              <span className={cx('text-[11px] font-semibold tracking-wide transition-colors', active ? 'text-ink' : 'text-ink-muted')}>{label}</span>
              <span className={cx('absolute top-0 h-[3px] rounded-b-full bg-brand transition-all duration-300', active ? 'w-8 opacity-100' : 'w-0 opacity-0')} />
            </button>
          );
        })}
      </div>
    </nav>
  );
}
