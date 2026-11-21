import { useState } from 'react';
import { useStore } from './store';
import { iso, type Game } from './db';
import { Sheet, Field, Empty, inp, btn, btnPri, vib } from './ui';
const MESI = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'];
const blank = (): Game => ({ date: iso(new Date()), time: '18:00', opponent: '', home: true, notes: '', finished: false });
const fmt = (d: string) => new Date(d + 'T00:00').toLocaleDateString('it-IT', { weekday: 'short', day: 'numeric', month: 'short' });
export default function Home() {
  const { games, saveGame, delGame } = useStore();
  const [m, setM] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); });
  const [ed, setEd] = useState<Game | null>(null);
  const today = iso(new Date());
  const first = (m.getDay() + 6) % 7, dim = new Date(m.getFullYear(), m.getMonth() + 1, 0).getDate();
  const cells: (number | null)[] = [...Array<null>(first).fill(null), ...Array.from({ length: dim }, (_, i) => i + 1)];
  const key = (d: number) => iso(new Date(m.getFullYear(), m.getMonth(), d));
  const up = (k: Partial<Game>) => setEd((e) => e && { ...e, ...k });
  const next = games.filter((g) => !g.finished && g.date >= today);
  const done = games.filter((g) => g.finished).slice(-3).reverse();
  const row = (g: Game) => (
    <button key={g.id} onClick={() => setEd(g)} className="mb-2 flex w-full items-center gap-3 rounded-2xl bg-card p-3 text-left transition active:scale-[.98]">
      <div className="w-16 text-sm font-bold capitalize text-wine">{fmt(g.date)}</div>
      <div className="flex-1"><b>{g.home ? 'vs' : '@'} {g.opponent || 'Avversario'}</b><div className="text-xs text-ink/50">{g.time} · {g.home ? 'Casa' : 'Trasferta'}</div></div>
      {g.finished && <b className="text-lg">{g.scoreUs ?? 0}–{g.scoreThem ?? 0}</b>}
    </button>
  );
  return (
    <div className="p-4">
      <div className="mb-4 flex items-center justify-between"><h1 className="text-3xl font-extrabold">Home</h1>
        <button className={btnPri} onClick={() => { vib(); setEd(blank()); }}>+ Partita</button></div>
      <section className="mb-5 rounded-3xl bg-card p-4">
        <div className="mb-3 flex items-center justify-between">
          <button className="h-11 w-11 rounded-full bg-ink/10" onClick={() => setM(new Date(m.getFullYear(), m.getMonth() - 1, 1))}>‹</button>
          <b className="uppercase tracking-wide">{MESI[m.getMonth()]} {m.getFullYear()}</b>
          <button className="h-11 w-11 rounded-full bg-ink/10" onClick={() => setM(new Date(m.getFullYear(), m.getMonth() + 1, 1))}>›</button>
        </div>
        <div className="grid grid-cols-7 gap-1 text-center text-xs text-ink/40">{['L', 'M', 'M', 'G', 'V', 'S', 'D'].map((d, i) => <span key={i}>{d}</span>)}</div>
        <div className="mt-1 grid grid-cols-7 gap-1">
          {cells.map((d, i) => d === null ? <span key={i} /> : (
            <button key={i} onClick={() => { const g = games.find((x) => x.date === key(d)); setEd(g ?? { ...blank(), date: key(d) }); }}
              className={`relative grid h-11 place-items-center rounded-xl text-sm font-semibold transition active:scale-90 ${key(d) === today ? 'bg-wine/20 text-wine ring-1 ring-wine' : 'bg-ink/5'}`}>
              {d}{games.some((g) => g.date === key(d)) && <i className="absolute bottom-1 h-1.5 w-1.5 rounded-full bg-gold" />}
            </button>))}
        </div>
      </section>
      <h2 className="mb-2 text-sm font-bold uppercase tracking-wider text-ink/50">Prossime partite</h2>
      {next.length ? next.map(row) : <Empty t="Nessuna partita in programma" s="Pianifica una nuova partita per vederla qui." />}
      {done.length > 0 && <><h2 className="mb-2 mt-5 text-sm font-bold uppercase tracking-wider text-ink/50">Concluse</h2>{done.map(row)}</>}
      <Sheet open={!!ed} onClose={() => setEd(null)} title={ed?.id ? 'Modifica partita' : 'Nuova partita'}>
        {ed && <>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Data"><input type="date" className={inp} value={ed.date} onChange={(e) => up({ date: e.target.value })} /></Field>
            <Field label="Ora"><input type="time" className={inp} value={ed.time} onChange={(e) => up({ time: e.target.value })} /></Field>
          </div>
          <Field label="Avversario"><input className={inp} value={ed.opponent} onChange={(e) => up({ opponent: e.target.value })} /></Field>
          <div className="mb-3 grid grid-cols-2 gap-2">
            {[true, false].map((h) => <button key={String(h)} onClick={() => { vib(8); up({ home: h }); }} className={`h-12 rounded-xl font-bold transition active:scale-95 ${ed.home === h ? 'bg-wine text-bg' : 'bg-ink/10'}`}>{h ? 'Casa' : 'Trasferta'}</button>)}
          </div>
          <Field label="Note"><textarea className={inp + ' h-20 py-2'} value={ed.notes} onChange={(e) => up({ notes: e.target.value })} /></Field>
          <div className="mt-2 flex gap-2">
            {ed.id && <button className={btn + ' text-red-700'} onClick={async () => { if (confirm('Eliminare la partita?')) { await delGame(ed.id!); setEd(null); } }}>Elimina</button>}
            <button className={btnPri + ' flex-1'} onClick={async () => { await saveGame(ed); vib(20); setEd(null); }}>Salva</button>
          </div>
        </>}
      </Sheet>
    </div>
  );
}
