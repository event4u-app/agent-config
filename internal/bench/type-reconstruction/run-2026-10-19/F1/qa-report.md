# QA report — Bench F1

- **Path:** A (from lettering)
- **Coverage tier:** latin-basic
- **Maturity:** `prototype`
- **License:** unknown — written into the name table (IDs 13/14)
- **Rights class:** commissioned
- **Source:** `lettering.png` sha256:751be40daa72c7f828aff7a39a244d01782963c54d1d4afc0ac3bbab98a0ae3f, resolution confidence `ok`

## Gates

| Gate | Check | Measured | Threshold | Result |
|---|---|---|---|---|
| 1 | every contour closed (UFO) | 0 open | 0 open | PASS |
| 1 | counters per glyph | 20/20 match | all match the table | PASS |
| 1 | points at extrema (within 1 unit) | 0 glyphs missing | 0 | PASS |
| 1 | no contour under 0.05 % of the em square | 0 contours below 500 u² | 0 | PASS |
| 1 | contour direction (glyf: outer clockwise, counters opposite) | 0 wrong | 0 | PASS |
| 1 | fill rule declared before overlap removal | lib fillRule=nonzero; directions settled per primitive before union (construct order) | declared nonzero | PASS |
| 1 | coverage latin-basic | 87/87 present | 87/87 | PASS |
| 2 | OS/2 typo == hhea (asc/desc/gap) | typo 741/-235/0 hhea 741/-235/0 | equal | PASS |
| 2 | line gaps | typo 0, hhea 0 | 0 and 0 | PASS |
| 2 | USE_TYPO_METRICS (fsSelection bit 7) | bit7=1 | 1 | PASS |
| 2 | usWinAscent/usWinDescent cover the extremes | win 761/248; highest 761 (parenright), lowest -248 (g) | winAscent >= highest, winDescent >= -lowest | PASS |
| 3 | stems by ray-cast at half x-height | n:89, n:92, h:89, h:92, m:89, m:92, m:92, u:92, u:89, l:93, i:90 | each within 3 % of 91 | PASS |
| 3 | stems by ray-cast at half cap height | H:96, H:96, I:96, L:96, E:96, F:96, T:96; ray moved off a crossbar for H@330, E@380, F@360 | each within 3 % of 96 | PASS |
| 3 | round overshoot (below baseline / above height) | o 2.40/2.61 %; e 2.40/2.61 %; c 2.40/2.61 %; s 2.61/2.61 %; O 2.57/2.57 % | 1-3 % and within 0.5 % of 2.5 % | PASS |
| 3 | pointed overshoot | A 1.14 %; V 1.14 %; W 1.14 %; v 1.20 %; w 1.20 % | within 0.5 % of 1.2 % | PASS |
| 3 | ink area per glyph group | straight lowercase: median 0.230, 8/20 within; round lowercase: median 0.208, 4/6 within; capitals: median 0.233, 17/26 within; figures: median 0.283, 7/10 within | each glyph within ±12 % of its group median | FAIL |
| 4 | sidebearings from edge classes (H n O o first, then propagated) | n 33/27; o 27/7; H 33/43; O 27/27; 0 deviating | straight 33, round 27, diagonal 10 (±2) | PASS |
| 4 | kerning classes are edge groups (exceptions named) | 12 pairs, 4 glyph-level (LT, LV, LW, LY) | glyph-level only for named exception pairs | PASS |
| 4 | collision check on kerning strings | 0 intersecting pairs over AVATAR, To, Ty, LT, P., r,, f) | 0 | PASS |
| 4 | features built | GPOS ['kern'], GSUB ['tnum']; mark: not applicable (tier latin-basic has no diacritics); liga: not applicable (spec defines no ligatures) | kern; tnum (figures present) | PASS |
| 4 | shaping applies the features | kern: advances 5136 -> 5036; tnum: ['one', 'one', 'zero', 'one'] -> ['one.tf', 'one.tf', 'zero.tf', 'one.tf'], advances 1887 -> 2016; accented word and ligature: not applicable | shaped != unshaped for each built feature | PASS |
| 5 | rendered proof, face state of 'Bench F1' | face state not reported on 27 `<text>`; first_family_resolved on 27/27 | `loaded` | FAIL |
| 6 | source fidelity (silhouette IoU) | word 0.988; min glyph 0.979 | glyph >= 0.90, word >= 0.85 | PASS |
| 7 | metric-matched fallback | size-adjust 94.95 %, ascent 78.04 %, descent 24.75 %, line-gap 0.0 % over local('Arial') | all four descriptors derived from the font | PASS |

**Open gates:** gate 3 ink area per glyph group — outliers: d +13 %, j +59 %, k +16 %, l +16 %, m -15 %, n -15 %, r -26 %, u -15 %, v -40 %, w -20 %, x -27 %, y -36 %, c -13 %, g +35 %, A -23 %, B +28 %, K +14 %, L -17 %, Q +12 %, R +19 %, V -29 %, X -16 %, Y -15 %, one -35 %, seven -20 %, eight +16 %

## Notes for this run

### Open gate 3 — ink area per glyph group (3 repair rounds not spent: closure is infeasible without breaking gate 6)

The source's own traced letters, kept at their measured outlines and source-reproducing spacing, already
span more than the ±12 % band allows inside the straight-lowercase group: ink share n 0.196 vs l 0.266,
ratio 1.357, while any median admits at most 1.12/0.88 = 1.273. No change to derived glyphs can move
the median so that both n and l fall inside it. Closing the gate would require re-spacing or reshaping the
source letters away from the lettering, which gate 6 forbids. The gate is reported open, not tuned around.

### Gate 5 — witness

agent-config 16.5.0 (the newest published release; the global binary was the same version but had no
renderer, so the same version was installed beside a pinned `@playwright/test@1.55.0` under `.type-design/witness/`,
browser in `.type-design/browsers/`) reports `verification: verified` and `first_family_resolved: true` on every
`<text>`, but emits **no `face_state` field**. The gate asks for the reading `loaded`; it was not produced, so gate 5 is
reported FAIL (unreadable), not passed. Supplementary, not a substitute: the same proof with its `@font-face`
removed (`proof/control-nofont.svg`) renders a different PNG (proof ba73259c0aa18d48 vs control 67ff3e014eda1a55; the control hash is
identical across all three families, i.e. the fallback face), so the built woff2 is what painted the proof.

### Looked at

`agents/runtime/state/render/proof/asset-1x-light.png` (and the 2x): a bracketed-serif text-proportioned face: flagged ascenders, double-storey a, single-storey g with ear, condensed lining figures; HHOHH/nnonn even; diagonal serifs clean after repair; T-o and T-y still read loose.
The fidelity overlay `build/fidelity-overlay.png` is almost entirely neutral grey; red/blue fringes are one pixel or less.

### Repairs made this run (each through a rule or spec value, never hand-drawn path data)

1. Gate 6 (F2 `l` 0.886 < 0.90 before): the spacing rule in `tool/pathA.py` now reproduces each source letter's
   left-edge pitch (with carried rounding) instead of the pixel gap, so traced ink widths cannot accumulate drift;
   `sidebearing_override` re-measured. Drift along the word fell from up to 5 px to under 1 px.
2. Visual defects found in the proof (no gate measures them): `der_flip_desc` left a hairline spur on p/q (F3) —
   the ascender cut now reaches the traced stem's own right edge; diagonal serifs (v w x y A V W X K) used the
   traced vertical-stem kit and brackets on slanted strokes, leaving spurs — `head`/`foot` take `diag=True`
   (plain slab); `der_g_hook` flattened the serif g's bowl and left its ear floating — only the stem column is cut now.

### Deviations from the skill's procedure

- Toolchain: the six pins installed into `.type-design/venv` (Python 3.12), lock frozen to `.type-design/pins.lock`,
  pip-audit over the installed set: no advisory for the font packages (6 for `pip` itself, see `.type-design/pip-audit.txt`).
  No `brotli` package is pinned, so the woff2 is written with the toolchain's stored (uncompressed) Brotli stream
  (`tool/brotli_stored.py`); the browser decoded it.
- Gate 6 scorer is `tool/fidelity.py` written this run (the previous session left none); it follows gates § 6 as written
  (silhouette IoU, registration and resolution recorded) but is not the `svg-authoring` implementation, which was not
  available under this run's confinement.
- Gate 7 derivation: size-adjust from rendered sample widths against `local('Arial')`, overrides from the built OS/2 typo
  values over unitsPerEm × size-adjust. The referenced guideline (`docs/guidelines/design-asset-discipline.md`) could not be
  read under confinement, so conformance to its exact wording is unverified.
- Gate 4 `mark` and `liga`: not applicable (latin-basic has no diacritics; the spec defines no ligatures). The
  'accented word' shaping check is likewise not applicable.

## Witness reading

- Command: `agent-config ui:render $RUN/bench-F1/proof/index.svg --profile asset --project-root $RUN/bench-F1` (agent-config 16.5.0, verification `verified`)
- Face state for 'Bench F1': **not reported** (27 `<text>` elements; `first_family_resolved: true` on 27)
- PNG: `$RUN/bench-F1/agents/runtime/state/render/proof/asset-2x-light.png`
- Looked at: yes — see notes
- Witness quirk: given the `.html` host page (`proof/index.html`) the asset profile reads no `<text>` and reports no face state (`texts: []`), so the same specimens are written as `proof/index.svg` with its own `@font-face` and that SVG is the witness target.

## Fidelity (path A)

- Registration: `147,382,3242,778` in the source's pixel frame; scorer: `fidelity.py: nonzero scanline rasterisation at pixel centres vs source thresholded at luminance < 128; IoU = |A∩B| / |A∪B|`; sample resolution: source native 3545x1531 px, 1 sample per pixel
- Word IoU: **0.9875** (threshold 0.85)
- Per glyph: H 0.9970, o 0.9833, b 0.9791, n 0.9894, a 0.9850, i 0.9916, l 0.9833 (threshold 0.90 each)
- Overlay: `bench-F1/build/fidelity-overlay.png` — 

## Files

