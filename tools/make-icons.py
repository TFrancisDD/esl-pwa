#!/usr/bin/env python3
"""Generate the two PWA icons into public/.

The icons are generated, not authored — grass-dark square, yellow circle,
matching --grass-dark #1B4332 and --yellow #FFD60A from src/index.css.
Pure stdlib (struct + zlib), so this runs anywhere python3 does.

    python3 tools/make-icons.py
"""
import struct
import zlib
from pathlib import Path

GRASS = (0x1B, 0x43, 0x32)
YELLOW = (0xFF, 0xD6, 0x0A)
OUT = Path(__file__).resolve().parent.parent / "public"


def png(size, path):
    r = size / 2.0
    cx = cy = r - 0.5
    radius = size * 0.30
    rows = bytearray()
    for y in range(size):
        rows.append(0)  # filter type 0 (None)
        for x in range(size):
            inside = (x - cx) ** 2 + (y - cy) ** 2 <= radius ** 2
            rows.extend(YELLOW if inside else GRASS)

    def chunk(tag, data):
        return (
            struct.pack(">I", len(data))
            + tag
            + data
            + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)
        )

    ihdr = struct.pack(">IIBBBBB", size, size, 8, 2, 0, 0, 0)  # 8-bit truecolour
    blob = (
        b"\x89PNG\r\n\x1a\n"
        + chunk(b"IHDR", ihdr)
        + chunk(b"IDAT", zlib.compress(bytes(rows), 9))
        + chunk(b"IEND", b"")
    )
    path.write_bytes(blob)
    return len(blob)


if __name__ == "__main__":
    OUT.mkdir(parents=True, exist_ok=True)
    for s in (192, 512):
        p = OUT / f"icon-{s}.png"
        print(f"{p.name}: {png(s, p)} bytes")
