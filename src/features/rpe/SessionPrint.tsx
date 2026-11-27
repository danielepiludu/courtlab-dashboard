import { useEffect, useRef, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { APP } from '@/config';
import { SESSION_TYPE_LABEL, surnameFirst, type Player, type RpeEntry, type Team, type TrainingSession } from '@/db/types';
import { acwrZone } from '@/engine/load';
import { fmtLong } from '@/lib/dates';
import { printColor } from '@/features/report/pdf';
import { sessionPalette, sessionSummary } from './sessionPdf';

export interface SessionPrintData {
  session: TrainingSession;
  team: Pick<Team, 'name' | 'primary' | 'secondary'>;
  players: Player[];
  entries: RpeEntry[];
  workLoad: Map<number, number | null>;
  logo?: string;
}

const css = (c: [number, number, number]) => `rgb(${c.join(',')})`;
const n1 = (v: number) => v.toFixed(1).replace('.', ',').replace(',0', '');
const ZONE = { high: { c: '#d62020', t: 'sopra 1,3' }, ok: { c: '#1e965a', t: 'in zona' }, low: { c: '#de8c00', t: 'sotto 0,8' } } as const;

/**
 * Pagina di stampa della seduta (A4, sfondo bianco), uguale al PDF.
 * Visibile solo in stampa: apre la finestra di stampa del sistema e si chiude da sola.
 */
export function SessionPrint({ data, onDone }: { data: SessionPrintData; onDone: () => void }) {
  const done = useRef(onDone);
  done.current = onDone;
  useEffect(() => {
    const end = () => done.current();
    window.addEventListener('afterprint', end);
    // aspetta il logo (se c'è) e il disegno della pagina, poi stampa
    const imgs = [...document.querySelectorAll<HTMLImageElement>('#print-root img')];
    let cancelled = false;
    void Promise.all(imgs.map((i) => (i.complete ? null : new Promise((r) => ((i.onload = r), (i.onerror = r)))))).then(() =>
      requestAnimationFrame(() => {
        if (cancelled) return;
        try {
          window.print();
        } catch {
          end();
        }
      }),
    );
    return () => {
      cancelled = true;
      window.removeEventListener('afterprint', end);
    };
  }, []);

  const { session: s, team } = data;
  const pal = sessionPalette(team);
  const { rows, answered, rpeAvg, tlAvg, tlTot, hasWl } = sessionSummary(data);
  const now = new Date();
  const tiles: [string, string, string?][] = [
    ['Risposte', `${answered.length}/${rows.length}`],
    ['RPE medio', rpeAvg == null ? '–' : rpeAvg.toFixed(1).replace('.', ','), rpeAvg == null ? undefined : css(printColor(rpeAvg / 10))],
    ['TL medio', tlAvg == null ? '–' : String(Math.round(tlAvg))],
    ['TL totale', answered.length ? Math.round(tlTot).toLocaleString('it-IT') : '–'],
  ];

  return createPortal(
    <div id="print-root" style={{ '--pr-primary': pal.primary, '--pr-accent': pal.accent, '--pr-on': pal.onPrimary } as CSSProperties}>
      <header className="pr-head">
        {data.logo && <img src={data.logo} alt="" className="pr-logo" />}
        <div className="pr-grow">
          <div className="pr-kicker">RPE · {SESSION_TYPE_LABEL[s.type].toUpperCase()}</div>
          <div className="pr-title">{fmtLong(s.date)}</div>
          <div className="pr-sub">
            {team.name} · durata {s.minutes} min
          </div>
        </div>
        <div className="pr-kicker">{APP.name}</div>
      </header>

      <div className="pr-tiles">
        {tiles.map(([label, value, color]) => (
          <div key={label} className="pr-tile">
            <div className="pr-tile-label">{label}</div>
            <div className="pr-tile-value" style={color ? { color } : undefined}>
              {value}
            </div>
          </div>
        ))}
      </div>

      <table className="pr-table">
        <thead>
          <tr>
            <th className="pr-c">N.</th>
            <th>Atleta</th>
            <th>RPE</th>
            <th>Percezione</th>
            <th className="pr-r">Min</th>
            <th className="pr-r">TL</th>
            {hasWl && <th className="pr-r">Work Load</th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const muted = r.rpe == null;
            const c = r.rpe != null ? css(printColor(r.rpe / 10)) : undefined;
            const z = !muted ? acwrZone(r.wl) : null;
            return (
              <tr key={r.p.id} className={muted ? 'pr-muted' : undefined}>
                <td className="pr-c pr-num">{r.p.number || '–'}</td>
                <td className="pr-name">{surnameFirst(r.p.name)}</td>
                <td>
                  {r.rpe != null ? (
                    <span className="pr-rpe">
                      <span className="pr-bar">
                        <i style={{ width: `${Math.max(6, r.rpe * 10)}%`, background: c }} />
                      </span>
                      <b style={{ color: c }}>{n1(r.rpe)}</b>
                    </span>
                  ) : (
                    '–'
                  )}
                </td>
                <td>{muted ? 'Nessuna risposta' : r.label}</td>
                <td className="pr-r">{r.minutes}</td>
                <td className="pr-r pr-strong">{r.tl != null ? Math.round(r.tl) : '–'}</td>
                {hasWl && (
                  <td className="pr-r pr-strong">
                    {z && r.wl != null ? (
                      <>
                        <i className="pr-dot" style={{ background: ZONE[z].c }} />
                        {r.wl.toFixed(2).replace('.', ',')}
                      </>
                    ) : (
                      '–'
                    )}
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>

      <p className="pr-note">
        RPE = fatica percepita (scala CR-10, 0–10). TL = RPE × minuti.
        {hasWl && ` Work Load = TL del giorno ÷ media personale; punto: rosso ${ZONE.high.t}, verde ${ZONE.ok.t}, arancio ${ZONE.low.t}.`}
      </p>
      <footer className="pr-foot">
        {APP.name} · {APP.credit} · stampato il {now.toLocaleDateString('it-IT')} alle {now.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}
      </footer>
    </div>,
    document.body,
  );
}
