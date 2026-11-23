import { deleteGame } from '@/db/repo';
import type { Game } from '@/db/types';
import { fmtLong } from '@/lib/dates';
import { haptic } from '@/lib/haptics';
import { confirmDialog, toast } from '@/store/feedback';

/** Elimina una partita con il suo resoconto (minuti, INT, grafici), dopo conferma. */
export async function askDeleteGame(g: Game): Promise<boolean> {
  const ok = await confirmDialog({
    title: 'Eliminare la partita?',
    message: `${g.home ? 'vs' : '@'} ${g.opponent} · ${fmtLong(g.date)}. Verranno eliminati la partita e il suo resoconto (minuti, INT e grafici), anche dagli altri dispositivi collegati.`,
    confirmLabel: 'Elimina',
    danger: true,
  });
  if (!ok) return false;
  await deleteGame(g.id!);
  haptic.heavy();
  toast('Partita eliminata');
  return true;
}
