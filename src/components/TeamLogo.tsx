import type { CSSProperties } from 'react';
import type { Team } from '@/db/types';
import { teamLogoSrc } from '@/theme/apply';
import { readableOn } from '@/theme/color';
import { cx } from '@/lib/cx';

export function teamInitials(name: string): string {
  const words = name
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2 || /^\p{Lu}/u.test(w));
  const pick = words.length > 2 ? words.filter((w) => !/^(pallacanestro|basket|polisportiva|asd|ssd|us|as)$/i.test(w)) : words;
  return (pick.length ? pick : words)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join('') || '?';
}

interface Props {
  team: Pick<Team, 'logo' | 'name' | 'primary' | 'secondary'> | undefined | null;
  size?: number;
  className?: string;
  style?: CSSProperties;
}

/** Logo della squadra; senza logo, iniziali su sfondo del colore primario. */
export function TeamLogo({ team, size = 44, className, style }: Props) {
  const src = teamLogoSrc(team);
  if (src)
    return (
      <img
        src={src}
        width={size}
        height={size}
        alt={team?.name ?? ''}
        draggable={false}
        style={{ width: size, height: size, ...style }}
        className={cx('shrink-0 select-none object-contain drop-shadow-[0_4px_12px_rgba(0,0,0,.5)]', className)}
      />
    );
  const bg = team?.primary ?? '#1b3a6b';
  return (
    <div
      style={{ width: size, height: size, background: bg, color: readableOn(bg), fontSize: size * 0.36, boxShadow: `inset 0 0 0 ${Math.max(2, size * 0.05)}px ${team?.secondary ?? '#fff'}`, ...style }}
      className={cx('grid shrink-0 select-none place-items-center rounded-full font-display font-extrabold tracking-wide', className)}
      aria-label={team?.name}
    >
      {teamInitials(team?.name ?? '')}
    </div>
  );
}
