"""Render a word from a font as a filled SVG silhouette — the only input the skill sees.

    python render_word.py --font F.ttf --word Hobnail --cap-px 640 --out word.svg

The SVG carries one path and no text, font name, title or metadata, so nothing
in it names the family it came from.
"""

import argparse
from pathlib import Path

import uharfbuzz as hb
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.ttLib import TTFont


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--font", required=True)
    ap.add_argument("--word", required=True)
    ap.add_argument("--cap-px", type=float, default=640.0)
    ap.add_argument("--out", required=True)
    args = ap.parse_args()

    tt = TTFont(args.font)
    gs = tt.getGlyphSet()
    cap = tt["OS/2"].sCapHeight or tt["head"].unitsPerEm * 0.7
    s = args.cap_px / cap
    face = hb.Face(hb.Blob.from_file_path(args.font))
    buf = hb.Buffer()
    buf.add_str(args.word)
    buf.guess_segment_properties()
    hb.shape(hb.Font(face), buf, {"kern": True})

    pad = args.cap_px * 0.25
    asc, desc = tt["hhea"].ascent * s, -tt["hhea"].descent * s
    pen = SVGPathPen(gs)
    x = 0
    for info, pos in zip(buf.glyph_infos, buf.glyph_positions):
        name = tt.getGlyphName(info.codepoint)
        gs[name].draw(TransformPen(pen, (s, 0, 0, -s, pad + (x + pos.x_offset) * s, pad + asc)))
        x += pos.x_advance
    width, height = round(x * s + 2 * pad), round(asc + desc + 2 * pad)
    Path(args.out).write_text(
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{width}" height="{height}" viewBox="0 0 {width} {height}">'
        f'<rect width="100%" height="100%" fill="#fff"/><path fill="#000" d="{pen.getCommands()}"/></svg>\n'
    )


if __name__ == "__main__":
    main()
