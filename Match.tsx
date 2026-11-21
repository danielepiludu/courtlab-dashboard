import { useState } from 'react';
import { useStore } from './store';
import { iso } from './db';
import { Avatar, Badge, Empty, inp, btnPri, btn, vib } from './ui';
export default function Match() {
  const { players, games, match, setMatch, saveGame } = useStore();
  const [opp, setOpp] = useState(''), [toast, setToast] = useState('');
  const upcoming = games.filter((g) => !g.finished);
  const { gameId, conv, start } = match;
  const flash = (t: string) => { setToast(t); setTimeout(() => setToast(''), 2200); };
  const toggleConv = (id: number) => { vib(10);
    setMatch(conv.includes(id) ? { conv: conv.filter((x) => x !== id), start: start.filter((x) => x !== id) } : { conv: [...conv, id] }); };
  const toggleStart = (id: number) => {
    if (start.includes(id)) { vib(10); setMatch({ start: start.filter((x) => x !== id) }); }
    else if (start.length >= 5) { vib([30, 40, 30]); flash('I titolari sono già 5'); }
    else { vib(10); setMatch({ start: [...start, id] }); }
  };
  const ok = !!gameId && conv.length >= 5 && start.length === 5;
  return (
    <div className="p-4">
      <h1 className="mb-4 text-3xl font-extrabold">Partita</h1>
      <h2 className="mb-2 text-sm font-bold uppercase tracking-wider text-white/50">1 · Scegli la partita</h2>
      <div className="mb-3 flex gap-2 overflow-x-auto pb-1">
        {upcoming.map((g) => (
          <button key={g.id} onClick={() => { vib(8); setMatch({ gameId: g.id! }); }}
            className={`shrink-0 rounded-2xl px-4 py-3 text-left transition active:scale-95 ${gameId === g.id ? 'bg-lime text-bg' : 'bg-card'}`}>
            <b>vs {g.opponent || 'Avversario'}</b><div className="text-xs opacity-70">{g.date.slice(8)}/{g.date.slice(5, 7)} · {g.time}</div></button>))}
      </div>
      <div className="mb-5 flex gap-2">
        <input className={inp} placeholder="Partita al volo: avversario" value={opp} onChange={(e) => setOpp(e.target.value)} />
        <button className={btn} disabled={!opp.trim()} onClick={async () => { const id = await saveGame({ date: iso(new Date()), time: new Date().toTimeString().slice(0, 5), opponent: opp.trim(), home: true, notes: '', finished: false }); setMatch({ gameId: id }); setOpp(''); vib(20); }}>Crea</button>
      </div>
      <div className="mb-2 flex items-end justify-between"><h2 className="text-sm font-bold uppercase tracking-wider text-white/50">2 · Convocati e quintetto</h2>
        <span className="text-sm font-bold"><span className="text-lime">{conv.length}</span> convocati · <span className="text-ball">{start.length}/5</span> titolari</span></div>
      {players.length === 0 ? <Empty t="Nessun giocatore" s="Aggiungili dalla tab Giocatori." /> : (
        <div className="grid grid-cols-2 gap-2">
          {players.map((p) => {
            const id = p.id!, inj = p.status === 'inj', on = conv.includes(id), st = start.includes(id);
            return (
              <div key={id} className={`rounded-2xl border-2 p-3 transition ${on ? 'border-lime bg-lime/10' : 'border-transparent bg-card'} ${inj ? 'opacity-50' : ''}`}>
                <button disabled={inj} onClick={() => toggleConv(id)} className="flex w-full items-center gap-2 text-left active:scale-95">
                  <Avatar p={p} size={44} /><div className="min-w-0 flex-1"><b className="block truncate">#{p.number} {p.name}</b><span className="text-xs text-white/50">{p.role}</span></div>
                  <span className={`grid h-7 w-7 place-items-center rounded-md border-2 ${on ? 'anim-pop border-lime bg-lime text-bg' : 'border-white/30'}`}>{on && '✓'}</span>
                </button>
                <div className="mt-2 flex items-center justify-between">{p.status !== 'ok' ? <Badge s={p.status} /> : <span />}
                  {on && <button onClick={() => toggleStart(id)} className={`h-9 rounded-full px-3 text-xs font-bold transition active:scale-90 ${st ? 'anim-pop bg-ball text-bg' : 'bg-white/10'}`}>{st ? '★ Titolare' : '☆ Titolare'}</button>}</div>
              </div>);
          })}
        </div>)}
      <div className="fixed inset-x-0 bottom-24 z-30 mx-auto flex max-w-3xl flex-col items-center gap-2 px-4 pb-[env(safe-area-inset-bottom)]">
        {toast && <div className="anim-pop rounded-full bg-black/80 px-4 py-2 text-sm font-semibold">{toast}</div>}
        <button className={btnPri + ' h-14 w-full text-lg shadow-lg shadow-lime/20'} disabled={!ok}
          onClick={() => { vib(30); flash('La schermata partita arriva nella Fase 2'); }}>▶ Inizia partita</button>
      </div>
    </div>
  );
}
