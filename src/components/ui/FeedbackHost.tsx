import { createPortal } from 'react-dom';
import { CircleCheck, Info, OctagonX } from 'lucide-react';
import { useFeedback, resolveConfirm } from '@/store/feedback';
import { useBackClose } from '@/lib/backNav';
import { cx } from '@/lib/cx';
import { Button } from './Button';
import { useMountTransition } from './Sheet';
import { useEffect, useRef, useState } from 'react';

/** Host globale di toast e dialog di conferma. */
export function FeedbackHost() {
  const toasts = useFeedback((s) => s.toasts);
  const confirm = useFeedback((s) => s.confirm);
  const open = !!confirm;
  const { mounted, shown } = useMountTransition(open, 200);
  const last = useRef(confirm);
  if (confirm) last.current = confirm;
  const c = last.current;
  useBackClose(open, () => resolveConfirm(false));
  const [typed, setTyped] = useState('');
  useEffect(() => {
    if (open) setTyped('');
  }, [open]);
  const blocked = !!c?.requireText && typed.trim().toLowerCase() !== c.requireText.trim().toLowerCase();

  return createPortal(
    <>
      <div className="pointer-events-none fixed inset-x-0 top-0 z-[90] flex flex-col items-center gap-2 px-4" style={{ paddingTop: 'calc(var(--safe-top) + 12px)' }}>
        {toasts.map((t) => (
          <div
            key={t.id}
            role="status"
            className={cx(
              'anim-pop flex max-w-md items-center gap-2.5 rounded-2xl border px-4 py-3 text-[15px] font-semibold shadow-card backdrop-blur',
              t.tone === 'success' && 'border-ok/40 bg-surface-2/95 text-ok',
              t.tone === 'error' && 'border-danger/40 bg-surface-2/95 text-danger',
              t.tone === 'info' && 'border-accent/40 bg-surface-2/95 text-ink',
            )}
          >
            {t.tone === 'success' ? <CircleCheck size={18} /> : t.tone === 'error' ? <OctagonX size={18} /> : <Info size={18} className="text-accent-light" />}
            <span>{t.text}</span>
          </div>
        ))}
      </div>
      {mounted && c && (
        <div className="fixed inset-0 z-[80] grid place-items-center p-6" role="alertdialog" aria-modal="true">
          <div className={cx('absolute inset-0 bg-black/70 backdrop-blur-sm transition-opacity duration-200', shown ? 'opacity-100' : 'opacity-0')} onClick={() => resolveConfirm(false)} />
          <div
            className={cx(
              'relative w-full max-w-sm rounded-3xl border border-line bg-surface p-6 shadow-2xl transition duration-200 ease-out',
              shown ? 'scale-100 opacity-100' : 'scale-95 opacity-0',
            )}
          >
            <h3 className="font-display text-2xl font-bold leading-tight">{c.title}</h3>
            {c.message && <p className="mt-2 whitespace-pre-line text-[15px] leading-relaxed text-ink-muted">{c.message}</p>}
            {c.requireText && (
              <label className="mt-4 block">
                <span className="label">
                  Per confermare scrivi: <b className="normal-case tracking-normal text-ink">{c.requireText}</b>
                </span>
                <input className="input" value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" autoCapitalize="off" spellCheck={false} />
              </label>
            )}
            <div className="mt-6 flex gap-3">
              <Button className="flex-1" onClick={() => resolveConfirm(false)}>
                {c.cancelLabel ?? 'Annulla'}
              </Button>
              <Button className="flex-1" variant={c.danger ? 'primary' : 'accent'} disabled={blocked} onClick={() => resolveConfirm(true)}>
                {c.confirmLabel ?? 'Conferma'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>,
    document.body,
  );
}
