import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { ArrowLeftRight, Camera, CirclePlay, Image as ImageIcon, Palette, Sparkles, X } from 'lucide-react';
import { Sheet } from '@/components/ui/Sheet';
import { Button } from '@/components/ui/Button';
import { Field } from '@/components/ui/misc';
import { PhotoCropper } from '@/components/PhotoCropper';
import { TeamLogo } from '@/components/TeamLogo';
import { saveTeam } from '@/db/repo';
import type { Team } from '@/db/types';
import { hasTransparency, loadImageFile, trimAndExportLogo } from '@/lib/image';
import { haptic } from '@/lib/haptics';
import { cx } from '@/lib/cx';
import { toast } from '@/store/feedback';
import { buildPalette } from '@/theme/palette';
import { teamLogoSrc, themeVars } from '@/theme/apply';
import { extractSwatches, proposeTeamColors, type Swatch } from '@/theme/extract';
import { normalizeHex, readableOn } from '@/theme/color';
import { currentSeason, nextSeason } from '@/config';

const PRESETS = ['#002855', '#0a3d91', '#1976d2', '#4fc3f7', '#c8102e', '#ee3239', '#7b1e2b', '#0b5d3b', '#2bb673', '#f2b705', '#f57c00', '#6a1b9a', '#111111', '#5f6b7a', '#ffffff'];

type Target = 'primary' | 'secondary';

interface Props {
  team: Team | null;
  onClose: () => void;
  onSaved?: (id: number, created: boolean) => void;
}

/** Mini anteprima del tema: header, card, pulsante principale, selezione, tab bar. */
function ThemePreview({ team }: { team: Team }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-night shadow-card">
      <div className="flex items-center gap-2.5 bg-bar px-3 py-2.5">
        <TeamLogo team={team} size={30} />
        <div className="min-w-0 flex-1">
          <div className="truncate font-display text-[15px] font-bold leading-none">{team.name || 'Nome squadra'}</div>
          <div className="mt-0.5 text-[11px] text-ink-muted">{team.season}</div>
        </div>
      </div>
      <div className="space-y-2.5 p-3">
        <div className="flex items-center gap-2 rounded-xl border border-line bg-surface p-2.5">
          <span className="grid h-9 w-9 place-items-center rounded-full bg-surface-3 font-display font-bold">7</span>
          <div className="min-w-0 flex-1">
            <div className="text-[13px] font-bold">
              <span className="text-brand-text">#7</span> Giocatore
            </div>
            <div className="text-[11px] text-ink-muted">Testo secondario</div>
          </div>
          <span className="rounded-lg border border-accent bg-accent/20 px-2 py-1 text-[11px] font-bold text-ink shadow-select-sm">Selezionato</span>
        </div>
        <div className="flex gap-2">
          <span className="flex h-10 flex-1 items-center justify-center gap-1.5 rounded-xl bg-brand text-[13px] font-bold text-on-brand shadow-brand">
            <CirclePlay size={16} /> Inizia partita
          </span>
          <span className="flex h-10 items-center rounded-xl bg-accent px-3 text-[13px] font-bold text-on-accent">Casa</span>
        </div>
      </div>
      <div className="grid grid-cols-4 border-t border-white/5 bg-bar py-1.5 text-center text-[10px] font-semibold">
        {['Home', 'Giocatori', 'Partita', 'Resoconti'].map((l, i) => (
          <div key={l} className={i === 0 ? 'text-ink' : 'text-ink-muted'}>
            <div className={cx('mx-auto mb-0.5 h-1.5 w-6 rounded-full', i === 0 ? 'bg-brand' : 'bg-white/10')} />
            {l}
          </div>
        ))}
      </div>
    </div>
  );
}

function ColorTarget({ label, color, active, onClick }: { label: string; color: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={() => {
        haptic.tap();
        onClick();
      }}
      className={cx('pressable flex flex-1 items-center gap-3 rounded-2xl border p-2.5 text-left transition-shadow', active ? 'border-accent bg-accent/10 shadow-glow' : 'border-line bg-night/40')}
    >
      <span className="h-11 w-11 shrink-0 rounded-xl border border-white/15" style={{ background: color }} />
      <span className="min-w-0">
        <span className="block text-[11px] font-bold uppercase tracking-widest text-ink-muted">{label}</span>
        <span className="block font-mono text-[14px] font-semibold uppercase">{color}</span>
      </span>
    </button>
  );
}

function SwatchButton({ hex, onClick, selected }: { hex: string; onClick: () => void; selected: boolean }) {
  return (
    <button
      onClick={() => {
        haptic.tap();
        onClick();
      }}
      aria-label={hex}
      className={cx('grid h-11 w-11 shrink-0 place-items-center rounded-full border-2 transition active:scale-90', selected ? 'border-ink' : 'border-white/10')}
      style={{ background: hex }}
    >
      {selected && <span className="h-2.5 w-2.5 rounded-full" style={{ background: readableOn(hex) }} />}
    </button>
  );
}

/** Crea o modifica una squadra: nome, stagione, logo, colori con anteprima live del tema. */
export function TeamFormSheet({ team, onClose, onSaved }: Props) {
  const [draft, setDraft] = useState<Team | null>(team);
  const [target, setTarget] = useState<Target>('primary');
  const [swatches, setSwatches] = useState<Swatch[]>([]);
  const [crop, setCrop] = useState<HTMLCanvasElement | null>(null);
  const [busy, setBusy] = useState(false);
  const camRef = useRef<HTMLInputElement>(null);
  const galRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!team) return;
    setDraft(team);
    setTarget('primary');
    setSwatches([]);
    const src = teamLogoSrc(team);
    if (src) extractSwatches(src).then(setSwatches).catch(() => setSwatches([]));
  }, [team]);

  const up = (p: Partial<Team>) => setDraft((d) => (d ? { ...d, ...p } : d));
  const vars = useMemo(() => (draft ? (themeVars(draft.primary, draft.secondary) as CSSProperties) : undefined), [draft?.primary, draft?.secondary]); // eslint-disable-line react-hooks/exhaustive-deps
  const adjusted = draft ? buildPalette(draft.primary, draft.secondary).adjusted : false;
  const valid = !!draft && draft.name.trim().length > 0 && draft.season.trim().length > 0;
  const current = draft ? draft[target] : '#000000';

  const setColor = (hex: string) => {
    const h = normalizeHex(hex);
    if (h) up({ [target]: h } as Partial<Team>);
  };

  const applyLogo = async (dataUrl: string) => {
    up({ logo: dataUrl });
    try {
      const sw = await extractSwatches(dataUrl);
      setSwatches(sw);
      const pr = proposeTeamColors(sw);
      if (pr) {
        up({ primary: pr.primary, secondary: pr.secondary });
        haptic.confirm();
        toast('Colori proposti dal logo: puoi modificarli', 'info', 3000);
      }
    } catch {
      /* analisi colori non riuscita: restano quelli attuali */
    }
  };

  const pickFile = async (f: File | undefined) => {
    if (!f) return;
    try {
      const c = await loadImageFile(f, 1024);
      if (hasTransparency(c)) await applyLogo(trimAndExportLogo(c));
      else setCrop(c);
    } catch {
      toast("Impossibile leggere l'immagine", 'error');
    }
  };

  const save = async () => {
    if (!draft || !valid) return;
    setBusy(true);
    try {
      const created = !draft.id;
      const id = await saveTeam(draft);
      haptic.confirm();
      onSaved?.(id, created);
      onClose();
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Sheet
        open={!!team}
        onClose={onClose}
        elevated
        style={vars}
        title={draft?.id ? 'Modifica squadra' : 'Nuova squadra'}
        subtitle="Anteprima live del tema"
        footer={
          <Button variant="primary" size="lg" className="w-full" disabled={!valid || busy} onClick={save}>
            {draft?.id ? 'Salva squadra' : 'Crea squadra'}
          </Button>
        }
      >
        {draft && (
          <>
            {/* Logo */}
            <div className="mb-5 flex items-center gap-4">
              <div className="relative">
                <div className="grid h-[104px] w-[104px] place-items-center rounded-3xl border border-line bg-night/60 p-2">
                  <TeamLogo team={draft} size={86} />
                </div>
                {draft.logo && (
                  <button
                    onClick={() => up({ logo: undefined })}
                    aria-label="Rimuovi logo"
                    className="absolute -right-2 -top-2 grid h-9 w-9 place-items-center rounded-full border border-line bg-surface-2 text-ink-muted active:scale-90"
                  >
                    <X size={16} />
                  </button>
                )}
              </div>
              <div className="flex flex-1 flex-col gap-2">
                <span className="label !mb-0">Logo</span>
                <Button size="sm" icon={<Camera size={18} />} onClick={() => camRef.current?.click()}>
                  Fotocamera
                </Button>
                <Button size="sm" icon={<ImageIcon size={18} />} onClick={() => galRef.current?.click()}>
                  Galleria
                </Button>
              </div>
              <input ref={camRef} type="file" accept="image/*" capture="environment" hidden onChange={(e) => (void pickFile(e.target.files?.[0]), (e.target.value = ''))} />
              <input ref={galRef} type="file" accept="image/*" hidden onChange={(e) => (void pickFile(e.target.files?.[0]), (e.target.value = ''))} />
            </div>

            <Field label="Nome squadra">
              <input className="input" autoCapitalize="words" placeholder="es. Pallacanestro Don Bosco U17" value={draft.name} onChange={(e) => up({ name: e.target.value })} />
            </Field>
            <Field label="Stagione">
              <div className="flex gap-2">
                <input className="input" placeholder="2026/27" value={draft.season} onChange={(e) => up({ season: e.target.value })} />
                {[currentSeason(), nextSeason(currentSeason())]
                  .filter((s) => s !== draft.season)
                  .map((s) => (
                    <button key={s} onClick={() => up({ season: s })} className="h-12 shrink-0 rounded-xl border border-line px-3 text-sm font-bold text-accent-light active:scale-95">
                      {s}
                    </button>
                  ))}
              </div>
            </Field>

            {/* Colori */}
            <div className="mb-2 flex items-end justify-between">
              <span className="label !mb-0">Colori</span>
              <button
                onClick={() => {
                  haptic.tap();
                  up({ primary: draft.secondary, secondary: draft.primary });
                }}
                className="flex h-9 items-center gap-1.5 rounded-full px-3 text-sm font-bold text-accent-light active:scale-95"
              >
                <ArrowLeftRight size={15} /> Inverti
              </button>
            </div>
            <div className="mb-3 flex gap-2">
              <ColorTarget label="Primario" color={draft.primary} active={target === 'primary'} onClick={() => setTarget('primary')} />
              <ColorTarget label="Secondario" color={draft.secondary} active={target === 'secondary'} onClick={() => setTarget('secondary')} />
            </div>
            {swatches.length > 0 && (
              <>
                <div className="mb-1.5 flex items-center gap-1.5 text-[12px] font-semibold text-ink-muted">
                  <Sparkles size={14} className="text-accent-light" /> Dal logo
                </div>
                <div className="no-scrollbar -mx-5 mb-3 flex gap-2 overflow-x-auto px-5 py-1">
                  {swatches.map((s) => (
                    <SwatchButton key={s.hex} hex={s.hex} selected={current === s.hex} onClick={() => setColor(s.hex)} />
                  ))}
                </div>
              </>
            )}
            <div className="mb-1.5 text-[12px] font-semibold text-ink-muted">Palette</div>
            <div className="no-scrollbar -mx-5 mb-3 flex gap-2 overflow-x-auto px-5 py-1">
              {PRESETS.map((hex) => (
                <SwatchButton key={hex} hex={hex} selected={current === hex} onClick={() => setColor(hex)} />
              ))}
            </div>
            <div className="mb-4 flex gap-2">
              <label className="relative flex h-12 flex-1 cursor-pointer items-center justify-center gap-2 rounded-xl border border-line bg-surface-2 text-[15px] font-semibold active:scale-[.97]">
                <Palette size={18} /> Colore personalizzato
                <input type="color" value={current} onChange={(e) => setColor(e.target.value)} className="absolute inset-0 cursor-pointer opacity-0" aria-label="Scegli colore" />
              </label>
              <input
                key={`${target}-${current}`}
                className="input w-[116px] text-center font-mono uppercase"
                defaultValue={current}
                maxLength={7}
                onBlur={(e) => setColor(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && setColor((e.target as HTMLInputElement).value)}
                aria-label="Codice colore"
              />
            </div>

            <span className="label">Anteprima</span>
            <ThemePreview team={draft} />
            {adjusted && (
              <p className="mt-2.5 text-[13px] leading-snug text-ink-muted">Alcuni colori sono stati adattati automaticamente per garantire sfondi scuri e testi leggibili.</p>
            )}
          </>
        )}
      </Sheet>
      <PhotoCropper
        source={crop}
        shape="square"
        title="Ritaglia logo"
        onCancel={() => setCrop(null)}
        onDone={(png) => {
          setCrop(null);
          void applyLogo(png);
        }}
      />
    </>
  );
}
