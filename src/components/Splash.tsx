import { cx } from '@/lib/cx';
import { APP } from '@/config';

/** Splash interna: marchio Courtlab (l'app è indipendente dalle squadre) e credito dell'autore. */
export function Splash({ leaving }: { leaving: boolean }) {
  return (
    <div
      className={cx('fixed inset-0 z-[100] flex flex-col items-center justify-center transition-opacity duration-500', leaving ? 'pointer-events-none opacity-0' : 'opacity-100')}
      style={{ background: 'radial-gradient(circle at 50% 40%, #12305a 0%, #050f1a 64%)' }}
    >
      <div className="relative">
        <span className="absolute inset-0 rounded-[28%] border-2 border-[#ff8a1f]/50" style={{ animation: 'splash-ring 1.4s ease-out .25s infinite' }} />
        <span className="absolute inset-0 rounded-[28%] border-2 border-[#3987e5]/40" style={{ animation: 'splash-ring 1.4s ease-out .7s infinite' }} />
        <img
          src={`${import.meta.env.BASE_URL}icons/app-logo.png`}
          alt=""
          width={150}
          height={150}
          className="relative h-[150px] w-[150px] drop-shadow-[0_14px_34px_rgba(0,0,0,.65)]"
          style={{ animation: 'splash-logo .7s cubic-bezier(.2,.9,.3,1.2) both' }}
          draggable={false}
        />
      </div>
      <div className="anim-rise mt-7 text-center" style={{ animationDelay: '.25s' }}>
        <div className="font-display text-[46px] font-extrabold leading-none tracking-[0.02em]">
          Court<span className="text-[#ff8a1f]">lab</span>
        </div>
        <div className="mt-2 text-[13px] font-medium tracking-wide text-ink-muted">Minuti, fatica e carico di allenamento</div>
      </div>
      <div className="absolute bottom-10 px-6 text-center text-[12px] font-semibold uppercase tracking-[0.2em] text-ink-faint" style={{ marginBottom: 'var(--safe-bottom)' }}>
        {APP.credit}
      </div>
    </div>
  );
}
