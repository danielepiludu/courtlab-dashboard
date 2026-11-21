import type { ReactNode } from 'react';
import { cx } from '@/lib/cx';
import { haptic } from '@/lib/haptics';

interface ChipProps {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
  className?: string;
  disabled?: boolean;
}

export function Chip({ active, onClick, children, className, disabled }: ChipProps) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => {
        haptic.tap();
        onClick();
      }}
      className={cx(
        'inline-flex h-11 shrink-0 items-center gap-1.5 rounded-full border px-4 text-sm font-semibold transition duration-150 active:scale-95 disabled:opacity-40',
        active ? 'border-accent bg-accent/20 text-ink shadow-select-sm' : 'border-line bg-surface text-ink-muted',
        className,
      )}
    >
      {children}
    </button>
  );
}

interface SegmentedProps<T extends string> {
  value: T;
  options: { value: T; label: ReactNode }[];
  onChange: (v: T) => void;
  className?: string;
}

/** Selettore a segmenti con indicatore animato. */
export function Segmented<T extends string>({ value, options, onChange, className }: SegmentedProps<T>) {
  const idx = Math.max(0, options.findIndex((o) => o.value === value));
  return (
    <div className={cx('relative grid rounded-xl border border-line bg-night/60 p-1', className)} style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0,1fr))` }}>
      <div
        className="absolute bottom-1 top-1 rounded-lg bg-accent shadow-select transition-transform duration-300 ease-out"
        style={{ width: `calc((100% - 8px) / ${options.length})`, transform: `translateX(${idx * 100}%)`, left: 4 }}
      />
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => {
            if (o.value !== value) haptic.tap();
            onChange(o.value);
          }}
          className={cx('relative z-10 flex h-11 items-center justify-center gap-1.5 rounded-lg text-sm font-bold transition-colors', o.value === value ? 'text-on-accent' : 'text-ink-muted')}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
