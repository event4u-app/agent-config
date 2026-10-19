# Type reconstruction — pre-registration (fixed before the first run)

Registered 2026-10-19 · `road-to-type-with-a-witness` step 5.8 · the council's
(a) of 2026-10-16 (`agents/evidence/council/benchmark-fixture-fonts-20261016.md`).

**Ordering, stated so it is checkable.** This file, `type-reconstruction/thresholds.json`
and the grader commit before any generated font exists. The verdict commit comes
after and may not change either; a threshold edit after the first run voids the run.

## What is measured

Whether `type-design` path A, handed **only a rendered image of one word**, can
reconstruct the rest of a real family's `latin-basic` alphabet closely enough to
count as a reconstruction rather than as a different font.

## Population

The three families under `tests/fixtures/fonts/` (`fixtures.json`, pinned
upstream commit and SHA-256 per file): a geometric sans, a humanist sans and a
serif. Nothing is fetched at run time.

## Input — the only thing the skill receives

- The word **`Hobnail`** (7 letters: `H o b n a i l`), shaped with the family's
  own kerning, set at a cap height of 640 px, black on white, rendered by
  `render_word.py` → `render_png.mjs` to a PNG.
- The PNG is copied to a fresh directory as `lettering.png`. That directory holds
  nothing else. Its contents are grepped for every fixture name and file name
  before hand-off, and the grep result is recorded with the verdict.
- The brief handed with it is identical for every family: rights class
  `commissioned` (the requester states the right to reconstruct it for this
  study), license `unknown` (none given), tier `latin-basic`, no locked glyph.
- The generating session is told not to read `tests/fixtures/`, `internal/bench/`,
  `provenance/` or `docs/THIRD-PARTY-NOTICES.md`. That instruction is
  model-carried; nothing enforces it, and the verdict says so.

## Held-out set

Every letter and figure of `latin-basic` not in the word: 55 glyphs
(A–Z without H, a–z without o b n a i l, 0–9).

## Metrics — `type-reconstruction/grade.py`, geometric, on the outlines

All glyphs are scaled so the family's measured cap height (`H`) is 1000, baseline
at 0. The grader reads the two font files and `thresholds.json` only — never the
generating session's notes, spec or QA report.

| id | metric | how |
|---|---|---|
| M1 | median per-glyph IoU | held-out glyph against the real one, ink centred horizontally; area of intersection over union (skia-pathops booleans); a missing glyph scores 0 |
| M2 | median stem deviation | width of the stem a horizontal ray at half x-height (lowercase) or half cap height (capitals) crosses, on `h m p r u d q E F I L T`; relative to the real width |
| M3 | median sidebearing deviation | mean of the absolute left and right sidebearing differences per held-out glyph, in cap-1000 units |
| M4 | gate pass rate | the grader's own run of four `type-design` gates on the generated font — outline and coverage, vertical metrics, system consistency, spacing (kern feature present, no collision in the kerning strings) — passed over four |

The same four gates run on the real family as a **control**; its reading is
reported beside the generated one and is not part of the verdict.

## Thresholds — frozen

A family passes when **all four** hold: M1 ≥ 0.75 · M2 ≤ 0.05 · M3 ≤ 20 · M4 ≥ 0.75.

The benchmark reads `pass` when every family passes, `partial` when some do and
`null` when none do. **A null is a valid result** and is recorded as such.

### Calibration — real against real, taken before freezing

Grading one fixture family against another (no generated font involved) gives
the reading of "a different, competent font":

| real | stand-in | M1 | M2 | M3 | M4 (stand-in) |
|---|---|---|---|---|---|
| geometric sans | itself | 1.000 | 0.000 | 0.0 | 0.50 |
| geometric sans | humanist sans | 0.634 | 0.043 | 16.3 | 1.00 |
| serif | humanist sans | 0.600 | 0.029 | 28.4 | 1.00 |
| geometric sans | serif | 0.465 | 0.021 | 37.4 | 0.75 |

So M1 is the discriminating bar: 0.75 sits above every cross-family reading.
M2 and M3 are necessary conditions, not discriminating ones — a different sans
already meets M2. M4 on a real family is not a given: the geometric sans fails
vertical metrics (non-zero line gap) and spacing (no `kern` feature) as shipped.

## What may and may not enter `docs/CLAIMS.md`

Only a `pass` produces a claim, worded no wider than the measured population
(three families, one word, `latin-basic`). `partial` and `null` produce no claim.

## Retained beside the verdict

Raw grader output per family, the input PNGs, the generated fonts' proof PNGs,
this file's thresholds by reference, the fixture identities and the leak grep.
