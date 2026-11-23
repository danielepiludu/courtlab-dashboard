import { useMemo, useState } from 'react';
import { FileDown, FileSpreadsheet, Share2 } from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Sheet } from '@/components/ui/Sheet';
import { Button } from '@/components/ui/Button';
import { Field } from '@/components/ui/misc';
import { db } from '@/db/db';
import type { Player, RpeEntry, Team, TrainingSession } from '@/db/types';
import { todayISO } from '@/lib/dates';
import { haptic } from '@/lib/haptics';
import { cx } from '@/lib/cx';
import { toast } from '@/store/feedback';
import { teamLogoSrc } from '@/theme/apply';
import { contrast, normalizeHex } from '@/theme/color';
import { buildLoadReport, presetRange } from './loadReport';
import { deliverFile } from '@/lib/deliver';

type Preset = 'week' | 'month' | 'season' | 'custom';
const PRESETS: { id: Preset; label: string }[] = [
  { id: 'week', label: 'Ultimi 7 giorni' },
  { id: 'month', label: 'Ultime 4 settimane' },
  { id: 'season', label: 'Tutta la stagione' },
  { id: 'custom', label: 'Personalizzato' },
];

/** Report del carico: periodo, PDF (squadra + pagine atleta) ed Excel. */
export function ExportSheet({
  open,
  onClose,
  team,
  players,
  sessions,
  entries,
  windowDays,
  athleteId,
}: {
  open: boolean;
  onClose: () => void;
  team: Team;
  players: Player[];
  sessions: TrainingSession[];
  entries: RpeEntry[];
  windowDays: number;
  /** report di un solo atleta (aperto dalla sua scheda) */
  athleteId?: number;
}) {
  const [preset, setPreset] = useState<Preset>('month');
  const today = todayISO();
  const first = useMemo(() => [...sessions].map((s) => s.date).sort()[0], [sessions]);
  const [from, setFrom] = useState(() => presetRange('month', today).from);
  const [to, setTo] = useState(today);
  const [pages, setPages] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const games = useLiveQuery(() => db.games.where('teamId').equals(team.id!).toArray(), [team.id]);
  const reports = useLiveQuery(() => db.reports.where('teamId').equals(team.id!).toArray(), [team.id]);
  const athlete = athleteId != null ? players.find((p) => p.id === athleteId) : undefined;

  const range = preset === 'custom' ? { from: from <= to ? from : to, to: from <= to ? to : from } : presetRange(preset, today, first);
  const report = useMemo(
    () => buildLoadReport({ team, players, sessions, entries, games: games ?? [], reports: reports ?? [], from: range.from, to: range.to, windowDays }),
    [team, players, sessions, entries, games, reports, range.from, range.to, windowDays],
  );
  const rpeCount = report.athletes.reduce((n, a) => n + a.answered, 0);

  const run = async (kind: 'pdf' | 'xlsx', mode: 'download' | 'share') => {
    setBusy(kind + mode);
    try {
      let blob: Blob;
      let name: string;
      if (kind === 'pdf') {
        const [{ buildLoadPdf, loadPdfFileName }, { logoForPdf }] = await Promise.all([import('./loadPdf'), import('@/features/report/pdf')]);
        const logo = await logoForPdf(teamLogoSrc(team));
        const doc = await buildLoadPdf({ report, logo, athletePages: athlete ? true : pages, onlyAthletes: athlete ? [athlete.id!] : undefined });
        blob = doc.output('blob');
        name = loadPdfFileName(report, athlete?.name);
      } else {
        const { buildLoadXlsx, loadXlsxFileName } = await import('./loadXlsx');
        const bg = normalizeHex(team.primary) ?? '#002855';
        blob = await buildLoadXlsx(report, { bg, fg: contrast('#ffffff', bg) >= contrast('#111111', bg) ? '#FFFFFF' : '#111111' });
        name = loadXlsxFileName(report);
      }
      const r = await deliverFile(blob, name, mode);
      haptic.confirm();
      toast(r === 'shared' ? 'File pronto da condividere' : `${kind === 'pdf' ? 'PDF' : 'Excel'} salvato nei download`, 'success');
    } catch (e) {
      console.error(e);
      toast('Esportazione non riuscita', 'error');
    } finally {
      setBusy(null);
    }
  };

  return (
    <Sheet open={open} onClose={onClose} title={athlete ? `Report di ${athlete.name}` : 'Report ed export'} subtitle="Carico interno (sRPE) con minuti e INT delle partite monitorate">
      <div className="mb-3 grid grid-cols-2 gap-2">
        {PRESETS.map((p) => (
          <button
            key={p.id}
            onClick={() => (haptic.select(), setPreset(p.id))}
            className={cx('h-11 rounded-xl border text-[14px] font-bold', preset === p.id ? 'border-accent bg-accent/20 text-ink' : 'border-line text-ink-muted')}
          >
            {p.label}
          </button>
        ))}
      </div>
      {preset === 'custom' && (
        <div className="grid grid-cols-2 gap-3">
          <Field label="Dal">
            <input type="date" className="input" value={from} max={today} onChange={(e) => setFrom(e.target.value)} />
          </Field>
          <Field label="Al">
            <input type="date" className="input" value={to} max={today} onChange={(e) => setTo(e.target.value)} />
          </Field>
        </div>
      )}
      <div className="mb-4 rounded-2xl bg-surface p-3 text-[14px] leading-relaxed text-ink-muted">
        <b className="text-ink">
          {report.sessions.length} sedute{report.matchSessions ? ` (${report.matchSessions} partite)` : ''} · {rpeCount} RPE
        </b>
        {report.liveGames > 0 && <> · {report.liveGames === 1 ? '1 partita monitorata' : `${report.liveGames} partite monitorate`} con minuti e INT</>}
        <br />
        Dal {range.from.split('-').reverse().join('/')} al {range.to.split('-').reverse().join('/')} · media mobile {windowDays} giorni
      </div>

      {!athlete && (
        <label className="mb-4 flex cursor-pointer items-center gap-3 rounded-2xl bg-surface p-3">
          <input type="checkbox" className="h-5 w-5 accent-[var(--c-select)]" checked={pages} onChange={(e) => setPages(e.target.checked)} />
          <span className="text-[14px]">
            <b className="block">Pagina per ogni atleta nel PDF</b>
            <span className="text-ink-muted">grafici, seduta per seduta e partite</span>
          </span>
        </label>
      )}

      <div className="grid grid-cols-[1fr_auto] gap-2">
        <Button variant="primary" size="lg" disabled={!!busy || !rpeCount} icon={<FileDown size={20} />} onClick={() => run('pdf', 'download')}>
          {busy === 'pdfdownload' ? 'Creazione…' : 'Scarica PDF'}
        </Button>
        <Button size="lg" aria-label="Condividi PDF" disabled={!!busy || !rpeCount} icon={<Share2 size={20} />} onClick={() => run('pdf', 'share')} />
        {!athlete && (
          <>
            <Button size="lg" disabled={!!busy || !rpeCount} icon={<FileSpreadsheet size={20} />} onClick={() => run('xlsx', 'download')}>
              {busy === 'xlsxdownload' ? 'Creazione…' : 'Scarica Excel'}
            </Button>
            <Button size="lg" aria-label="Condividi Excel" disabled={!!busy || !rpeCount} icon={<Share2 size={20} />} onClick={() => run('xlsx', 'share')} />
          </>
        )}
      </div>
      {!rpeCount && <p className="mt-3 text-center text-[13px] text-ink-muted">Nessun RPE nel periodo scelto.</p>}
      {!athlete && (
        <p className="mt-4 text-[12px] leading-relaxed text-ink-muted">
          L'Excel contiene i fogli Riepilogo, Giorno per giorno, Squadra, DB (stesse colonne del foglio sRPE: si può reimportare) e, se ci sono, Partite.
        </p>
      )}
    </Sheet>
  );
}
