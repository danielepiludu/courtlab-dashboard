import type { ReactNode } from 'react';
import { STATUS, type Player } from './db';
export const vib = (ms: number | number[] = 12) => { try { navigator.vibrate?.(ms); } catch { /* non supportato */ } };
export const inp = 'h-12 w-full rounded-xl bg-ink/10 px-3 outline-none focus:ring-2 focus:ring-wine';
export const btn = 'h-12 rounded-xl bg-ink/10 px-4 font-semibold transition active:scale-95';
export const btnPri = 'h-12 rounded-xl bg-wine px-5 font-bold text-bg transition active:scale-95 disabled:opacity-40';
export function Sheet({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  if (!open) return null;
  return (
    <div className="anim-fade fixed inset-0 z-50 flex items-end justify-center bg-black/60" onClick={onClose}>
      <div className="anim-up max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-t-3xl bg-card p-5 pb-8" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between"><h2 className="text-xl font-bold">{title}</h2>
          <button onClick={onClose} className="h-11 w-11 rounded-full bg-ink/10 text-lg" aria-label="Chiudi">✕</button></div>
        {children}
      </div>
    </div>
  );
}
export const Field = ({ label, children }: { label: string; children: ReactNode }) => (
  <label className="mb-3 block"><span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-ink/50">{label}</span>{children}</label>
);
export const Chip = ({ on, onClick, children }: { on: boolean; onClick: () => void; children: ReactNode }) => (
  <button onClick={() => { vib(8); onClick(); }}
    className={`h-11 shrink-0 rounded-full px-4 text-sm font-semibold transition active:scale-95 ${on ? 'bg-wine text-bg' : 'bg-ink/10 text-ink/80'}`}>{children}</button>
);
export const Avatar = ({ p, size = 52 }: { p: Player; size?: number }) => (
  <div style={{ width: size, height: size }} className="grid shrink-0 place-items-center overflow-hidden rounded-full bg-card2 font-extrabold text-wine">
    {p.photo ? <img src={p.photo} alt="" className="h-full w-full object-cover" /> : p.number}
  </div>
);
export const Badge = ({ s }: { s: Player['status'] }) => <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${STATUS[s].c}`}>{STATUS[s].l}</span>;
export const Empty = ({ t, s }: { t: string; s: string }) => (
  <div className="grid place-items-center gap-1 rounded-3xl bg-card p-10 text-center"><div className="mb-2 text-5xl">🏀</div><b className="text-lg">{t}</b><span className="text-ink/50">{s}</span></div>
);
