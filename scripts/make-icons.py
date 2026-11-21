"""Genera logo e icone PWA a partire da assets/logo-source.png.

- public/logo.png            cerchio del logo ritagliato, sfondo trasparente (768px)
- public/icons/icon-192.png  icona "any" su sfondo navy
- public/icons/icon-512.png  icona "any" su sfondo navy
- public/icons/maskable-512.png  icona maskable (logo nella safe zone 80%)
- public/icons/apple-touch-icon.png  180px su sfondo navy
- public/icons/favicon-64.png  favicon trasparente

Uso:  npm run icons   (richiede Python 3 + Pillow)
"""
from pathlib import Path
from PIL import Image, ImageChops, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "assets" / "logo-source.png"
OUT = ROOT / "public"
NAVY = (0, 40, 85, 255)  # #002855
SS = 4  # supersampling per bordi morbidi della maschera


def find_circle(img: Image.Image) -> tuple[float, float, float]:
    """Trova centro e raggio del disco navy (esclude l'anello bianco esterno)."""
    px = img.load()
    w, h = img.size
    cy = h // 2

    def is_navy(p):
        r, g, b, a = p
        return a > 200 and r < 40 and g < 70 and 60 < b < 110

    left = next(x for x in range(w) if is_navy(px[x, cy]))
    right = next(x for x in range(w - 1, -1, -1) if is_navy(px[x, cy]))
    cx = w // 2
    top = next(y for y in range(h) if is_navy(px[cx, y]))
    bottom = next(y for y in range(h - 1, -1, -1) if is_navy(px[cx, y]))
    center_x = (left + right) / 2
    center_y = (top + bottom) / 2
    radius = min(right - left, bottom - top) / 2
    return center_x, center_y, radius


def circular_logo(src: Image.Image) -> Image.Image:
    cx, cy, r = find_circle(src)
    r -= 0.5  # leggero margine interno per eliminare l'alone bianco
    box = (round(cx - r), round(cy - r), round(cx + r), round(cy + r))
    crop = src.crop(box)
    size = crop.size[0]
    mask = Image.new("L", (size * SS, size * SS), 0)
    ImageDraw.Draw(mask).ellipse((0, 0, size * SS - 1, size * SS - 1), fill=255)
    mask = mask.resize((size, size), Image.LANCZOS)
    out = crop.copy()
    out.putalpha(ImageChops.multiply(crop.getchannel("A"), mask))
    return out


def on_navy(logo: Image.Image, size: int, scale: float) -> Image.Image:
    bg = Image.new("RGBA", (size, size), NAVY)
    d = round(size * scale)
    lg = logo.resize((d, d), Image.LANCZOS)
    off = (size - d) // 2
    bg.alpha_composite(lg, (off, off))
    return bg


def save(img: Image.Image, path: Path) -> None:
    """Salva come PNG a palette (colori piatti del logo -> file molto più leggeri)."""
    img.quantize(colors=256, method=Image.FASTOCTREE, dither=Image.Dither.NONE).save(path, optimize=True)


def main():
    src = Image.open(SRC).convert("RGBA")
    logo = circular_logo(src)
    (OUT / "icons").mkdir(parents=True, exist_ok=True)

    save(logo.resize((768, 768), Image.LANCZOS), OUT / "logo.png")
    save(logo.resize((64, 64), Image.LANCZOS), OUT / "icons" / "favicon-64.png")
    save(on_navy(logo, 192, 0.94), OUT / "icons" / "icon-192.png")
    save(on_navy(logo, 512, 0.94), OUT / "icons" / "icon-512.png")
    save(on_navy(logo, 512, 0.80), OUT / "icons" / "maskable-512.png")
    save(on_navy(logo, 180, 0.90), OUT / "icons" / "apple-touch-icon.png")
    print("Icone generate in", OUT)


if __name__ == "__main__":
    main()
