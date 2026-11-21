import { cx } from '@/lib/cx';
import type { PlayerStatus, Role } from '@/db/types';

export const STATUS_META: Record<PlayerStatus, { label: string; short: string; cls: string; dot: string }> = {
  available: { label: 'Disponibile', short: 'Disponibili', cls: 'bg-ok/15 text-ok border-ok/30', dot: 'bg-ok' },
  doubtful: { label: 'In dubbio', short: 'In dubbio', cls: 'bg-warn/15 text-warn border-warn/30', dot: 'bg-warn' },
  injured: { label: 'Infortunato', short: 'Infortunati', cls: 'bg-danger/15 text-danger border-danger/30', dot: 'bg-danger' },
};

export function StatusBadge({ status, className }: { status: PlayerStatus; className?: string }) {
  const m = STATUS_META[status];
  return (
    <span className={cx('inline-flex h-6 items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 text-xs font-bold', m.cls, className)}>
      <i className={cx('h-1.5 w-1.5 rounded-full', m.dot)} />
      {m.label}
    </span>
  );
}

export function RoleBadge({ role, className }: { role: Role; className?: string }) {
  return (
    <span className={cx('inline-grid h-6 min-w-[32px] place-items-center rounded-md bg-accent/15 px-1.5 font-display text-[13px] font-bold tracking-wide text-accent-light', className)}>
      {role}
    </span>
  );
}
