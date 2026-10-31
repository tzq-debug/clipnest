"""Generate ClipNest app + tray icons. Run: python scripts/make-icons.py"""

from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
ASSETS = ROOT / "assets"
BUILD = ROOT / "build"

BG = (74, 64, 168, 255)
WHITE = (255, 255, 255)


def rounded(size, radius, color):
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.rounded_rectangle([0, 0, size - 1, size - 1], radius=radius, fill=color)
    return img


def bars(img, size, scale=1.0):
    d = ImageDraw.Draw(img)
    u = size / 512.0
    spec = [
        (256, 170, 0.96),  # width, y, alpha
        (216, 246, 0.74),
        (176, 322, 0.5),
    ]
    for width, y, alpha in spec:
        x0 = 256 - width / 2
        d.rounded_rectangle(
            [x0 * u, y * u, (x0 + width) * u, (y + 46) * u],
            radius=23 * u,
            fill=WHITE + (int(255 * alpha),),
        )
    return img


def build_icon(size):
    base = rounded(size, int(size * 0.222), BG)
    bars(base, size)
    return base


def main():
    ASSETS.mkdir(exist_ok=True)
    BUILD.mkdir(exist_ok=True)

    icon512 = build_icon(512)
    icon512.save(ASSETS / "icon.png")

    for s in (16, 24, 32, 48, 64, 128, 256):
        build_icon(s).save(BUILD / f"icon-{s}.png")

    build_icon(64).save(ASSETS / "tray.png")

    icon512.save(
        BUILD / "icon.ico",
        sizes=[(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)],
    )
    print("icons written")


if __name__ == "__main__":
    main()
