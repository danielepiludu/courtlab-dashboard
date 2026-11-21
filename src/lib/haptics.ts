/**
 * Feedback aptico. Usa la Vibration API del browser; in futuro, con Capacitor,
 * basterà sostituire l'implementazione di `vibrate` con il plugin Haptics.
 */
const vibrate = (pattern: number | number[]) => {
  try {
    navigator.vibrate?.(pattern);
  } catch {
    /* non supportato */
  }
};

export const haptic = {
  tap: () => vibrate(8),
  select: () => vibrate(14),
  confirm: () => vibrate([18, 40, 26]),
  warn: () => vibrate([30, 60, 30]),
  heavy: () => vibrate(40),
  alarm: () => vibrate([250, 120, 250, 120, 250]),
};
