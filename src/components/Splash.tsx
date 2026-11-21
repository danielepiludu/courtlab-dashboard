import { cx } from '@/lib/cx';
import { APP } from '@/config';
import { Logo } from './ui/misc';

/** Splash screen d'avvio con logo animato. */
export function Splash({ leaving }: { leaving: boolean }) {
  return (
    <div
      className={cx(
        'fixed inset-0 z-[100] flex flex-col items-center justify-center bg-[radial-gradient(circle_at_50%_40%,#0f2a5c_0%,#060D1F_62%)] transition-opacity duration-500',
        leaving ? 'pointer-events-none opacity-0' : 'opacity-100',
      )}
    >
      <div className="relative">
        <span className="absolute inset-0 rounded-full border-2 border-brand/60" style={{ animation: 'splash-ring 1.4s ease-out .25s infinite' }} />
        <span className="absolute inset-0 rounded-full border-2 border-accent/50" style={{ animation: 'splash-ring 1.4s ease-out .7s infinite' }} />
        <div style={{ animation: 'splash-logo .7s cubic-bezier(.2,.9,.3,1.2) both' }}>
          <Logo size={176} />
        </div>
      </div>
      <div className="anim-rise mt-8 text-center" style={{ animationDelay: '.25s' }}>
        <div className="font-display text-[34px] font-extrabold uppercase leading-none tracking-[0.06em]">Don Bosco</div>
        <div className="mt-1.5 font-display text-lg font-semibold uppercase tracking-[0.32em] text-brand">Basket Monitor</div>
      </div>
      <div className="absolute bottom-10 text-xs font-medium tracking-[0.2em] text-ink-faint" style={{ marginBottom: 'var(--safe-bottom)' }}>
        {APP.club.toUpperCase()}
      </div>
    </div>
  );
}
