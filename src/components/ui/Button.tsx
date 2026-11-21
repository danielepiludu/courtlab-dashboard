import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { cx } from '@/lib/cx';
import { haptic } from '@/lib/haptics';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'accent';
type Size = 'md' | 'lg' | 'sm' | 'icon';

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-brand text-on-brand shadow-brand hover:bg-brand-strong',
  accent: 'bg-accent text-on-accent shadow-select',
  secondary: 'border border-line bg-surface-2 text-ink hover:bg-surface-3',
  ghost: 'text-ink-muted hover:bg-white/5 hover:text-ink',
  danger: 'border border-danger/40 bg-danger/10 text-danger',
};
const SIZES: Record<Size, string> = {
  sm: 'h-10 px-3.5 text-sm rounded-xl gap-1.5',
  md: 'h-12 px-4 text-[15px] rounded-xl gap-2',
  lg: 'h-14 px-6 text-lg rounded-2xl gap-2.5',
  icon: 'h-11 w-11 rounded-full',
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  icon?: ReactNode;
  /** vibrazione al tocco (default: true) */
  haptics?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'secondary', size = 'md', icon, haptics = true, className, children, onClick, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type="button"
      onClick={(e) => {
        if (haptics) haptic.tap();
        onClick?.(e);
      }}
      className={cx(
        'inline-flex select-none items-center justify-center font-semibold transition duration-150 ease-out active:scale-[0.96] disabled:pointer-events-none disabled:opacity-40',
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
      {...rest}
    >
      {icon}
      {children}
    </button>
  );
});
