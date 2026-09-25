"""Generate extension PNG icons — terminal-prompt style (dark bg, green chevron)."""

from PIL import Image, ImageDraw, ImageFont
import os

OUT = os.path.join(os.path.dirname(__file__), "..", "extension", "public")
SIZES = [16, 48, 128]

BG = (5, 8, 5, 255)        # near-black with green tint
GREEN = (74, 246, 38, 255)  # terminal green
GREEN_DIM = (38, 122, 24, 255)


def rounded_rect(draw, xy, radius, fill, outline=None, width=1):
    x0, y0, x1, y1 = xy
    draw.rounded_rectangle(xy, radius=radius, fill=fill, outline=outline, width=width)


def make_icon(size: int) -> Image.Image:
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    radius = max(2, size // 6)

    # Background: dark rounded square with green border
    pad = max(1, size // 16)
    rounded_rect(draw, (pad, pad, size - pad, size - pad), radius, fill=BG,
                 outline=GREEN_DIM, width=max(1, size // 64))

    if size < 24:
        # Too small for a glyph: solid green dot
        cx = cy = size // 2
        r = max(2, size // 6)
        draw.ellipse((cx - r, cy - r, cx + r, cy + r), fill=GREEN)
        return img

    # ">" chevron + "_" underscore — a terminal prompt
    try:
        font = ImageFont.load_default(size=int(size * 0.52))
    except TypeError:
        font = ImageFont.load_default()

    bbox = draw.textbbox((0, 0), ">_", font=font)
    text_w = bbox[2] - bbox[0]
    text_h = bbox[3] - bbox[1]
    x = (size - text_w) // 2 - bbox[0]
    y = (size - text_h) // 2 - bbox[1]
    draw.text((x, y), ">_", font=font, fill=GREEN)
    return img


def main():
    for size in SIZES:
        img = make_icon(size)
        path = os.path.join(OUT, f"icon-{size}.png")
        img.save(path)
        print(f"wrote {path}")


if __name__ == "__main__":
    main()