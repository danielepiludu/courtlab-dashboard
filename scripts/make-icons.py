"""Genera il logo della squadra predefinita (public/logo.png) da assets/logo-source.png.

Le icone dell'app Courtlab si generano da assets/app-icon.svg con scripts/make-app-icons.cjs.
Uso:  npm run icons   (richiede Python 3 + Pillow e Playwright)
"""
from pathlib import Path
from PIL import Image, ImageChops, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
TEAM_SRC = ROOT / "assets" / "logo-source.png"
OUT = ROOT / "public"
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


def main():
    (OUT / "icons").mkdir(parents=True, exist_ok=True)
    team = circular_logo(Image.open(TEAM_SRC).convert("RGBA"))
    save_palette(team.resize((768, 768), Image.LANCZOS), OUT / "logo.png")
    print("Logo della squadra predefinita generato in", OUT / "logo.png")


if __name__ == "__main__":
    main()
