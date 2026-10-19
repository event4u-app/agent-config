"""Grade a reconstructed font against its held-out real family.

Runs in the type-design toolchain environment (fonttools, skia-pathops,
uharfbuzz at the pins in src/skills/type-design/references/toolchain.md).
Reads only the two font files and thresholds.json; it never reads the
generating session's notes, spec or QA report.

    python grade.py --real REAL.ttf --generated GEN.ttf --word Hobnail --out result.json

Every measurement is geometric on the outlines (skia-pathops booleans), not on
a raster, so the reading does not depend on a renderer or a pixel grid.
"""

import argparse
import json
import statistics
from pathlib import Path

import pathops
import uharfbuzz as hb
from fontTools.pens.transformPen import TransformPen
from fontTools.ttLib import TTFont

HERE = Path(__file__).resolve().parent
LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz"
FIGURES = "0123456789"
PUNCT = ".,:;!?'\"‘’“”-–—()/&@#%*"
LATIN_BASIC = LETTERS + FIGURES + PUNCT
EXPECTED_COUNTERS = {
    "o": {1}, "e": {1}, "a": {1}, "b": {1}, "d": {1}, "p": {1}, "q": {1},
    "A": {1}, "D": {1}, "O": {1}, "P": {1}, "Q": {1}, "R": {1}, "B": {2},
    "8": {2}, "0": {1}, "6": {1}, "9": {1}, "g": {1, 2},
}
STEM_LEFT = "hmpruEFILT"
STEM_RIGHT = "dq"
CONSISTENCY_STEMS = "nhmuli"
OVERSHOOT_X = "oecs"
KERN_STRINGS = ["AVATAR", "To", "Ty", "LT", "P.", "r,", "f)"]


class Face:
    def __init__(self, path):
        self.path = Path(path)
        self.tt = TTFont(str(path))
        self.gs = self.tt.getGlyphSet()
        self.cmap = self.tt.getBestCmap()
        self.upem = self.tt["head"].unitsPerEm
        self.cap = self._ink("H").bounds[3]
        self.xh = self._ink("x").bounds[3]
        self.scale = 1000.0 / self.cap

    def name(self, ch):
        return self.cmap.get(ord(ch))

    def _ink(self, ch, affine=(1, 0, 0, 1, 0, 0)):
        path = pathops.Path()
        gname = self.name(ch)
        if gname is None:
            return path
        self.gs[gname].draw(TransformPen(path.getPen(glyphSet=self.gs), affine))
        return pathops.simplify(path, fix_winding=True)

    def advance(self, ch):
        return self.tt["hmtx"][self.name(ch)][0]

    def normalised(self, ch):
        """Cap height scaled to 1000, baseline at 0, ink centred on x = 0."""
        raw = self._ink(ch)
        if raw.area == 0:
            return raw
        x0, _, x1, _ = raw.bounds
        s = self.scale
        return raw.transform(s, 0, 0, s, -s * (x0 + x1) / 2.0, 0)


def iou(a, b):
    if a.area == 0 or b.area == 0:
        return 0.0
    union = pathops.op(a, b, pathops.PathOp.UNION).area
    return pathops.op(a, b, pathops.PathOp.INTERSECTION).area / union if union else 0.0


def runs_at(path, y, half=1.0):
    """Ink runs a horizontal ray at height y crosses, left to right, as widths."""
    if path.area == 0:
        return []
    x0, _, x1, _ = path.bounds
    band = pathops.Path()
    pen = band.getPen()
    pen.moveTo((x0 - 10, y - half))
    pen.lineTo((x1 + 10, y - half))
    pen.lineTo((x1 + 10, y + half))
    pen.lineTo((x0 - 10, y + half))
    pen.closePath()
    hit = pathops.op(path, band, pathops.PathOp.INTERSECTION)
    spans = sorted((c.bounds[0], c.bounds[2]) for c in hit.contours)
    return [r - l for l, r in spans]


def stem(face, ch):
    ink = face._ink(ch)
    height = face.xh if ch.islower() else face.cap
    runs = runs_at(ink, height / 2.0)
    if not runs:
        return None
    width = runs[-1] if ch in STEM_RIGHT else runs[0]
    return width * face.scale


def holes(path):
    contours = [(abs(c.area), c.clockwise) for c in path.contours]
    if not contours:
        return 0
    outer = max(contours)[1]
    return sum(1 for _, cw in contours if cw != outer)


def gate_outline(face):
    fails = []
    for ch in LATIN_BASIC:
        if face.name(ch) is None or face._ink(ch).area == 0:
            fails.append(f"missing or empty: {ch!r}")
    if face.cmap.get(0x20) is None:
        fails.append("missing: space")
    if ".notdef" not in face.tt.getGlyphOrder():
        fails.append("missing: .notdef")
    for ch, expected in EXPECTED_COUNTERS.items():
        if face.name(ch) is None:
            continue
        got = holes(face._ink(ch))
        if got not in expected:
            fails.append(f"counters {ch!r}: {got}, expected {sorted(expected)}")
    em = face.upem * face.upem
    for ch in LETTERS + FIGURES:
        for c in face._ink(ch).contours:
            if abs(c.area) < 0.0005 * em:
                fails.append(f"stray contour in {ch!r}")
                break
    return fails


def gate_vertical(face):
    os2, hhea, head = face.tt["OS/2"], face.tt["hhea"], face.tt["head"]
    fails = []
    if (os2.sTypoAscender, os2.sTypoDescender, os2.sTypoLineGap) != (hhea.ascent, hhea.descent, hhea.lineGap):
        fails.append("typo and hhea disagree")
    if os2.sTypoLineGap != 0 or hhea.lineGap != 0:
        fails.append("line gap is not 0")
    if not os2.fsSelection & (1 << 7):
        fails.append("USE_TYPO_METRICS not set")
    if os2.usWinAscent < head.yMax or os2.usWinDescent < -head.yMin:
        fails.append("win metrics clip the family's extremes")
    return fails


def gate_consistency(face):
    fails = []
    widths = [w for w in (runs_at(face._ink(c), face.xh / 2.0) for c in CONSISTENCY_STEMS) if w]
    firsts = [w[0] for w in widths]
    if len(firsts) == len(CONSISTENCY_STEMS):
        med = statistics.median(firsts)
        if any(abs(w - med) / med > 0.03 for w in firsts):
            fails.append("lowercase stems vary by more than 3 %")
    else:
        fails.append("a consistency glyph is missing")
    for ch, top in [(c, face.xh) for c in OVERSHOOT_X] + [("O", face.cap)]:
        ink = face._ink(ch)
        if ink.area == 0:
            fails.append(f"overshoot glyph missing: {ch!r}")
            continue
        _, y0, _, y1 = ink.bounds
        for share in ((y1 - top) / top, -y0 / top):
            if not 0.01 <= share <= 0.03:
                fails.append(f"overshoot {ch!r} {share:.3f} outside 0.01-0.03")
                break
    return fails


def gate_spacing(face):
    fails = []
    gpos = face.tt.get("GPOS")
    tags = {fr.FeatureTag for fr in gpos.table.FeatureList.FeatureRecord} if gpos else set()
    if "kern" not in tags:
        fails.append("no kern feature")
    blob = hb.Blob.from_file_path(str(face.path))
    hbfont = hb.Font(hb.Face(blob))
    for text in KERN_STRINGS:
        buf = hb.Buffer()
        buf.add_str(text)
        buf.guess_segment_properties()
        hb.shape(hbfont, buf, {"kern": True})
        x = 0
        placed = []
        for info, pos in zip(buf.glyph_infos, buf.glyph_positions):
            gname = face.tt.getGlyphName(info.codepoint)
            path = pathops.Path()
            face.gs[gname].draw(TransformPen(path.getPen(glyphSet=face.gs), (1, 0, 0, 1, x + pos.x_offset, pos.y_offset)))
            placed.append(pathops.simplify(path, fix_winding=True))
            x += pos.x_advance
        for a, b in zip(placed, placed[1:]):
            if a.area and b.area and pathops.op(a, b, pathops.PathOp.INTERSECTION).area > 0:
                fails.append(f"collision in {text!r}")
                break
    return fails


GATES = {"outline": gate_outline, "vertical": gate_vertical, "consistency": gate_consistency, "spacing": gate_spacing}


def run_gates(face):
    out = {}
    for name, fn in GATES.items():
        try:
            fails = fn(face)
        except Exception as exc:  # a gate that cannot read the font fails, it is never skipped
            fails = [f"gate raised {type(exc).__name__}: {exc}"]
        out[name] = {"pass": not fails, "failures": fails[:20]}
    return out


def grade(real_path, gen_path, word, thresholds):
    real, gen = Face(real_path), Face(gen_path)
    held_out = [c for c in LETTERS + FIGURES if c not in word]
    per_glyph = {}
    for ch in held_out:
        per_glyph[ch] = round(iou(real.normalised(ch), gen.normalised(ch)), 4) if gen.name(ch) else 0.0
    stems = {}
    for ch in STEM_LEFT + STEM_RIGHT:
        if ch in word:
            continue
        r, g = stem(real, ch), stem(gen, ch)
        if r:
            stems[ch] = round(abs(g - r) / r, 4) if g else 1.0
    sidebearings = {}
    for ch in held_out:
        if gen.name(ch) is None:
            continue
        rb, gb = real._ink(ch).bounds, gen._ink(ch).bounds
        r_l, r_r = rb[0] * real.scale, (real.advance(ch) - rb[2]) * real.scale
        g_l, g_r = gb[0] * gen.scale, (gen.advance(ch) - gb[2]) * gen.scale
        sidebearings[ch] = round((abs(g_l - r_l) + abs(g_r - r_r)) / 2.0, 1)
    gates_gen, gates_real = run_gates(gen), run_gates(real)
    rate = sum(g["pass"] for g in gates_gen.values()) / len(gates_gen)
    summary = {
        "median_iou": round(statistics.median(per_glyph.values()), 4),
        "median_stem_deviation": round(statistics.median(stems.values()), 4) if stems else 1.0,
        "median_sidebearing_deviation": round(statistics.median(sidebearings.values()), 1) if sidebearings else 1000.0,
        "gate_pass_rate": rate,
        "missing_held_out": [c for c in held_out if gen.name(c) is None],
    }
    t = thresholds["family"]
    checks = {
        "iou": summary["median_iou"] >= t["median_iou_min"],
        "stem": summary["median_stem_deviation"] <= t["median_stem_deviation_max"],
        "sidebearing": summary["median_sidebearing_deviation"] <= t["median_sidebearing_deviation_max"],
        "gates": summary["gate_pass_rate"] >= t["gate_pass_rate_min"],
    }
    return {
        "summary": summary,
        "checks": checks,
        "family_pass": all(checks.values()),
        "per_glyph_iou": per_glyph,
        "stem_deviation": stems,
        "sidebearing_deviation": sidebearings,
        "gates_generated": gates_gen,
        "gates_real_control": gates_real,
    }


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--real", required=True)
    ap.add_argument("--generated", required=True)
    ap.add_argument("--word", required=True)
    ap.add_argument("--out", required=True)
    args = ap.parse_args()
    thresholds = json.loads((HERE / "thresholds.json").read_text())
    result = grade(args.real, args.generated, args.word, thresholds)
    Path(args.out).write_text(json.dumps(result, indent=2, ensure_ascii=False) + "\n")
    print(json.dumps(result["summary"]), "family_pass:", result["family_pass"])


if __name__ == "__main__":
    main()
