import { useEffect } from 'react';
import { useActiveTeam } from '@/db/hooks';
import { applyVars, teamLogoSrc, themeVars, writeSnapshot } from './apply';

/** Applica a runtime il tema della squadra attiva (le transizioni sono in index.css). */
export function ThemeController() {
  const team = useActiveTeam();
  const primary = team?.primary;
  const secondary = team?.secondary;
  const logo = team?.logo;
  const name = team?.name;
  useEffect(() => {
    if (!primary || !secondary) return;
    const vars = themeVars(primary, secondary);
    applyVars(vars);
    writeSnapshot({ vars, name: name ?? '', logo: teamLogoSrc({ logo }), primary });
  }, [primary, secondary, logo, name]);
  return null;
}
