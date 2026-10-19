# QA report — Bench F3

- **Path:** A (from lettering)
- **Coverage tier:** latin-basic
- **Maturity:** `prototype`
- **License:** unknown — written into the name table (IDs 13/14)
- **Rights class:** commissioned
- **Source:** `lettering.png` sha256:7de9a4afe1537af4ec7d1a56d68e2f7e46ba91d8bbea28ed3f2cb394a059cfd0, resolution confidence `ok`

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
| 2 | OS/2 typo == hhea (asc/desc/gap) | typo 719/-215/0 hhea 719/-215/0 | equal | PASS |
| 2 | line gaps | typo 0, hhea 0 | 0 and 0 | PASS |
| 2 | USE_TYPO_METRICS (fsSelection bit 7) | bit7=1 | 1 | PASS |
| 2 | usWinAscent/usWinDescent cover the extremes | win 739/223; highest 739 (parenright), lowest -223 (g) | winAscent >= highest, winDescent >= -lowest | PASS |
| 3 | stems by ray-cast at half x-height | n:88, n:88, h:88, h:88, m:88, m:88, m:88, u:88, u:88, l:87, i:86 | each within 3 % of 87 | PASS |
| 3 | stems by ray-cast at half cap height | H:94, H:94, I:94, L:94, E:94, F:94, T:94; ray moved off a crossbar for H@315, E@385, F@365 | each within 3 % of 94 | PASS |
| 3 | round overshoot (below baseline / above height) | o 1.41/1.62 %; e 1.41/1.62 %; c 1.41/1.62 %; s 1.62/1.62 %; O 1.57/1.57 % | 1-3 % and within 0.5 % of 1.5 % | PASS |
| 3 | pointed overshoot | A 1.00 %; V 1.00 %; W 1.00 %; v 1.01 %; w 1.01 % | within 0.5 % of 1.0 % | PASS |
| 3 | ink area per glyph group | straight lowercase: median 0.240, 10/20 within; round lowercase: median 0.214, 4/6 within; capitals: median 0.244, 15/26 within; figures: median 0.276, 8/10 within | each glyph within ±12 % of its group median | FAIL |
| 4 | sidebearings from edge classes (H n O o first, then propagated) | n 61/48; o 47/49; H 61/67; O 47/47; 0 deviating | straight 61, round 47, diagonal 15 (±2) | PASS |
| 4 | kerning classes are edge groups (exceptions named) | 12 pairs, 4 glyph-level (LT, LV, LW, LY) | glyph-level only for named exception pairs | PASS |
| 4 | collision check on kerning strings | 0 intersecting pairs over AVATAR, To, Ty, LT, P., r,, f) | 0 | PASS |
| 4 | features built | GPOS ['kern'], GSUB ['tnum']; mark: not applicable (tier latin-basic has no diacritics); liga: not applicable (spec defines no ligatures) | kern; tnum (figures present) | PASS |
| 4 | shaping applies the features | kern: advances 4977 -> 4782; tnum: ['one', 'one', 'zero', 'one'] -> ['one.tf', 'one.tf', 'zero.tf', 'one.tf'], advances 1476 -> 1968; accented word and ligature: not applicable | shaped != unshaped for each built feature | PASS |
| 5 | rendered proof, face state of 'Bench F3' | face state not reported on 27 `<text>`; first_family_resolved on 27/27 | `loaded` | FAIL |
| 6 | source fidelity (silhouette IoU) | word 0.992; min glyph 0.980 | glyph >= 0.90, word >= 0.85 | PASS |
| 7 | metric-matched fallback | size-adjust 93.86 %, ascent 76.6 %, descent 22.91 %, line-gap 0.0 % over local('Arial') | all four descriptors derived from the font | PASS |

**Open gates:** gate 3 ink area per glyph group — outliers: j +27 %, k +14 %, l +33 %, m -19 %, n -15 %, r -28 %, t -18 %, u -17 %, v -20 %, x -12 %, c -13 %, g +38 %, B +32 %, E +14 %, I +34 %, L -20 %, M +27 %, N +13 %, R +26 %, T -21 %, V -13 %, W +14 %, Y -21 %, seven -14 %, eight +17 %

## Notes for this run

### Open gate 3 — ink area per glyph group (3 repair rounds not spent: closure is infeasible without breaking gate 6)

The source's own traced letters, kept at their measured outlines and source-reproducing spacing, already
span more than the ±12 % band allows inside the straight-lowercase group: ink share n 0.204 vs l 0.319,
ratio 1.564, while any median admits at most 1.12/0.88 = 1.273. No change to derived glyphs can move
the median so that both n and l fall inside it. Closing the gate would require re-spacing or reshaping the
source letters away from the lettering, which gate 6 forbids. The gate is reported open, not tuned around.

### Gate 5 — witness

agent-config 16.5.0 (the newest published release; the global binary was the same version but had no
renderer, so the same version was installed beside a pinned `@playwright/test@1.55.0` under `.type-design/witness/`,
browser in `.type-design/browsers/`) reports `verification: verified` and `first_family_resolved: true` on every
`<text>`, but emits **no `face_state` field**. The gate asks for the reading `loaded`; it was not produced, so gate 5 is
reported FAIL (unreadable), not passed. Supplementary, not a substitute: the same proof with its `@font-face`
removed (`proof/control-nofont.svg`) renders a different PNG (proof 8a1ceecda2874e81 vs control 67ff3e014eda1a55; the control hash is
identical across all three families, i.e. the fallback face), so the built woff2 is what painted the proof.

### Looked at

`agents/runtime/state/render/proof/asset-1x-light.png` (and the 2x): a humanist-leaning sans with moderate contrast: double-storey a, single-storey g, flat terminals; HHOHH/nnonn even; p/q clean after the spur repair; figures narrower than the letters; T-o loose.
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

- Command: `agent-config ui:render $RUN/bench-F3/proof/index.svg --profile asset --project-root $RUN/bench-F3` (agent-config 16.5.0, verification `verified`)
- Face state for 'Bench F3': **not reported** (27 `<text>` elements; `first_family_resolved: true` on 27)
- PNG: `$RUN/bench-F3/agents/runtime/state/render/proof/asset-2x-light.png`
- Looked at: yes — see notes
- Witness quirk: given the `.html` host page (`proof/index.html`) the asset profile reads no `<text>` and reports no face state (`texts: []`), so the same specimens are written as `proof/index.svg` with its own `@font-face` and that SVG is the witness target.

## Fidelity (path A)

- Registration: `202,344,2974,744` in the source's pixel frame; scorer: `fidelity.py: nonzero scanline rasterisation at pixel centres vs source thresholded at luminance < 128; IoU = |A∩B| / |A∪B|`; sample resolution: source native 3362x1392 px, 1 sample per pixel
- Word IoU: **0.9916** (threshold 0.85)
- Per glyph: H 1.0000, o 0.9863, b 0.9874, n 0.9926, a 0.9803, i 0.9967, l 1.0000 (threshold 0.90 each)
- Overlay: `bench-F3/build/fidelity-overlay.png` — 

## Files

