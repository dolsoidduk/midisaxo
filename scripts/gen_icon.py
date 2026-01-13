#!/usr/bin/env python3

from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw


def main() -> None:
    repo_root = Path(__file__).resolve().parents[1]
    out_dir = repo_root / "assets"
    out_dir.mkdir(parents=True, exist_ok=True)

    size = 512
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    # Simple, license-safe geometric icon.
    bg = (17, 24, 39, 255)  # slate-900
    accent = (56, 189, 248, 255)  # sky-400
    accent2 = (167, 243, 208, 255)  # emerald-200

    margin = int(size * 0.08)
    radius = int(size * 0.22)

    draw.rounded_rectangle(
        [margin, margin, size - margin, size - margin], radius=radius, fill=bg
    )

    # Two stylized "pipes" suggesting MIDI/IO.
    bar_w = int(size * 0.14)
    gap = int(size * 0.06)
    top = int(size * 0.24)
    bottom = int(size * 0.76)
    left1 = int(size * 0.30)
    left2 = left1 + bar_w + gap

    r = int(size * 0.08)
    draw.rounded_rectangle([left1, top, left1 + bar_w, bottom], radius=r, fill=accent)
    draw.rounded_rectangle([left2, top, left2 + bar_w, bottom], radius=r, fill=accent2)

    png_path = out_dir / "icon.png"
    ico_path = out_dir / "icon.ico"

    img.save(png_path)

    # Generate multi-size .ico for Windows.
    ico_sizes = [(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)]
    img.save(ico_path, format="ICO", sizes=ico_sizes)

    print(f"Wrote {png_path}")
    print(f"Wrote {ico_path}")


if __name__ == "__main__":
    main()
