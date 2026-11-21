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
export function exportCrop(src: HTMLCanvasElement, v: CropView, out = 480, format: 'jpeg' | 'png' = 'jpeg'): string {
  const c = document.createElement('canvas');
  c.width = c.height = out;
  const ctx = c.getContext('2d')!;
  if (format === 'jpeg') {
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, out, out);
  }
  const base = out / Math.min(src.width, src.height);
  const s = base * v.zoom;
  const w = src.width * s;
  const h = src.height * s;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(src, out / 2 - w / 2 + v.dx * out, out / 2 - h / 2 + v.dy * out, w, h);
  return format === 'png' ? c.toDataURL('image/png') : c.toDataURL('image/jpeg', 0.86);
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

/** true se l'immagine contiene trasparenza significativa (es. logo PNG). */
export function hasTransparency(c: HTMLCanvasElement): boolean {
  const { data } = c.getContext('2d')!.getImageData(0, 0, c.width, c.height);
  let transparent = 0;
  for (let i = 3; i < data.length; i += 16) if (data[i] < 200) transparent++;
  return transparent / (data.length / 16) > 0.02;
}

/** Ritaglia i bordi trasparenti e ridimensiona il logo entro `max` px, in PNG. */
export function trimAndExportLogo(src: HTMLCanvasElement, max = 512): string {
  const ctx = src.getContext('2d')!;
  const { data, width, height } = ctx.getImageData(0, 0, src.width, src.height);
  let x0 = width;
  let y0 = height;
  let x1 = -1;
  let y1 = -1;
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++)
      if (data[(y * width + x) * 4 + 3] > 12) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
  if (x1 < 0) return src.toDataURL('image/png');
  const w = x1 - x0 + 1;
  const h = y1 - y0 + 1;
  const k = Math.min(1, max / Math.max(w, h));
  const side = Math.round(Math.max(w, h) * k);
  const out = document.createElement('canvas');
  out.width = out.height = side;
  const o = out.getContext('2d')!;
  o.imageSmoothingQuality = 'high';
  o.drawImage(src, x0, y0, w, h, (side - w * k) / 2, (side - h * k) / 2, w * k, h * k);
  return out.toDataURL('image/png');
}

export function loadImageUrl(url: string): Promise<HTMLImageElement> {
  return new Promise((res, rej) => {
    const i = new Image();
    i.onload = () => res(i);
    i.onerror = () => rej(new Error('Immagine non valida'));
    i.src = url;
  });
}
