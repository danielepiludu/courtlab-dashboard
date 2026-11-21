import type { CSSProperties } from 'react';
import { cx } from '@/lib/cx';

/**
 * Numero "da tabellone" nel font Teko: ogni cifra sta in una casella di larghezza fissa,
 * così cronometro, minuti e INT non "ballano" mentre cambiano.
 */
export function Num({ value, className, style, digit = 0.5 }: { value: string | number; className?: string; style?: CSSProperties; digit?: number }) {
  const text = String(value);
  return (
    <span className={cx('inline-flex items-baseline font-score leading-[0.8]', className)} style={style} aria-label={text}>
      {[...text].map((ch, i) =>
        /\d/.test(ch) ? (
          <span key={i} className="inline-block text-center" style={{ width: `${digit}em` }} aria-hidden>
            {ch}
          </span>
        ) : (
          <span key={i} className="inline-block text-center" style={{ width: ch === ' ' ? '0.25em' : '0.26em' }} aria-hidden>
            {ch}
          </span>
        ),
      )}
    </span>
  );
}
