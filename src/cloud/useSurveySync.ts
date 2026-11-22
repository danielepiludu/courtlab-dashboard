import { useCallback, useEffect, useRef, useState } from 'react';
import type { TrainingSession } from '@/db/types';
import { useCloud } from './client';
import { cloudConfigured } from './config';
import { pullResponses } from './surveys';

const EVERY_MS = 30_000;

/**
 * Scarica periodicamente le risposte delle raccolte aperte (ogni 30 s, quando l'app è in primo piano e online).
 */
export function useSurveySync(sessions: TrainingSession[] | undefined) {
  const logged = useCloud((s) => !!s.session);
  const [syncing, setSyncing] = useState(false);
  const [lastSync, setLastSync] = useState<number | null>(null);
  const ref = useRef(sessions);
  ref.current = sessions;
  const open = (sessions ?? []).filter((s) => s.surveyToken && s.surveyOpen);
  const active = logged && cloudConfigured() && open.length > 0;

  const sync = useCallback(async (list?: TrainingSession[]) => {
    const target = list ?? (ref.current ?? []).filter((s) => s.surveyToken && s.surveyOpen);
    if (!target.length) return 0;
    setSyncing(true);
    try {
      const n = await pullResponses(target);
      setLastSync(Date.now());
      return n;
    } finally {
      setSyncing(false);
    }
  }, []);

  useEffect(() => {
    if (!active) return;
    const run = () => {
      if (document.visibilityState === 'visible' && navigator.onLine !== false) sync().catch(() => undefined);
    };
    run();
    const t = setInterval(run, EVERY_MS);
    window.addEventListener('online', run);
    document.addEventListener('visibilitychange', run);
    return () => {
      clearInterval(t);
      window.removeEventListener('online', run);
      document.removeEventListener('visibilitychange', run);
    };
  }, [active, open.length, sync]);

  return { sync, syncing, lastSync, active };
}
