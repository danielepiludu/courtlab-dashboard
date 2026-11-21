import { useEffect, useRef } from 'react';

/**
 * Gestione del tasto "Indietro" di Android per overlay (sheet, dialog, cropper).
 * Ogni overlay aperto aggiunge una voce alla history: "Indietro" chiude l'overlay
 * più in alto invece di uscire dall'app.
 */
type Entry = { close: () => void };
const stack: Entry[] = [];
let ignorePops = 0;
let pendingBacks = 0;
let listening = false;

function ensureListener() {
  if (listening || typeof window === 'undefined') return;
  listening = true;
  window.addEventListener('popstate', () => {
    if (ignorePops > 0) {
      ignorePops--;
      return;
    }
    stack.pop()?.close();
  });
}

function scheduleBack() {
  pendingBacks++;
  if (pendingBacks > 1) return;
  queueMicrotask(() => {
    const n = pendingBacks;
    pendingBacks = 0;
    ignorePops++;
    history.go(-n);
  });
}

export function useBackClose(open: boolean, onClose: () => void) {
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    if (!open) return;
    ensureListener();
    let closedByBack = false;
    const entry: Entry = {
      close: () => {
        closedByBack = true;
        closeRef.current();
      },
    };
    stack.push(entry);
    history.pushState({ overlay: true }, '');
    return () => {
      const i = stack.indexOf(entry);
      if (i >= 0) stack.splice(i, 1);
      if (!closedByBack) scheduleBack();
    };
  }, [open]);
}
