import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { useStore } from './store';
import { plabel, advance, swap, toggle, addScore, undo, newLive, type Live, type PS } from './live';
import type { Player } from './db';
import { Avatar, Sheet, btn, vib } from './ui';

void newLive;
const mmss = (ms: number) => { const s = Math.max(0, Math.ceil(ms / 1000)); return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`; };
const mm = (ms: number) => { const s = Math.floor(ms / 1000); return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`; };
function useNow(ms = 250) { const [n, setN] = useState(Date.now()); useEffect(() => { const i = setInterval(() => setN(Date.now()), ms); return () => clearInterval(i); }, [ms]); return n; }
const PRI: Record<string, number> = { C: 0, PF: 1, SF: 2, SG: 3, PG: 4 };
// 2 lunghi nel pitturato, punta + due angoli opposti per gli esterni (coordinate in % del campo)
function spots(ids: number[], pl: Record<number, Player>) {
  const s = [...ids].sort((a, b) => (PRI[pl[a]?.role] ?? 2) - (PRI[pl[b]?.role] ?? 2) || a - b);
  const pos: Record<number, [number, number]> = {};
  const P: [number, number][] = [[39, 79], [61, 63]], O: [number, number][] = [[50, 22], [6.5, 78], [93.5, 78]];
  s.slice(0, 2).forEach((id, i) => { pos[id] = P[i]; });
  s.slice(2).reverse().forEach((id, i) => { pos[id] = O[i]; });
  return pos;
}
const Stint = ({ f }: { f: number }) => (
  <div className="mt-1"><div className="flex justify-between text-[10px] font-bold text-ink/50"><span>STINT</span><span>{Math.round(f)}</span></div>
    <div className="h-1.5 overflow-hidden rounded-full bg-ink/10"><div className="h-full rounded-full transition-all" style={{ width: `${f}%`, background: `hsl(${120 - 1.2 * f} 70% 42%)` }} /></div></div>
);
function Court() {
  return (
    <svg viewBox="0 0 500 470" className="absolute inset-0 h-full w-full rounded-2xl shadow-xl" aria-hidden>
      <defs><pattern id="wd" width="40" height="470" patternUnits="userSpaceOnUse"><rect width="40" height="470" fill="#d9a766" /><rect width="2" height="470" fill="#b9854a" /><rect x="20" width="1" height="470" fill="#c8955a" /></pattern></defs>
      <rect width="500" height="470" fill="url(#wd)" />
      <rect x="170" y="280" width="160" height="190" fill="#7a1d2e" opacity=".75" />
      <g fill="none" stroke="#fff7e6" strokeWidth="3.5">
        <rect x="1.75" y="1.75" width="496.5" height="466.5" /><rect x="170" y="280" width="160" height="190" />
        <path d="M190 280A60 60 0 0 1 310 280" /><path d="M190 280A60 60 0 0 0 310 280" strokeDasharray="10 8" />
        <path d="M30 470V327.5A237.5 237.5 0 0 1 470 327.5V470" /><path d="M210 417A40 40 0 0 1 290 417" />
        <path d="M190 0A60 60 0 0 0 310 0" /><path d="M220 430H280" /><circle cx="250" cy="417" r="7.5" stroke="#e8923a" />
      </g>
    </svg>
  );
}
export default function MatchLive({ live }: { live: Live }) {
  const { players, games, setLive, saveGame, setMatch } = useStore();
  const [sel, setSel] = useState<number | null>(null), [ask, setAsk] = useState(false);
  const now = useNow();
  const v = useMemo(() => advance(live, now), [live, now]);
  const pl = useMemo(() => Object.fromEntries(players.map((p) => [p.id!, p])) as Record<number, Player>, [players]);
  const pos = useMemo(() => spots(v.on, pl), [v.on, pl]);
  const bench = v.conv.filter((id) => !v.on.includes(id));
  const commit = (l: Live) => { void setLive(l); };
  useEffect(() => { if (live.running && !v.running) { vib([250, 120, 250]); commit(v); } }, [v.running]); // eslint-disable-line
  useEffect(() => {
    let wl: { release?: () => void } | undefined;
    const get = async () => { try { wl = await (navigator as unknown as { wakeLock?: { request: (t: string) => Promise<typeof wl> } }).wakeLock?.request('screen'); } catch { /* ignora */ } };
    const vis = () => { if (document.visibilityState === 'visible') void get(); };
    void get(); document.addEventListener('visibilitychange', vis);
    try { void (screen.orientation as unknown as { lock?: (o: string) => Promise<void> }).lock?.('landscape').catch(() => {}); } catch { /* ignora */ }
    return () => { document.removeEventListener('visibilitychange', vis); wl?.release?.(); };
  }, []);
  const tap = (id: number) => {
    vib(10);
    if (sel == null) { setSel(id); return; }
    if (sel === id) { setSel(null); return; }
    const a = v.on.includes(sel), b = v.on.includes(id);
    if (a === b) { setSel(id); return; }
    vib(28); commit(swap(live, a ? sel : id, a ? id : sel, Date.now())); setSel(null);
  };
  const finish = async () => {
    const f = advance(live, Date.now()), g = games.find((x) => x.id === f.gameId);
    const stats: NonNullable<typeof g>['stats'] = {};
    f.conv.forEach((id) => { const s = f.p[id]; stats[id] = { played: s.played, entries: s.entries, f: s.f, peak: s.peak }; });
    if (g) await saveGame({ ...g, finished: true, scoreUs: f.us, scoreThem: f.them, stats });
    setMatch({ gameId: null, conv: [], start: [] });
    await setLive(null);
  };
  const team = (name: string, score: number, k: 'u' | 't') => (
    <div className="text-center">
      <div className="max-w-[170px] truncate text-xs font-bold uppercase tracking-wide text-ink/60">{name}</div>
      <div className="text-6xl font-extrabold leading-none tabular-nums">{score}</div>
      <div className="mt-1 flex gap-1">{([1, 2, 3] as const).map((n) => (
        <button key={n} onClick={() => { vib(15); commit(addScore(live, k, n)); }} className="h-11 w-14 rounded-xl bg-ink/10 text-lg font-extrabold transition active:scale-90">+{n}</button>))}</div>
    </div>
  );
  const bar = (s: PS) => <Stint f={s.f} />;
  return (
    <div className="fixed inset-0 flex flex-col bg-bg">
      <div className="fixed inset-0 z-[60] hidden flex-col items-center justify-center gap-3 bg-bg p-8 text-center portrait:flex"><div className="text-6xl">🔄</div><b className="text-2xl">Ruota il tablet in orizzontale</b><span className="text-ink/60">La partita è in corso e si aggiorna in background.</span></div>
      <header className="flex items-center gap-4 border-b border-ink/10 bg-card px-4 py-2 pt-[max(env(safe-area-inset-top),8px)]">
        <div className="flex items-center gap-3">
          <div className="text-center"><div className="rounded-full bg-wine px-3 py-0.5 text-sm font-extrabold text-bg">{plabel(v.period)}</div>
            <div className={`text-5xl font-extrabold tabular-nums ${v.clock <= 0 ? 'text-wine' : ''}`}>{mmss(v.clock)}</div></div>
          <button onClick={() => { vib(30); commit(toggle(live, Date.now())); }}
            className={`h-14 min-w-[110px] rounded-2xl px-4 text-lg font-extrabold transition active:scale-95 ${v.running ? 'bg-ink text-bg' : 'bg-wine text-bg'}`}>
            {v.running ? '⏸ Stop' : v.clock <= 0 ? `▶ ${plabel(v.period + 1)}` : '▶ Start'}</button>
        </div>
        <div className="flex flex-1 items-center justify-center gap-5">
          {team('Noi', v.us, 'u')}
          <button disabled={!v.log.length} onClick={() => { vib(20); commit(undo(live)); }} className={btn + ' h-11 text-sm disabled:opacity-30'}>↶ Annulla</button>
          {team(live.opp || 'Ospiti', v.them, 't')}
        </div>
        <button onClick={() => setAsk(true)} className="h-12 rounded-xl bg-red-700 px-4 font-bold text-ink transition active:scale-95">Termina partita</button>
      </header>
      <div className="flex min-h-0 flex-1">
        <aside className="w-[27%] max-w-[310px] shrink-0 overflow-y-auto border-r border-ink/10 p-2">
          <h2 className="mb-2 px-1 text-xs font-bold uppercase tracking-wider text-ink/50">Panchina ({bench.length})</h2>
          {bench.map((id) => { const p = pl[id], s = v.p[id]; if (!p) return null; return (
            <button key={id} onClick={() => tap(id)} className={`anim-pop mb-2 w-full rounded-2xl bg-card p-2 text-left shadow-sm transition active:scale-95 ${sel === id ? 'ring-4 ring-gold' : ''}`}>
              <div className="flex items-center gap-2"><Avatar p={p} size={44} /><div className="min-w-0 flex-1"><b className="block truncate">#{p.number} {p.name}</b><span className="text-xs text-ink/50">{p.role}</span></div></div>
              <div className="mt-1 flex justify-between text-xs tabular-nums"><span>Campo <b className="text-sm">{mm(s.played)}</b></span><span>Panca <b className="text-sm text-gold">{mm(s.benchCur)}</b></span></div>{bar(s)}
            </button>); })}
        </aside>
        <section className="min-w-0 flex-1 p-3" style={{ containerType: 'size' } as CSSProperties}>
          <div className="relative mx-auto" style={{ width: 'min(100cqw, calc(100cqh * 1.0638))', aspectRatio: '500 / 470' }}>
            <Court />
            {v.on.map((id) => { const p = pl[id], s = v.p[id], [x, y] = pos[id] ?? [50, 50]; if (!p) return null; return (
              <button key={id} onClick={() => tap(id)} style={{ left: `${x}%`, top: `${y}%` }}
                className={`absolute w-[19%] min-w-[84px] -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-card/95 p-1.5 text-center shadow-lg transition-[left,top] duration-500 active:scale-95 ${sel === id ? 'ring-4 ring-gold' : ''}`}>
                <div className="flex items-center justify-center gap-1.5"><Avatar p={p} size={36} /><div className="min-w-0 text-left leading-tight"><b className="block text-sm">#{p.number}</b><span className="rounded bg-wine/15 px-1 text-[10px] font-bold text-wine">{p.role}</span></div></div>
                <b className="mt-0.5 block truncate text-xs">{p.name}</b>
                <b className="block text-lg tabular-nums leading-tight">{mm(s.played)}</b>{bar(s)}
              </button>); })}
          </div>
        </section>
      </div>
      <Sheet open={ask} onClose={() => setAsk(false)} title="Termina partita">
        <p className="mb-4 text-lg">Sei sicuro di voler concludere la partita?</p>
        <p className="mb-5 text-ink/60">Punteggio attuale: Noi {v.us} – {v.them} {live.opp}</p>
        <div className="flex gap-2"><button className={btn + ' flex-1'} onClick={() => setAsk(false)}>Annulla</button>
          <button className="h-12 flex-1 rounded-xl bg-red-700 font-bold text-ink transition active:scale-95" onClick={() => { vib(40); void finish(); }}>Sì, termina</button></div>
      </Sheet>
    </div>
  );
}
