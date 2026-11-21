import { useStore } from './store';
import { Empty } from './ui';
export default function History() {
  const games = useStore((s) => s.games).filter((g) => g.finished).reverse();
  return (
    <div className="p-4"><h1 className="mb-4 text-3xl font-extrabold">Storico</h1>
      {games.length === 0 ? <Empty t="Nessuna partita conclusa" s="Le partite terminate compariranno qui con il resoconto." /> : games.map((g) => {
        const w = (g.scoreUs ?? 0) > (g.scoreThem ?? 0);
        return <div key={g.id} className="mb-2 flex items-center gap-3 rounded-2xl bg-card p-3">
          <span className={`grid h-10 w-10 place-items-center rounded-full font-extrabold ${w ? 'bg-emerald-600/15 text-emerald-700' : 'bg-red-600/15 text-red-700'}`}>{w ? 'V' : 'S'}</span>
          <div className="flex-1"><b>vs {g.opponent}</b><div className="text-xs text-ink/50">{g.date}</div></div><b className="text-xl">{g.scoreUs ?? 0}–{g.scoreThem ?? 0}</b></div>;
      })}
    </div>
  );
}
