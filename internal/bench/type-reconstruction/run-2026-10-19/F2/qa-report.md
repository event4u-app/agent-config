# QA report — Bench F2

- **Path:** A (from lettering)
- **Coverage tier:** latin-basic
- **Maturity:** `prototype`
- **License:** unknown — written into the name table (IDs 13/14)
- **Rights class:** commissioned
- **Source:** `lettering.png` sha256:5ce0ea8bc5b06948994f4e009c378387f0a6ffe8e84b2b7d628dd539d4752cc2, resolution confidence `ok`

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
| 2 | OS/2 typo == hhea (asc/desc/gap) | typo 744/-205/0 hhea 744/-205/0 | equal | PASS |
| 2 | line gaps | typo 0, hhea 0 | 0 and 0 | PASS |
| 2 | USE_TYPO_METRICS (fsSelection bit 7) | bit7=1 | 1 | PASS |
| 2 | usWinAscent/usWinDescent cover the extremes | win 765/214; highest 765 (j), lowest -214 (g) | winAscent >= highest, winDescent >= -lowest | PASS |
| 3 | stems by ray-cast at half x-height | n:92, n:92, h:92, h:92, m:92, m:92, m:92, u:92, u:92, l:91, i:92 | each within 3 % of 91 | PASS |
| 3 | stems by ray-cast at half cap height | H:91, H:91, I:91, L:91, E:91, F:91, T:91; ray moved off a crossbar for H@315, E@390, F@370 | each within 3 % of 91 | PASS |
| 3 | round overshoot (below baseline / above height) | o 1.63/1.81 %; e 1.63/1.81 %; c 1.63/1.81 %; s 1.63/1.63 %; O 1.71/1.71 % | 1-3 % and within 0.5 % of 1.7 % | PASS |
| 3 | pointed overshoot | A 1.14 %; V 1.14 %; W 1.14 %; v 1.27 %; w 1.27 % | within 0.5 % of 1.2 % | PASS |
| 3 | ink area per glyph group | straight lowercase: median 0.253, 10/20 within; round lowercase: median 0.235, 4/6 within; capitals: median 0.242, 16/26 within; figures: median 0.268, 8/10 within | each glyph within ±12 % of its group median | FAIL |
| 4 | sidebearings from edge classes (H n O o first, then propagated) | n 70/65; o 49/50; H 70/72; O 49/49; 0 deviating | straight 70, round 49, diagonal 18 (±2) | PASS |
| 4 | kerning classes are edge groups (exceptions named) | 12 pairs, 4 glyph-level (LT, LV, LW, LY) | glyph-level only for named exception pairs | PASS |
| 4 | collision check on kerning strings | 0 intersecting pairs over AVATAR, To, Ty, LT, P., r,, f) | 0 | PASS |
| 4 | features built | GPOS ['kern'], GSUB ['tnum']; mark: not applicable (tier latin-basic has no diacritics); liga: not applicable (spec defines no ligatures) | kern; tnum (figures present) | PASS |
| 4 | shaping applies the features | kern: advances 4983 -> 4763; tnum: ['one', 'one', 'zero', 'one'] -> ['one.tf', 'one.tf', 'zero.tf', 'one.tf'], advances 1554 -> 2064; accented word and ligature: not applicable | shaped != unshaped for each built feature | PASS |
| 5 | rendered proof, face state of 'Bench F2' | face state not reported on 27 `<text>`; first_family_resolved on 27/27 | `loaded` | FAIL |
| 6 | source fidelity (silhouette IoU) | word 0.992; min glyph 0.986 | glyph >= 0.90, word >= 0.85 | PASS |
| 7 | metric-matched fallback | size-adjust 105.63 %, ascent 70.44 %, descent 19.41 %, line-gap 0.0 % over local('Arial') | all four descriptors derived from the font | PASS |

**Open gates:** gate 3 ink area per glyph group — outliers: f -15 %, j +16 %, l +22 %, m -22 %, n -19 %, r -27 %, t -24 %, u -20 %, v -23 %, x -14 %, c -14 %, g +32 %, B +30 %, E +15 %, I +20 %, L -21 %, M +30 %, N +15 %, R +23 %, T -20 %, W +19 %, Y -20 %, seven -16 %, eight +17 %

## Notes for this run

### Open gate 3 — ink area per glyph group (3 repair rounds not spent: closure is infeasible without breaking gate 6)

The source's own traced letters, kept at their measured outlines and source-reproducing spacing, already
span more than the ±12 % band allows inside the straight-lowercase group: ink share n 0.205 vs l 0.309,
ratio 1.507, while any median admits at most 1.12/0.88 = 1.273. No change to derived glyphs can move
the median so that both n and l fall inside it. Closing the gate would require re-spacing or reshaping the
source letters away from the lettering, which gate 6 forbids. The gate is reported open, not tuned around.

### Gate 5 — witness

agent-config 16.5.0 (the newest published release; the global binary was the same version but had no
renderer, so the same version was installed beside a pinned `@playwright/test@1.55.0` under `.type-design/witness/`,
browser in `.type-design/browsers/`) reports `verification: verified` and `first_family_resolved: true` on every
`<text>`, but emits **no `face_state` field**. The gate asks for the reading `loaded`; it was not produced, so gate 5 is
reported FAIL (unreadable), not passed. Supplementary, not a substitute: the same proof with its `@font-face`
removed (`proof/control-nofont.svg`) renders a different PNG (proof 285b828b5e67ca83 vs control 67ff3e014eda1a55; the control hash is
identical across all three families, i.e. the fallback face), so the built woff2 is what painted the proof.

### Looked at

`agents/runtime/state/render/proof/asset-1x-light.png` (and the 2x): a geometric monoline sans: near-circular o/O, single-storey a and g, flat terminals; HHOHH/nnonn even; figures noticeably narrower than the letters; T-o loose.
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

- Command: `agent-config ui:render $RUN/bench-F2/proof/index.svg --profile asset --project-root $RUN/bench-F2` (agent-config 16.5.0, verification `verified`)
- Face state for 'Bench F2': **not reported** (27 `<text>` elements; `first_family_resolved: true` on 27)
- PNG: `$RUN/bench-F2/agents/runtime/state/render/proof/asset-2x-light.png`
- Looked at: yes — see notes
- Witness quirk: given the `.html` host page (`proof/index.html`) the asset profile reads no `<text>` and reports no face state (`texts: []`), so the same specimens are written as `proof/index.svg` with its own `@font-face` and that SVG is the witness target.

## Fidelity (path A)

- Registration: `191,385,3435,785` in the source's pixel frame; scorer: `fidelity.py: nonzero scanline rasterisation at pixel centres vs source thresholded at luminance < 128; IoU = |A∩B| / |A∪B|`; sample resolution: source native 3819x1604 px, 1 sample per pixel
- Word IoU: **0.9918** (threshold 0.85)
- Per glyph: H 1.0000, o 0.9871, b 0.9880, n 0.9925, a 0.9857, i 0.9967, l 1.0000 (threshold 0.90 each)
- Overlay: `bench-F2/build/fidelity-overlay.png` — 

## Files

