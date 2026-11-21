import { create } from 'zustand';

export type ToastTone = 'info' | 'success' | 'error';
export interface Toast {
  id: number;
  text: string;
  tone: ToastTone;
}

export interface ConfirmOptions {
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
}

interface FeedbackState {
  toasts: Toast[];
  confirm: (ConfirmOptions & { resolve: (ok: boolean) => void }) | null;
}

export const useFeedback = create<FeedbackState>(() => ({ toasts: [], confirm: null }));

let nextId = 1;
export function toast(text: string, tone: ToastTone = 'info', ms = 2400) {
  const id = nextId++;
  useFeedback.setState((s) => ({ toasts: [...s.toasts.slice(-2), { id, text, tone }] }));
  setTimeout(() => useFeedback.setState((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })), ms);
}

/** Dialog di conferma promise-based: `if (await confirmDialog({...})) …` */
export function confirmDialog(opts: ConfirmOptions): Promise<boolean> {
  return new Promise((resolve) => {
    useFeedback.getState().confirm?.resolve(false);
    useFeedback.setState({ confirm: { ...opts, resolve } });
  });
}

export function resolveConfirm(ok: boolean) {
  const c = useFeedback.getState().confirm;
  useFeedback.setState({ confirm: null });
  c?.resolve(ok);
}
