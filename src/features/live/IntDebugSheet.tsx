import { Sheet } from '@/components/ui/Sheet';
import type { Player } from '@/db/types';
import { INT_CONFIG } from '@/engine/intConfig';
import { ratePerMin } from '@/engine/int';
import { cx } from '@/lib/cx';
import { intColor } from './PlayerCards';
import { intNow, mmss, restMs, type LiveState } from './liveModel';

const min = (ms: number) => (ms / 60_000).toFixed(2);

/**
 * Vista debug (nascosta: tieni premuto sul cronometro).
 * Mostra per ogni giocatore i valori usati dal calcolo INT, aggiornati in tempo reale.
 */
export function IntDebugSheet({ open, onClose, v, now, players }: { open: boolean; onClose: () => void; v: LiveState; now: number; players: Player[] }) {
  const c = INT_CONFIG;
  const rows = players.map((p) => {
    const s = v.players[p.id!];
    const int = intNow(v, p.id!, now);
    let regime: string;
    let detail: string;
    if (!v.started) {
      regime = 'fermo';
      detail = 'partita non iniziata';
    } else if (s.onCourt && v.running) {
      regime = 'a) sale';
      detail = `${ratePerMin(s.stintMs, s.playedMs).toFixed(2)} pt/min`;
    } else if (s.onCourt) {
      regime = 'b) scende piano';
      detail = `τ ${c.tauCourtStoppedMin}′ · base ${s.int.toFixed(1)}`;
    } else {
      regime = 'c) recupero';
      detail = `uscita ${s.int.toFixed(1)} · τ ${c.tauBenchMin}′ · ${mmss(restMs(s, now))}`;
    }
    return { p, s, int, regime, detail };
  });
  return (
    <Sheet open={open} onClose={onClose} wide title="Debug INT" subtitle="Valori del calcolo in tempo reale (vista nascosta)">
      <div className="mb-3 rounded-xl border border-line bg-night/50 p-3 font-mono text-[12px] leading-relaxed text-ink-muted">
        a) punti/min = ({c.baseRate} + {c.consecutiveCoef} × min consecutivi) × (1 + {c.totalCoef} × min totali) · max {c.max}
        <br />
        b) in campo, cronometro fermo: INT × exp(−t / {c.tauCourtStoppedMin} min reali)
        <br />
        c) in panchina: INT_uscita × exp(−t / {c.tauBenchMin} min reali) · campioni ogni {c.sampleEveryMs / 1000}s ({v.samples.length})
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-left text-[13px] tabular">
          <thead className="text-[11px] uppercase tracking-wider text-ink-muted">
            <tr className="border-b border-line">
              <th className="py-2 pr-2">Giocatore</th>
              <th className="pr-2">Dove</th>
              <th className="pr-2 text-right">INT</th>
              <th className="pr-2 text-right">Picco</th>
              <th className="pr-2 text-right">Consec.</th>
              <th className="pr-2 text-right">Totali</th>
              <th className="pr-2 text-right">Ingr.</th>
              <th className="pr-2">Regime</th>
              <th>Dettaglio</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ p, s, int, regime, detail }) => (
              <tr key={p.id} className="border-b border-line/60">
                <td className="py-1.5 pr-2 font-semibold">
                  #{p.number} {p.name}
                </td>
                <td className={cx('pr-2', s.onCourt ? 'text-accent-light' : 'text-ink-muted')}>{s.onCourt ? 'campo' : 'panchina'}</td>
                <td className="pr-2 text-right font-bold" style={{ color: intColor(int) }}>
                  {int.toFixed(1)}
                </td>
                <td className="pr-2 text-right">{s.peak.toFixed(1)}</td>
                <td className="pr-2 text-right">{min(s.stintMs)}′</td>
                <td className="pr-2 text-right">{min(s.playedMs)}′</td>
                <td className="pr-2 text-right">{s.entries}</td>
                <td className="pr-2">{regime}</td>
                <td className="text-ink-muted">{detail}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Sheet>
  );
}
