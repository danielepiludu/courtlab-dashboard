"""Genera il logo della squadra predefinita e le icone dell'app.

Sorgenti:
- assets/logo-source.png        logo Pallacanestro Don Bosco Livorno (squadra predefinita)
- assets/app-icon-source.webp   icona dell'app DP Dashboard (cronometro + pallone, "DP")

Uscite:
- public/logo.png                  logo Don Bosco ritagliato, sfondo trasparente (768px)
- public/icons/icon-192.png        icona app "any" (sfondo nero)
- public/icons/icon-512.png        icona app "any" (sfondo nero)
- public/icons/maskable-512.png    icona app maskable (contenuto nella safe zone 80%)
- public/icons/apple-touch-icon.png  180px
- public/icons/favicon-64.png      favicon
- public/icons/app-logo.png        icona app per l'interfaccia (256px, angoli arrotondati, trasparente fuori)

Uso:  npm run icons   (richiede Python 3 + Pillow)
"""
from pathlib import Path
from PIL import Image, ImageChops, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
TEAM_SRC = ROOT / "assets" / "logo-source.png"
APP_SRC = ROOT / "assets" / "app-icon-source.webp"
OUT = ROOT / "public"
BLACK = (0, 0, 0, 255)
SS = 4  # supersampling per bordi morbidi delle maschere


# ---------- Logo della squadra predefinita ----------
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
    return (left + right) / 2, (top + bottom) / 2, min(right - left, bottom - top) / 2


def circular_logo(src: Image.Image) -> Image.Image:
    cx, cy, r = find_circle(src)
    r -= 0.5
    crop = src.crop((round(cx - r), round(cy - r), round(cx + r), round(cy + r)))
    size = crop.size[0]
    mask = Image.new("L", (size * SS, size * SS), 0)
    ImageDraw.Draw(mask).ellipse((0, 0, size * SS - 1, size * SS - 1), fill=255)
    mask = mask.resize((size, size), Image.LANCZOS)
    out = crop.copy()
    out.putalpha(ImageChops.multiply(crop.getchannel("A"), mask))
    return out


def save_palette(img: Image.Image, path: Path) -> None:
    """PNG a palette (colori piatti -> file leggeri)."""
    img.quantize(colors=256, method=Image.FASTOCTREE, dither=Image.Dither.NONE).save(path, optimize=True)


# ---------- Icona dell'app ----------
def app_content(src: Image.Image) -> Image.Image:
    """Ritaglia il disegno (cronometro + pallone) dallo sfondo nero."""
    # lo sfondo dell'originale è "quasi nero": lo porto a nero pieno per non vedere i bordi del ritaglio
    rgb = src.convert("RGB").point(lambda v: 0 if v < 14 else v)
    box = rgb.convert("L").point(lambda v: 255 if v > 40 else 0).getbbox()
    pad = 6
    box = (max(0, box[0] - pad), max(0, box[1] - pad), min(rgb.width, box[2] + pad), min(rgb.height, box[3] + pad))
    return rgb.crop(box).convert("RGBA")


def on_black(content: Image.Image, size: int, scale: float) -> Image.Image:
    """Disegno centrato su sfondo nero pieno; `scale` = lato maggiore rispetto all'icona."""
    bg = Image.new("RGBA", (size, size), BLACK)
    k = scale * size / max(content.size)
    c = content.resize((round(content.width * k), round(content.height * k)), Image.LANCZOS)
    bg.alpha_composite(c, ((size - c.width) // 2, (size - c.height) // 2))
    return bg


def rounded(img: Image.Image, radius_ratio: float = 0.22) -> Image.Image:
    size = img.size[0]
    mask = Image.new("L", (size * SS, size * SS), 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, size * SS - 1, size * SS - 1), radius=round(size * SS * radius_ratio), fill=255)
    out = img.copy()
    out.putalpha(mask.resize((size, size), Image.LANCZOS))
    return out


def save_png(img: Image.Image, path: Path) -> None:
    img.save(path, optimize=True)


def main():
    (OUT / "icons").mkdir(parents=True, exist_ok=True)

    team = circular_logo(Image.open(TEAM_SRC).convert("RGBA"))
    save_palette(team.resize((768, 768), Image.LANCZOS), OUT / "logo.png")

    content = app_content(Image.open(APP_SRC))
    save_png(on_black(content, 192, 0.84).convert("RGB"), OUT / "icons" / "icon-192.png")
    save_png(on_black(content, 512, 0.84).convert("RGB"), OUT / "icons" / "icon-512.png")
    save_png(on_black(content, 512, 0.64).convert("RGB"), OUT / "icons" / "maskable-512.png")
    save_png(on_black(content, 180, 0.8).convert("RGB"), OUT / "icons" / "apple-touch-icon.png")
    save_png(rounded(on_black(content, 64, 0.92)), OUT / "icons" / "favicon-64.png")
    save_png(rounded(on_black(content, 256, 0.84)), OUT / "icons" / "app-logo.png")
    print("Logo e icone generati in", OUT)


if __name__ == "__main__":
    main()
