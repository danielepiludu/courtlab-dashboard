import type { ReactNode } from 'react';
import { cx } from '@/lib/cx';

export function Field({ label, children, hint, className }: { label: string; children: ReactNode; hint?: ReactNode; className?: string }) {
  return (
    <label className={cx('mb-4 block', className)}>
      <span className="label">{label}</span>
      {children}
      {hint && <span className="mt-1.5 block text-xs text-ink-muted">{hint}</span>}
    </label>
  );
}

export function EmptyState({ icon, title, text, action }: { icon: ReactNode; title: string; text: string; action?: ReactNode }) {
  return (
    <div className="anim-rise flex flex-col items-center rounded-3xl border border-dashed border-line bg-surface/50 px-6 py-10 text-center">
      <div className="mb-4 grid h-16 w-16 place-items-center rounded-2xl bg-navy text-accent-light">{icon}</div>
      <b className="font-display text-xl font-bold tracking-wide">{title}</b>
      <p className="mt-1 max-w-xs text-[15px] text-ink-muted">{text}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function SectionTitle({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <div className="mb-2 mt-6 flex items-end justify-between px-1">
      <h2 className="font-display text-[13px] font-bold uppercase tracking-[0.18em] text-ink-muted">{children}</h2>
      {right}
    </div>
  );
}

/** Logo del club (public/logo.png). */
export function Logo({ size = 44, className }: { size?: number; className?: string }) {
  return (
    <img
      src={`${import.meta.env.BASE_URL}logo.png`}
      width={size}
      height={size}
      alt="Pallacanestro Don Bosco Livorno"
      className={cx('shrink-0 select-none drop-shadow-[0_4px_12px_rgba(0,0,0,.5)]', className)}
      draggable={false}
    />
  );
}
