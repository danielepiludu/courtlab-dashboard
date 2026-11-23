import { describe, expect, it } from 'vitest';
import writeXlsxFile from 'write-excel-file/node';
import readXlsxFile, { readSheetNames } from 'read-excel-file/node';
import fixture from '@/engine/fixtures/srpe-2026-27.json';
import { surnameFirst, type Player, type RpeEntry, type TrainingSession } from '@/db/types';
import { buildLoadReport } from './loadReport';
import { buildLoadSheets } from './loadXlsx';
import { buildLoadPdf } from './loadPdf';
import { parseSrpeRows } from './importSrpe';

const names = [...new Set(fixture.rows.map((r) => r.name))];
const players: Player[] = names.map((name, k) => ({ id: k + 1, teamId: 1, name, number: String(k + 1), role: 'SF', traits: [], notes: '', status: 'available', statusDate: '', statusDetails: '', createdAt: 0, updatedAt: 0 }));
const dates = [...new Set(fixture.rows.map((r) => r.date))].sort();
const sessions: TrainingSession[] = dates.map((date, k) => ({ id: 100 + k, teamId: 1, date, type: k % 6 === 5 ? 'partita' : 'basket', minutes: 90, notes: '', createdAt: 0, updatedAt: 0 }));
const entries: RpeEntry[] = fixture.rows
  .filter((r) => r.rpe != null)
  .map((r, k) => ({ id: k + 1, teamId: 1, sessionId: 100 + dates.indexOf(r.date), playerId: names.indexOf(r.name) + 1, rpe: r.rpe, minutes: r.min === 90 ? null : r.min, source: 'import', updatedAt: 0 }));
const report = buildLoadReport({ team: { name: 'Squadra Test', season: '2026/27', primary: '#002855', secondary: '#ee3239' }, players, sessions, entries, from: dates[0], to: dates[dates.length - 1], windowDays: 7 });

describe('export Excel', () => {
  it('fogli previsti e file valido; il foglio DB si reimporta con gli stessi RPE', async () => {
    const sheets = buildLoadSheets(report);
    expect(sheets.map((s) => s.sheet)).toEqual(['Riepilogo', 'Giorno per giorno', 'Squadra', 'DB']);
    const buf = await writeXlsxFile(sheets as never).toBuffer();
    expect(await readSheetNames(buf)).toEqual(['Riepilogo', 'Giorno per giorno', 'Squadra', 'DB']);
    const rows = await readXlsxFile(buf, { sheet: 'DB' });
    const parsed = parseSrpeRows(rows as never).filter((r) => r.rpe != null);
    expect(parsed.length).toBe(entries.length);
    const key = (n: string, d: string) => `${n.toUpperCase()}|${d}`;
    // nel file i giocatori sono scritti "COGNOME NOME"
    const want = new Map(fixture.rows.filter((r) => r.rpe != null).map((r) => [key(surnameFirst(r.name), r.date), r]));
    for (const p of parsed) {
      const w = want.get(key(p.name, p.date))!;
      expect(p.rpe).toBe(w.rpe);
      expect(p.minutes).toBe(w.min);
    }
  });
  it('riepilogo: una riga per atleta con il Work Load finale', () => {
    const data = buildLoadSheets(report)[0].data;
    const hdr = data.findIndex((r) => (r[0] as { value?: string } | null)?.value === 'Atleta');
    expect(data.slice(hdr + 1, hdr + 1 + players.length)).toHaveLength(players.length);
  });
});

describe('PDF del carico', () => {
  it('pagina squadra con tutti gli atleti e una pagina per atleta', async () => {
    const doc = await buildLoadPdf({ report, athletePages: true, compress: false, generatedAt: new Date('2026-11-23T10:00:00Z') });
    const pages = doc.getNumberOfPages();
    expect(pages).toBeGreaterThanOrEqual(1 + players.length);
    const raw = doc.output();
    for (const n of names) expect(raw).toContain(surnameFirst(n));
    expect(raw).toContain('REPORT CARICO INTERNO');
    expect(raw).toContain('Seduta per seduta');
  });
  it('solo la pagina squadra se non richieste le pagine atleta', async () => {
    const doc = await buildLoadPdf({ report, compress: false });
    expect(doc.getNumberOfPages()).toBeLessThanOrEqual(2);
  });
});
