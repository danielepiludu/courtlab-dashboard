import { useEffect, useRef, useState } from 'react';
import { Camera, Image as ImageIcon, Plus, Trash, X } from 'lucide-react';
import { Sheet } from '@/components/ui/Sheet';
import { Button } from '@/components/ui/Button';
import { Segmented } from '@/components/ui/Chip';
import { Avatar } from '@/components/ui/Avatar';
import { STATUS_META } from '@/components/ui/Badges';
import { Field } from '@/components/ui/misc';
import { PhotoCropper } from '@/components/PhotoCropper';
import { deletePlayer, savePlayer } from '@/db/repo';
import { usePlayers } from '@/db/hooks';
import { ROLES, ROLE_LABEL, STATUSES, type Player, type PlayerStatus } from '@/db/types';
import { loadImageFile } from '@/lib/image';
import { confirmDialog, toast } from '@/store/feedback';
import { useSetup, useUI } from '@/store/ui';
import { haptic } from '@/lib/haptics';
import { cx } from '@/lib/cx';

export const TRAIT_SUGGESTIONS = [
  'Tiratore',
  'Difensore',
  'Rimbalzista',
  'Playmaker',
  'Penetratore',
  'Atletico',
  'Post basso',
  'Stoppatore',
  'Velocità',
  'Visione di gioco',
  'Leader',
  'Energia dalla panchina',
];

interface Props {
  player: Player | null;
  /** squadra archiviata: solo consultazione */
  readOnly?: boolean;
  onClose: () => void;
}

/** Scheda giocatore: foto, dati, caratteristiche, stato e note. */
export function PlayerFormSheet({ player, readOnly = false, onClose }: Props) {
  const [draft, setDraft] = useState<Player | null>(player);
  const [crop, setCrop] = useState<HTMLCanvasElement | null>(null);
  const [customTrait, setCustomTrait] = useState('');
  const [busy, setBusy] = useState(false);
  const camRef = useRef<HTMLInputElement>(null);
  const galRef = useRef<HTMLInputElement>(null);
  const players = usePlayers();
  const setup = useSetup();
  const patchSetup = useUI((s) => s.patchSetup);

  useEffect(() => {
    if (player) {
      setDraft(player);
      setCustomTrait('');
    }
  }, [player]);

  const up = (p: Partial<Player>) => setDraft((d) => (d ? { ...d, ...p } : d));
  const duplicate = draft && draft.number !== '' ? players?.find((p) => p.number === draft.number && p.id !== draft.id) : undefined;
  const valid = !!draft && draft.name.trim().length > 0;

  const pickFile = async (f: File | undefined) => {
    if (!f) return;
    try {
      setCrop(await loadImageFile(f));
    } catch {
      toast('Impossibile leggere la foto', 'error');
    }
  };

  const toggleTrait = (t: string) => {
    if (!draft) return;
    up({ traits: draft.traits.includes(t) ? draft.traits.filter((x) => x !== t) : [...draft.traits, t] });
  };

  const addCustom = () => {
    const t = customTrait.trim();
    if (!t || !draft) return;
    if (!draft.traits.some((x) => x.toLowerCase() === t.toLowerCase())) up({ traits: [...draft.traits, t] });
    haptic.tap();
    setCustomTrait('');
  };

  const save = async () => {
    if (!draft || !valid) return;
    setBusy(true);
    try {
      const id = await savePlayer(draft);
      // Un giocatore appena segnato infortunato esce dai convocati della partita in preparazione
      if (draft.status === 'injured' && !setup.allowInjured && setup.called.includes(id)) {
        patchSetup({ called: setup.called.filter((x) => x !== id), starters: setup.starters.filter((x) => x !== id) });
      }
      haptic.confirm();
      toast(draft.id ? 'Scheda aggiornata' : 'Giocatore aggiunto', 'success');
      onClose();
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!draft?.id) return;
    const ok = await confirmDialog({
      title: `Eliminare ${draft.name || 'il giocatore'}?`,
      message: 'La scheda verrà rimossa. I resoconti delle partite già giocate restano invariati.',
      confirmLabel: 'Elimina',
      danger: true,
    });
    if (!ok) return;
    await deletePlayer(draft.id);
    patchSetup({ called: setup.called.filter((x) => x !== draft.id), starters: setup.starters.filter((x) => x !== draft.id) });
    haptic.heavy();
    toast('Giocatore eliminato');
    onClose();
  };

  const customTraits = draft?.traits.filter((t) => !TRAIT_SUGGESTIONS.includes(t)) ?? [];

  return (
    <>
      <Sheet
        open={!!player}
        onClose={onClose}
        title={draft?.id ? 'Scheda giocatore' : 'Nuovo giocatore'}
        footer={
          !readOnly && (
          <div className="flex gap-3">
            {draft?.id && <Button variant="danger" size="lg" className="px-4" onClick={remove} aria-label="Elimina giocatore" icon={<Trash size={20} />} />}
            <Button variant="primary" size="lg" className="flex-1" disabled={!valid || busy} onClick={save}>
              {draft?.id ? 'Salva scheda' : 'Aggiungi giocatore'}
            </Button>
          </div>
          )
        }
      >
        {draft && (
          <fieldset disabled={readOnly} className="min-w-0">
            {/* Foto */}
            <div className="mb-5 flex flex-col items-center">
              <div className="relative">
                <Avatar player={draft} size={128} className="shadow-[0_0_0_3px_var(--c-line),0_16px_40px_-12px_rgba(0,0,0,.9)]" />
                {draft.photo && !readOnly && (
                  <button
                    onClick={() => up({ photo: undefined })}
                    aria-label="Rimuovi foto"
                    className="absolute -right-1 top-0 grid h-9 w-9 place-items-center rounded-full border border-line bg-surface-2 text-ink-muted active:scale-90"
                  >
                    <X size={16} />
                  </button>
                )}
              </div>
              <div className={readOnly ? 'hidden' : 'mt-4 flex gap-2'}>
                <Button size="sm" icon={<Camera size={18} />} onClick={() => camRef.current?.click()}>
                  Fotocamera
                </Button>
                <Button size="sm" icon={<ImageIcon size={18} />} onClick={() => galRef.current?.click()}>
                  Galleria
                </Button>
              </div>
              <input
                ref={camRef}
                type="file"
                accept="image/*"
                capture="environment"
                hidden
                onChange={(e) => {
                  void pickFile(e.target.files?.[0]);
                  e.target.value = '';
                }}
              />
              <input
                ref={galRef}
                type="file"
                accept="image/*"
                hidden
                onChange={(e) => {
                  void pickFile(e.target.files?.[0]);
                  e.target.value = '';
                }}
              />
            </div>

            <div className="grid grid-cols-[96px_1fr] gap-3">
              <Field label="Numero">
                <input
                  className={cx('input text-center font-display text-xl font-bold', duplicate && '!border-warn')}
                  inputMode="numeric"
                  maxLength={2}
                  placeholder="#"
                  value={draft.number}
                  onChange={(e) => up({ number: e.target.value.replace(/\D/g, '').slice(0, 2) })}
                />
              </Field>
              <Field label="Nome e cognome">
                <input className="input" autoCapitalize="words" placeholder="es. Marco Bianchi" value={draft.name} onChange={(e) => up({ name: e.target.value })} />
              </Field>
            </div>
            {duplicate && <p className="-mt-2 mb-4 text-[13px] font-semibold text-warn">Il numero {draft.number} è già di {duplicate.name}</p>}
            <Field label="Data di nascita">
              <input type="date" className="input" value={draft.birthDate ?? ''} onChange={(e) => up({ birthDate: e.target.value || undefined })} />
            </Field>

            <div className="mb-4">
              <span className="label">Ruolo · {ROLE_LABEL[draft.role]}</span>
              <Segmented value={draft.role} onChange={(role) => up({ role })} options={ROLES.map((r) => ({ value: r, label: r }))} />
            </div>

            <div className="mb-4">
              <span className="label">Caratteristiche</span>
              <div className="flex flex-wrap gap-2">
                {[...TRAIT_SUGGESTIONS, ...customTraits].map((t) => {
                  const on = draft.traits.includes(t);
                  return (
                    <button
                      key={t}
                      onClick={() => {
                        haptic.tap();
                        toggleTrait(t);
                      }}
                      className={cx(
                        'h-10 rounded-full border px-3.5 text-[14px] font-semibold transition active:scale-95',
                        on ? 'border-accent bg-accent/20 text-ink' : 'border-line bg-night/40 text-ink-muted',
                      )}
                    >
                      {t}
                    </button>
                  );
                })}
              </div>
              <div className="mt-2.5 flex gap-2">
                <input
                  className="input"
                  placeholder="Altra caratteristica…"
                  value={customTrait}
                  onChange={(e) => setCustomTrait(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && addCustom()}
                />
                <Button className="w-12 shrink-0 !px-0" onClick={addCustom} disabled={!customTrait.trim()} aria-label="Aggiungi caratteristica" icon={<Plus size={20} />} />
              </div>
            </div>

            <div className="mb-4">
              <span className="label">Stato</span>
              <div className="grid grid-cols-3 gap-2">
                {STATUSES.map((s: PlayerStatus) => {
                  const m = STATUS_META[s];
                  const on = draft.status === s;
                  return (
                    <button
                      key={s}
                      onClick={() => {
                        haptic.tap();
                        up({ status: s });
                      }}
                      className={cx(
                        'flex h-12 items-center justify-center gap-2 rounded-xl border text-[14px] font-bold transition active:scale-95',
                        on ? m.cls + ' !border-current' : 'border-line bg-night/40 text-ink-muted',
                      )}
                    >
                      <i className={cx('h-2 w-2 rounded-full', m.dot)} />
                      {m.label}
                    </button>
                  );
                })}
              </div>
            </div>
            {draft.status !== 'available' && (
              <div className="anim-rise grid grid-cols-[150px_1fr] gap-3">
                <Field label="Dal">
                  <input type="date" className="input" value={draft.statusDate} onChange={(e) => up({ statusDate: e.target.value })} />
                </Field>
                <Field label="Dettagli">
                  <input
                    className="input"
                    placeholder={draft.status === 'injured' ? 'es. distorsione caviglia' : 'es. affaticamento'}
                    value={draft.statusDetails}
                    onChange={(e) => up({ statusDetails: e.target.value })}
                  />
                </Field>
              </div>
            )}

            <Field label="Note">
              <textarea
                className="input h-28 resize-none py-3"
                placeholder="Appunti liberi: condizione fisica, indicazioni, carichi…"
                value={draft.notes}
                onChange={(e) => up({ notes: e.target.value })}
              />
            </Field>
          </fieldset>
        )}
      </Sheet>
      <PhotoCropper
        source={crop}
        onCancel={() => setCrop(null)}
        onDone={(photo) => {
          up({ photo });
          setCrop(null);
        }}
      />
    </>
  );
}
