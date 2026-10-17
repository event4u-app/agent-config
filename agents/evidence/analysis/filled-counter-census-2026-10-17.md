<!-- evidence-type: analysis -->
# Filled-counter census — `svg-structure-filled-counter`

Step 3.3 of `road-to-type-with-a-witness`. Measured 2026-10-17 on the branch
that adds the finding, based on `origin/main` @ `2d7b4c090`.

## What was run

`filledCounters` (`src/scripts/_lib/svg_filled_counter.ts`) over every file
`git ls-files '*.svg'` lists, before the four new fixtures under
`tests/fixtures/svg-filled-counter/` were tracked, so they are not in the
population.

## Result

| Measure | Count |
|---|---|
| Tracked SVG files | 96 |
| `<path>` elements | 64 |
| `<path>` elements with more than one `M`/`m` | 12 |
| of those, with two or more closed subpaths that flatten to a polygon | 6 |
| of those 6, under `nonzero` | **0** — all six declare `fill-rule="evenodd"` |
| Hits | **0** |
| True hits | 0 |
| False positives | **0** |

The six multi-contour paths:

| File | Line | Subpaths | Fill rule |
|---|---|---|---|
| `tests/design-artifacts/fixtures/svg-assets/assets/near-white-hole.clean.svg` | 5 | 2 | evenodd |
| `tests/design-artifacts/fixtures/svg-assets/assets/near-white-hole.source.svg` | 10 | 2 | evenodd |
| `tests/design-artifacts/fixtures/svg-assets/assets/seam-between-shapes.clean.svg` | 4 | 2 | evenodd |
| `tests/design-artifacts/fixtures/svg-assets/assets/seam-between-shapes.svg` | 4 | 2 | evenodd |
| `tests/design-artifacts/fixtures/svg-real/conversion-reference-mark.svg` | 10 | 2 | evenodd |
| `tests/design-artifacts/scenarios/s1b-conversion/delivered/mark.svg` | 10 | 2 | evenodd |

## What the zero does and does not say

The false-positive count is zero, which is the revisit condition decision A8
names. It is **not** evidence that the finding is safe to gate: the population
holds no multi-contour path under `nonzero` at all, so the check never had a
candidate it could have misjudged. A zero measured over zero candidates is a
vacuous pass, not a precision figure.

**Disposition: the finding stays advisory (`warning`).** It should be re-measured
over a corpus that carries `nonzero` paths with counters — real traced
lettering or an icon set — before anyone proposes it for enforcement.

## Sensitivity

On the fixtures the census excluded: `disc-nonzero.svg` is flagged (subpath 2
inside subpath 1), and `ring-evenodd.svg`, `ring-opposite-winding.svg` and
`ring-inherited-evenodd.svg` are not. Rendered on the repo's Chromium the disc
paints 196,282 dark pixels and each ring 115,940, so the flagged file is the one
whose counter actually fills.
