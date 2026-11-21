import type { CSSProperties } from 'react';
import { cx } from '@/lib/cx';

/** Numero grande (cronometro, punteggio, minuti, INT) con cifre a larghezza fissa. */
export function Num({ value, className, style }: { value: string | number; className?: string; style?: CSSProperties }) {
  return (
    <span className={cx('inline-block font-display font-extrabold leading-none tabular', className)} style={style}>
      {value}
    </span>
  );
}
