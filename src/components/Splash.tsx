import { useMemo } from 'react';
import { cx } from '@/lib/cx';
import { APP } from '@/config';
import { BUILTIN_LOGO } from '@/db/types';
import { readSnapshot } from '@/theme/apply';
import { DEFAULT_TEAM } from '@/config';
import { TeamLogo } from './TeamLogo';

/** Splash interna: logo della squadra attiva (dall'ultima sessione) e nome dell'app. */
export function Splash({ leaving }: { leaving: boolean }) {
  const snap = useMemo(() => readSnapshot(), []);
  const team = snap
    ? { name: snap.name, logo: snap.logo, primary: snap.primary, secondary: snap.vars['--c-brand'] ?? DEFAULT_TEAM.secondary }
    : { name: DEFAULT_TEAM.name, logo: `${import.meta.env.BASE_URL}logo.png`, primary: DEFAULT_TEAM.primary, secondary: DEFAULT_TEAM.secondary };
  // il logo nell'istantanea è già un URL risolto
  const logoTeam = { ...team, logo: team.logo === BUILTIN_LOGO ? `${import.meta.env.BASE_URL}logo.png` : team.logo };

  return (
    <div
      className={cx('fixed inset-0 z-[100] flex flex-col items-center justify-center transition-opacity duration-500', leaving ? 'pointer-events-none opacity-0' : 'opacity-100')}
      style={{ background: 'radial-gradient(circle at 50% 40%, var(--c-bar) 0%, var(--c-bg) 62%)' }}
    >
      <div className="relative">
        <span className="absolute inset-0 rounded-full border-2 border-brand/60" style={{ animation: 'splash-ring 1.4s ease-out .25s infinite' }} />
        <span className="absolute inset-0 rounded-full border-2 border-accent/50" style={{ animation: 'splash-ring 1.4s ease-out .7s infinite' }} />
        <div style={{ animation: 'splash-logo .7s cubic-bezier(.2,.9,.3,1.2) both' }}>
          <TeamLogo team={logoTeam} size={176} />
        </div>
      </div>
      <div className="anim-rise mt-8 text-center" style={{ animationDelay: '.25s' }}>
        <div className="font-display text-[34px] font-extrabold uppercase leading-none tracking-[0.06em]">Basket</div>
        <div className="mt-1.5 font-display text-lg font-semibold uppercase tracking-[0.32em] text-brand-text">Monitor</div>
      </div>
      <div className="absolute bottom-10 max-w-[80%] truncate px-6 text-center text-xs font-medium uppercase tracking-[0.2em] text-ink-faint" style={{ marginBottom: 'var(--safe-bottom)' }}>
        {team.name || APP.name}
      </div>
    </div>
  );
}
