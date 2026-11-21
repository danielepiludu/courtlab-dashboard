/** Carica un file immagine (foto da camera o galleria) ridimensionandolo per l'editing. */
export async function loadImageFile(file: File, maxSide = 1600): Promise<HTMLCanvasElement> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((res, rej) => {
      const i = new Image();
      i.onload = () => res(i);
      i.onerror = () => rej(new Error('Immagine non valida'));
      i.src = url;
    });
    const k = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
    const c = document.createElement('canvas');
    c.width = Math.round(img.naturalWidth * k);
    c.height = Math.round(img.naturalHeight * k);
    const ctx = c.getContext('2d')!;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, 0, 0, c.width, c.height);
    return c;
  } finally {
    URL.revokeObjectURL(url);
  }
}

export interface CropView {
  /** zoom: 1 = il lato corto dell'immagine riempie il cerchio */
  zoom: number;
  /** spostamento del centro immagine rispetto al centro del cerchio, in frazioni del diametro */
  dx: number;
  dy: number;
}

/** Esporta il ritaglio (quadrato, mostrato poi come cerchio) in JPEG. */
export function exportCrop(src: HTMLCanvasElement, v: CropView, out = 480): string {
  const c = document.createElement('canvas');
  c.width = c.height = out;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#0D1B3A';
  ctx.fillRect(0, 0, out, out);
  const base = out / Math.min(src.width, src.height);
  const s = base * v.zoom;
  const w = src.width * s;
  const h = src.height * s;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(src, out / 2 - w / 2 + v.dx * out, out / 2 - h / 2 + v.dy * out, w, h);
  return c.toDataURL('image/jpeg', 0.86);
}

/** Limita lo spostamento così che il cerchio sia sempre coperto dall'immagine. */
export function clampView(src: { width: number; height: number }, v: CropView): CropView {
  const zoom = Math.min(5, Math.max(1, v.zoom));
  const m = Math.min(src.width, src.height);
  const halfW = ((src.width / m) * zoom) / 2;
  const halfH = ((src.height / m) * zoom) / 2;
  const maxX = Math.max(0, halfW - 0.5);
  const maxY = Math.max(0, halfH - 0.5);
  return { zoom, dx: Math.min(maxX, Math.max(-maxX, v.dx)), dy: Math.min(maxY, Math.max(-maxY, v.dy)) };
}
