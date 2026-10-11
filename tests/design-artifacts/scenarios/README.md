# SVG end-to-end scenarios

Phase 6 of `road-to-svg-with-a-witness`. Five tasks, each one a recorded run of
the `svg-authoring` skill: the task text as it was handed over, the inputs, and
the files the run delivered — all committed here, so the run can be re-checked
rather than re-told.

**The witnesses decide the outcome, never a model and never a look.** Each
scenario names the checks that settle it, and `svg_scenarios.test.ts` runs them:
the static witness (`lint_svg_asset`), the preservation readout for a surgical
edit, and the engine witness (`ui:render --profile asset`) for everything that
only exists once rendered.

| # | Directory | What it tests |
|---|---|---|
| 6.1 (a) | `s1-new-logo/` | A new mark as a true vector, from a brief alone |
| 6.1 (b) | `s1b-conversion/` | A raster converted to a vector, scored against the reference it was rendered from |
| 6.2 | `s2-surgical-face/` | Remove one figure's face, keep its hat — the preservation readout, not a pixel diff |
| 6.3 | `s3-scale/` | Scale 3000× without loss |
| 6.4 | `s4-animated/` | An animated variant whose reduced-motion route actually reaches SMIL |
| 6.5 | `s5-reopen/` | Every delivered file re-opens from disk and re-renders non-empty |

`manifest.json` carries the machine-readable shape the test reads: per scenario,
the delivered paths, the declared delivery mode and asset class, and the
assertions that settle it.
