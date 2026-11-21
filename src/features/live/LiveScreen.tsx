import { ArrowLeft, Construction, RotateCw } from 'lucide-react';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { Logo } from '@/components/ui/misc';
import { useGame, usePlayers } from '@/db/hooks';
import { exitGameMode, useWakeLock } from '@/lib/device';
import { useUI } from '@/store/ui';

/**
 * Secondo substrato: schermata partita (landscape, fullscreen, senza tab bar).
 * FASE 1: segnaposto che verifica ingresso/uscita, schermo intero e wake lock.
 * Campo, REST, timer e cambi arrivano nella Fase 2.
 */
export function LiveScreen() {
  const setup = useUI((s) => s.setup);
  const setSubstrate = useUI((s) => s.setSubstrate);
  const game = useGame(setup.gameId);
  const players = usePlayers() ?? [];
  useWakeLock(true);

  const onCourt = players.filter((p) => setup.starters.includes(p.id!));
  const rest = players.filter((p) => setup.called.includes(p.id!) && !setup.starters.includes(p.id!));

  const exit = async () => {
    await exitGameMode();
    setSubstrate('tabs');
  };

  return (
    <div className="fixed inset-0 flex flex-col bg-night">
      {/* Avviso in verticale */}
      <div className="fixed inset-0 z-[60] hidden flex-col items-center justify-center gap-4 bg-night p-8 text-center portrait:flex">
        <RotateCw size={56} className="animate-[spin_3s_linear_infinite] text-accent-light" />
        <b className="font-display text-3xl tracking-wide">Ruota il telefono</b>
        <span className="max-w-xs text-ink-muted">La schermata partita si usa in orizzontale.</span>
        <Button className="mt-4" icon={<ArrowLeft size={18} />} onClick={exit}>
          Esci
        </Button>
      </div>

      <header className="flex h-16 shrink-0 items-center gap-4 border-b border-white/5 bg-navy px-4">
        <Logo size={40} />
        <div className="flex-1">
          <div className="font-display text-2xl font-bold leading-none">Don Bosco {game ? (game.home ? 'vs' : '@') : ''} {game?.opponent}</div>
          <div className="text-[13px] text-ink-muted">Anteprima Fase 1</div>
        </div>
        <Button icon={<ArrowLeft size={18} />} onClick={exit}>
          Torna indietro
        </Button>
      </header>
      <div className="flex min-h-0 flex-1 items-center justify-center gap-10 p-6">
        <div className="max-w-md text-center">
          <Construction size={44} className="mx-auto text-brand" />
          <h2 className="mt-3 font-display text-3xl font-bold">Schermata partita</h2>
          <p className="mt-2 text-ink-muted">Campo, card giocatori, colonna REST, timer e cambi arrivano nella Fase 2. Qui verifichi già schermo intero, orientamento e schermo sempre acceso.</p>
        </div>
        <div className="space-y-4">
          <div>
            <div className="label">In campo</div>
            <div className="flex gap-2">
              {onCourt.map((p) => (
                <Avatar key={p.id} player={p} size={56} />
              ))}
            </div>
          </div>
          <div>
            <div className="label">REST</div>
            <div className="flex max-w-md flex-wrap gap-2">
              {rest.map((p) => (
                <Avatar key={p.id} player={p} size={44} />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
