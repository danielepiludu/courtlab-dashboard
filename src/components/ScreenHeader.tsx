import type { ReactNode } from 'react';
import { cx } from '@/lib/cx';

/** Header navy sticky delle schermate del primo substrato. */
export function ScreenHeader({ title, subtitle, left, right, className }: { title: ReactNode; subtitle?: ReactNode; left?: ReactNode; right?: ReactNode; className?: string }) {
  return (
    <header
      className={cx('sticky top-0 z-30 border-b border-white/5 bg-navy/95 shadow-[0_10px_30px_-18px_rgba(0,0,0,.9)] backdrop-blur', className)}
      style={{ paddingTop: 'var(--safe-top)' }}
    >
      <div className="mx-auto flex h-16 max-w-2xl items-center gap-3 px-4">
        {left}
        <div className="min-w-0 flex-1">
          <h1 className="truncate font-display text-[26px] font-bold leading-none tracking-wide">{title}</h1>
          {subtitle && <div className="mt-1 truncate text-[13px] font-medium text-ink-muted">{subtitle}</div>}
        </div>
        {right}
      </div>
    </header>
  );
}
