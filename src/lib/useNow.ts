import { useEffect, useState } from 'react';

/** Ora corrente aggiornata a intervalli (solo per il ridisegno: i valori derivano dai timestamp). */
export function useNow(ms = 250): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), ms);
    const vis = () => document.visibilityState === 'visible' && setNow(Date.now());
    document.addEventListener('visibilitychange', vis);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', vis);
    };
  }, [ms]);
  return now;
}
