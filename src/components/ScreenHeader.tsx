import type { ReactNode } from 'react';
import { Archive } from 'lucide-react';
import { cx } from '@/lib/cx';
import { useActiveTeam } from '@/db/hooks';
import { setTeamArchived } from '@/db/repo';
import { haptic } from '@/lib/haptics';
import { toast } from '@/store/feedback';

/** Header sticky (colore "bar" della squadra) delle schermate del primo substrato. */
export function ScreenHeader({ title, subtitle, left, right, className }: { title?: ReactNode; subtitle?: ReactNode; left?: ReactNode; right?: ReactNode; className?: string }) {
  const team = useActiveTeam();
  return (
    <header
      className={cx('sticky top-0 z-30 border-b border-white/5 bg-bar/95 shadow-[0_10px_30px_-18px_rgba(0,0,0,.9)] backdrop-blur', className)}
      style={{ paddingTop: 'var(--safe-top)' }}
    >
      <div className="mx-auto flex h-16 max-w-2xl items-center gap-3 px-4">
        {left}
        {(title || subtitle) && (
          <div className="min-w-0 flex-1">
            <h1 className="truncate font-display text-[26px] font-bold leading-none tracking-wide">{title}</h1>
            {subtitle && <div className="mt-1 truncate text-[13px] font-medium text-ink-muted">{subtitle}</div>}
          </div>
        )}
        {right}
      </div>
      {team?.archived && (
        <div className="anim-fade border-t border-white/5 bg-warn/15">
          <div className="mx-auto flex min-h-[44px] max-w-2xl items-center gap-2.5 px-4 py-1.5 text-[13px] font-semibold text-warn">
            <Archive size={16} className="shrink-0" />
            <span className="flex-1">Stagione archiviata · sola lettura</span>
            <button
              className="h-9 rounded-full bg-warn/20 px-3 font-bold active:scale-95"
              onClick={async () => {
                await setTeamArchived(team.id!, false);
                haptic.confirm();
                toast('Squadra riattivata', 'success');
              }}
            >
              Riattiva
            </button>
          </div>
        </div>
      )}
    </header>
  );
}
