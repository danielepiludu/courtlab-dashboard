import { cx } from '@/lib/cx';
import type { Player } from '@/db/types';

interface AvatarProps {
  player: Pick<Player, 'photo' | 'number' | 'name'>;
  size?: number;
  className?: string;
  ring?: boolean;
}

/** Foto circolare del giocatore; senza foto mostra le iniziali. */
export function Avatar({ player, size = 52, className, ring }: AvatarProps) {
  const initials = player.name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join('');
  return (
    <div
      style={{ width: size, height: size }}
      className={cx(
        'relative grid shrink-0 place-items-center overflow-hidden rounded-full bg-gradient-to-br from-navy to-surface-3 font-display font-bold text-ink',
        ring && 'ring-2 ring-line',
        className,
      )}
    >
      {player.photo ? (
        <img src={player.photo} alt={player.name} className="h-full w-full object-cover" draggable={false} />
      ) : (
        <span style={{ fontSize: size * 0.38 }} className="leading-none">
          {initials || player.number || '?'}
        </span>
      )}
    </div>
  );
}
