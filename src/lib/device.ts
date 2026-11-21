import { useEffect } from 'react';

type OrientationLock = 'landscape' | 'portrait' | 'any';
type LockableOrientation = ScreenOrientation & { lock?: (o: OrientationLock) => Promise<void> };

/** Schermo intero + orientamento orizzontale (va chiamata da un gesto dell'utente). */
export async function enterGameMode() {
  try {
    if (!document.fullscreenElement) await document.documentElement.requestFullscreen?.({ navigationUI: 'hide' });
  } catch {
    /* non supportato / negato */
  }
  try {
    await (screen.orientation as LockableOrientation)?.lock?.('landscape');
  } catch {
    /* non supportato fuori dallo schermo intero */
  }
}

export async function exitGameMode() {
  try {
    screen.orientation?.unlock?.();
  } catch {
    /* ignora */
  }
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
  } catch {
    /* ignora */
  }
}

/** Mantiene lo schermo acceso finché `active` è true (Wake Lock API). */
export function useWakeLock(active: boolean) {
  useEffect(() => {
    if (!active || !('wakeLock' in navigator)) return;
    let sentinel: WakeLockSentinel | null = null;
    let disposed = false;
    const acquire = async () => {
      try {
        if (document.visibilityState !== 'visible') return;
        sentinel = await navigator.wakeLock.request('screen');
        if (disposed) void sentinel.release();
      } catch {
        /* negato (es. batteria scarica) */
      }
    };
    const onVis = () => {
      if (document.visibilityState === 'visible') void acquire();
    };
    void acquire();
    document.addEventListener('visibilitychange', onVis);
    return () => {
      disposed = true;
      document.removeEventListener('visibilitychange', onVis);
      void sentinel?.release().catch(() => {});
    };
  }, [active]);
}
