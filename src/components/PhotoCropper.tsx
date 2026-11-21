import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, X, ZoomIn, ZoomOut } from 'lucide-react';
import { clampView, exportCrop, type CropView } from '@/lib/image';
import { useBackClose } from '@/lib/backNav';
import { haptic } from '@/lib/haptics';
import { Button } from './ui/Button';

interface Props {
  source: HTMLCanvasElement | null;
  onCancel: () => void;
  onDone: (dataUrl: string) => void;
  /** cerchio (foto giocatore) o quadrato (logo) */
  shape?: 'circle' | 'square';
  title?: string;
}

/** Ritaglio circolare (o quadrato): trascina per spostare, pizzica o usa lo slider per lo zoom. */
export function PhotoCropper({ source, onCancel, onDone, shape = 'circle', title = 'Ritaglia foto' }: Props) {
  const open = !!source;
  useBackClose(open, onCancel);
  const [view, setView] = useState<CropView>({ zoom: 1, dx: 0, dy: 0 });
  const [diam, setDiam] = useState(300);
  const boxRef = useRef<HTMLDivElement>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const url = useMemo(() => (source ? source.toDataURL('image/jpeg', 0.92) : ''), [source]);

  useEffect(() => {
    if (source) setView({ zoom: 1, dx: 0, dy: 0 });
  }, [source]);

  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setDiam(el.clientWidth));
    ro.observe(el);
    return () => ro.disconnect();
  }, [open]);

  if (!source) return null;
  const m = Math.min(source.width, source.height);
  const w = (source.width / m) * view.zoom * diam;
  const h = (source.height / m) * view.zoom * diam;
  const update = (fn: (v: CropView) => CropView) => setView((v) => clampView(source, fn(v)));

  const onPointerDown = (e: React.PointerEvent) => {
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const map = pointers.current;
    const prev = map.get(e.pointerId);
    if (!prev) return;
    const pts = [...map.values()];
    if (map.size === 1) {
      const ddx = (e.clientX - prev.x) / diam;
      const ddy = (e.clientY - prev.y) / diam;
      update((v) => ({ ...v, dx: v.dx + ddx, dy: v.dy + ddy }));
    } else if (map.size === 2) {
      const other = pts.find((p) => p !== prev)!;
      const before = Math.hypot(prev.x - other.x, prev.y - other.y);
      const after = Math.hypot(e.clientX - other.x, e.clientY - other.y);
      if (before > 0) {
        const k = after / before;
        update((v) => ({ zoom: v.zoom * k, dx: v.dx * k + (e.clientX - prev.x) / 2 / diam, dy: v.dy * k + (e.clientY - prev.y) / 2 / diam }));
      }
    }
    map.set(e.pointerId, { x: e.clientX, y: e.clientY });
  };
  const onPointerUp = (e: React.PointerEvent) => pointers.current.delete(e.pointerId);

  return createPortal(
    <div className="anim-fade fixed inset-0 z-[70] flex flex-col bg-night" style={{ paddingTop: 'var(--safe-top)', paddingBottom: 'var(--safe-bottom)' }}>
      <div className="flex h-16 items-center gap-3 px-4">
        <button onClick={onCancel} aria-label="Annulla" className="grid h-11 w-11 place-items-center rounded-full bg-white/5 active:scale-90">
          <X size={22} />
        </button>
        <div className="flex-1 font-display text-2xl font-bold tracking-wide">{title}</div>
      </div>
      <div className="flex flex-1 flex-col items-center justify-center gap-6 px-6">
        <div
          ref={boxRef}
          className="relative aspect-square w-full max-w-[min(86vw,58vh)] touch-none select-none overflow-hidden rounded-3xl bg-black"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onWheel={(e) => update((v) => ({ ...v, zoom: v.zoom * (e.deltaY < 0 ? 1.08 : 0.92) }))}
        >
          <img
            src={url}
            alt=""
            draggable={false}
            className="pointer-events-none absolute left-1/2 top-1/2 max-w-none"
            style={{ width: w, height: h, transform: `translate(calc(-50% + ${view.dx * diam}px), calc(-50% + ${view.dy * diam}px))` }}
          />
          {/* maschera */}
          <div
            className={`pointer-events-none absolute inset-0 ring-2 ring-accent/80 ${shape === 'circle' ? 'rounded-full' : 'rounded-2xl'}`}
            style={{ boxShadow: '0 0 0 999px color-mix(in srgb, var(--c-bg) 86%, transparent)' }}
          />
        </div>
        <div className="flex w-full max-w-sm items-center gap-3">
          <ZoomOut size={20} className="text-ink-muted" />
          <input
            type="range"
            min={1}
            max={5}
            step={0.01}
            value={view.zoom}
            onChange={(e) => update((v) => ({ ...v, zoom: Number(e.target.value) }))}
            className="h-11 flex-1"
            style={{ accentColor: 'var(--c-select)' }}
            aria-label="Zoom"
          />
          <ZoomIn size={20} className="text-ink-muted" />
        </div>
        <p className="-mt-3 text-center text-sm text-ink-muted">{shape === 'circle' ? 'Trascina per centrare il volto, pizzica per ingrandire' : 'Trascina e ingrandisci per inquadrare il logo'}</p>
      </div>
      <div className="grid grid-cols-2 gap-3 p-4">
        <Button size="lg" onClick={onCancel}>
          Annulla
        </Button>
        <Button
          size="lg"
          variant="primary"
          icon={<Check size={20} />}
          onClick={() => {
            haptic.confirm();
            onDone(exportCrop(source, view, shape === 'circle' ? 480 : 512, shape === 'square' ? 'png' : 'jpeg'));
          }}
        >
          Usa foto
        </Button>
      </div>
    </div>,
    document.body,
  );
}
