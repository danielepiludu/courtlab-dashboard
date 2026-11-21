import { useState } from 'react';
import { useStore } from './store';
import { ROLES, STATUS, iso, toAvatar, type Player, type Role, type Status } from './db';
import { Sheet, Field, Chip, Avatar, Badge, Empty, inp, btn, btnPri, vib } from './ui';
const blank = (): Player => ({ name: '', number: 0, role: 'PG', traits: '', notes: '', status: 'ok', statusNote: '', statusDate: iso(new Date()) });
export default function Players() {
  const { players, savePlayer, delPlayer } = useStore();
  const [fr, setFr] = useState<Role | ''>(''), [fs, setFs] = useState<Status | ''>('');
  const [ed, setEd] = useState<Player | null>(null);
  const up = (k: Partial<Player>) => setEd((e) => e && { ...e, ...k });
  const list = players.filter((p) => (!fr || p.role === fr) && (!fs || p.status === fs));
  return (
    <div className="p-4">
      <div className="mb-3 flex items-center justify-between"><h1 className="text-3xl font-extrabold">Giocatori</h1>
        <button className={btnPri} onClick={() => { vib(); setEd(blank()); }}>+ Aggiungi</button></div>
      <div className="mb-2 flex gap-2 overflow-x-auto pb-1">
        <Chip on={!fr} onClick={() => setFr('')}>Tutti</Chip>{ROLES.map((r) => <Chip key={r} on={fr === r} onClick={() => setFr(fr === r ? '' : r)}>{r}</Chip>)}
      </div>
      <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
        <Chip on={!fs} onClick={() => setFs('')}>Ogni stato</Chip>{(Object.keys(STATUS) as Status[]).map((s) => <Chip key={s} on={fs === s} onClick={() => setFs(fs === s ? '' : s)}>{STATUS[s].l}</Chip>)}
      </div>
      {list.length === 0 ? <Empty t="Nessun giocatore" s="Aggiungi i giocatori della squadra." /> : list.map((p) => (
        <button key={p.id} onClick={() => setEd(p)} className="mb-2 flex w-full items-center gap-3 rounded-2xl bg-card p-3 text-left transition active:scale-[.98]">
          <Avatar p={p} /><div className="min-w-0 flex-1"><b className="block truncate text-lg">#{p.number} {p.name}</b>
            <span className="text-sm text-white/50">{p.role} · Min tot — · Intensità —</span></div><Badge s={p.status} />
        </button>))}
      <Sheet open={!!ed} onClose={() => setEd(null)} title={ed?.id ? 'Scheda giocatore' : 'Nuovo giocatore'}>
        {ed && <>
          <label className="mb-4 flex items-center gap-4"><Avatar p={ed} size={84} />
            <span className={btn + ' grid place-items-center'}>📷 Foto</span>
            <input type="file" accept="image/*" hidden onChange={async (e) => { const f = e.target.files?.[0]; if (f) up({ photo: await toAvatar(f) }); }} /></label>
          <div className="grid grid-cols-[90px_1fr] gap-3">
            <Field label="Numero"><input type="number" inputMode="numeric" className={inp} value={ed.number || ''} onChange={(e) => up({ number: +e.target.value })} /></Field>
            <Field label="Nome"><input className={inp} value={ed.name} onChange={(e) => up({ name: e.target.value })} /></Field>
          </div>
          <Field label="Ruolo"><div className="flex gap-2">{ROLES.map((r) => <Chip key={r} on={ed.role === r} onClick={() => up({ role: r })}>{r}</Chip>)}</div></Field>
          <Field label="Caratteristiche di gioco"><input className={inp} placeholder="es. tiratore, difensore, rimbalzista" value={ed.traits} onChange={(e) => up({ traits: e.target.value })} /></Field>
          <Field label="Stato"><div className="flex gap-2">{(Object.keys(STATUS) as Status[]).map((s) => <Chip key={s} on={ed.status === s} onClick={() => up({ status: s })}>{STATUS[s].l}</Chip>)}</div></Field>
          {ed.status !== 'ok' && <div className="grid grid-cols-2 gap-3">
            <Field label="Dal"><input type="date" className={inp} value={ed.statusDate} onChange={(e) => up({ statusDate: e.target.value })} /></Field>
            <Field label="Dettagli"><input className={inp} placeholder="es. distorsione caviglia" value={ed.statusNote} onChange={(e) => up({ statusNote: e.target.value })} /></Field>
          </div>}
          <Field label="Note"><textarea className={inp + ' h-24 py-2'} value={ed.notes} onChange={(e) => up({ notes: e.target.value })} /></Field>
          <div className="mt-2 flex gap-2">
            {ed.id && <button className={btn + ' text-red-400'} onClick={async () => { if (confirm('Eliminare il giocatore?')) { await delPlayer(ed.id!); setEd(null); } }}>Elimina</button>}
            <button className={btnPri + ' flex-1'} disabled={!ed.name.trim()} onClick={async () => { await savePlayer(ed); vib(20); setEd(null); }}>Salva</button>
          </div>
        </>}
      </Sheet>
    </div>
  );
}
