import { BUILTIN_LOGO, type Team } from '@/db/types';
import { buildPalette, paletteToVars } from './palette';

/** URL del logo della squadra (data URL o logo incluso nell'app). */
export function teamLogoSrc(team: Pick<Team, 'logo'> | undefined | null): string | undefined {
  if (!team?.logo) return undefined;
  return team.logo === BUILTIN_LOGO ? `${import.meta.env.BASE_URL}logo.png` : team.logo;
}

/** Variabili CSS del tema per una coppia di colori (usate anche per l'anteprima live). */
export function themeVars(primary: string, secondary: string): Record<string, string> {
  return paletteToVars(buildPalette(primary, secondary).palette);
}

export function applyVars(vars: Record<string, string>, el: HTMLElement = document.documentElement) {
  for (const [k, v] of Object.entries(vars)) el.style.setProperty(k, v);
  if (el === document.documentElement && vars['--c-bar']) document.querySelector('meta[name=theme-color]')?.setAttribute('content', vars['--c-bar']);
}

// Istantanea della squadra attiva: applicata da index.html prima che React parta
// e usata dalla splash interna per mostrare subito il logo giusto.
const SNAP_KEY = 'bm-theme';
export interface ThemeSnapshot {
  vars: Record<string, string>;
  name: string;
  logo?: string;
  primary: string;
}

export function readSnapshot(): ThemeSnapshot | null {
  try {
    return JSON.parse(localStorage.getItem(SNAP_KEY) ?? 'null') as ThemeSnapshot | null;
  } catch {
    return null;
  }
}

export function writeSnapshot(s: ThemeSnapshot) {
  try {
    localStorage.setItem(SNAP_KEY, JSON.stringify(s));
  } catch {
    /* spazio esaurito: si rinuncia all'istantanea */
  }
}
