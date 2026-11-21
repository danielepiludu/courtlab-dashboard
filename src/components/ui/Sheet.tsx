import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { cx } from '@/lib/cx';
import { useBackClose } from '@/lib/backNav';

/** Monta/smonta con transizione d'uscita. */
export function useMountTransition(open: boolean, ms = 240) {
  const [mounted, setMounted] = useState(open);
  const [shown, setShown] = useState(false);
  useEffect(() => {
    if (open) {
      setMounted(true);
      const r = requestAnimationFrame(() => requestAnimationFrame(() => setShown(true)));
      return () => cancelAnimationFrame(r);
    }
    setShown(false);
    const t = setTimeout(() => setMounted(false), ms);
    return () => clearTimeout(t);
  }, [open, ms]);
  return { mounted, shown };
}

/** Mantiene l'ultimo contenuto valido durante l'animazione di chiusura. */
function useLatchWhile<T>(open: boolean, value: T): T {
  const ref = useRef(value);
  if (open) ref.current = value;
  return ref.current;
}

interface SheetProps {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  subtitle?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  /** larghezza massima del pannello */
  wide?: boolean;
  /** stile del contenitore (es. variabili CSS per l'anteprima del tema) */
  style?: CSSProperties;
  /** z-index più alto, per sheet aperti sopra schermate a tutto schermo */
  elevated?: boolean;
}

/** Bottom sheet animato con header, area scrollabile e footer fisso. */
export function Sheet({ open, onClose, title, subtitle, children, footer, wide, style, elevated }: SheetProps) {
  const { mounted, shown } = useMountTransition(open);
  useBackClose(open, onClose);
  const latched = useLatchWhile(open, { title, subtitle, children, footer });

  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [open, onClose]);

  if (!mounted) return null;
  return createPortal(
    <div className={cx('fixed inset-0', elevated ? 'z-[60]' : 'z-50')} role="dialog" aria-modal="true" style={style}>
      <div
        className={cx('absolute inset-0 bg-black/65 backdrop-blur-[2px] transition-opacity duration-200', shown ? 'opacity-100' : 'opacity-0')}
        onClick={onClose}
      />
      <div
        className={cx(
          'absolute inset-x-0 bottom-0 mx-auto flex max-h-[94dvh] flex-col rounded-t-[28px] border-t border-line bg-surface shadow-[0_-20px_60px_-20px_rgba(0,0,0,.8)] transition-transform duration-[280ms] ease-out',
          wide ? 'max-w-3xl' : 'max-w-xl',
          shown ? 'translate-y-0' : 'translate-y-full',
        )}
      >
        <div className="mx-auto mt-2.5 h-1.5 w-11 shrink-0 rounded-full bg-white/15" />
        <div className="flex shrink-0 items-start gap-3 px-5 pb-3 pt-3">
          <div className="min-w-0 flex-1">
            <h2 className="font-display text-2xl font-bold leading-tight tracking-wide">{latched.title}</h2>
            {latched.subtitle && <div className="mt-0.5 text-sm text-ink-muted">{latched.subtitle}</div>}
          </div>
          <button
            onClick={onClose}
            aria-label="Chiudi"
            className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-white/5 text-ink-muted transition active:scale-90"
          >
            <X size={20} />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-5">{latched.children}</div>
        {latched.footer && (
          <div className="shrink-0 border-t border-line bg-surface px-5 pt-3" style={{ paddingBottom: 'max(var(--safe-bottom), 14px)' }}>
            {latched.footer}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
