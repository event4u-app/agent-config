# SVG mark static readings — pre-registration

Registered 2026-11-03 by `road-to-a-mark-that-survives-16px` step 0.1, BEFORE
any rule code exists. This is the reopen condition the archived
`road-to-tells-a-near-miss-can-refute` recorded at its step 7.6 when it closed
the mark audit readings as a named null: "reopens with a PREREG file under
`internal/bench/corpora/`". The commit that adds this file must precede (or be
the same change as, with this file written first) the commit that adds the
`svg-mark-*` rules; `git log --format=%H -- <this file> src/scripts/_lib/svg_mark_rules.ts`
is the proof.

## Scope

Static readings only — what the bytes of a master mark say without a render.
Every reading below runs only under `lint_svg_asset --class mark`; the default
invocation (no `--class`) is unchanged byte for byte.

Out of scope here, on purpose:

- **Render readings** (one-colour collapse, reversed on dark, 64 px, concept
  sheet) — parked on `later/road-to-a-mark-render-readings`.
- **Path complexity and text-to-path cost** — owned by
  `later/road-to-svg-witness-provenance` through its own pre-registration. No
  complexity threshold is gated here.
- **A static painted-over-hole reading** — the render-time
  `geometry/near-white-hole` already exists, and a static candidate has no
  measured discriminator yet. Not registered, so not built.

## The population

`tests/design-artifacts/fixtures/svg-assets/assets/`, rows in that directory's
`manifest.json` with `asset_class: "mark"` and a `mark/…` taxonomy id. Each
planted file has a one-edit `.clean.svg` twin. Every file is 480 × 480
(`viewBox="0 0 480 480"`) unless the row says otherwise, so the thresholds
below resolve to concrete units: 4 % of the canvas = 19.2 units, 1/48 of the
viewBox = 10 units.

| Reading | Planted | One-edit twin | Edit |
|---|---|---|---|
| `mark/live-text` | `mark-live-text.svg` | `mark-live-text.clean.svg` | the `<text>` element replaced by its outlined `<path>` |
| `mark/near-miss-angle` | `mark-near-miss-angle.svg` | `mark-near-miss-angle.clean.svg` | the 1.2° stroke endpoint moved onto 0° |
| `mark/tiny-detail` | `mark-tiny-detail.svg` | `mark-tiny-detail.clean.svg` | the r = 3 dot grown to r = 12 |
| `mark/colour-count` (report-only) | `mark-colour-count.svg` | `mark-colour-count.clean.svg` | three of six paints collapsed onto the remaining three |

Near-miss controls — legitimate craft a naive detector would flag. Each must
produce **zero** `svg-mark-*` findings under `--class mark`:

| Control | What it is | Must not report |
|---|---|---|
| `mark-one-colour.svg` | An intentional one-colour mark: a single paint on several shapes | `mark/colour-count`, every other `mark/…` id |
| `mark-optical-overshoot.svg` | A deliberate 0.5° optical overshoot, declared on the element with `data-optical="overshoot"` | `mark/near-miss-angle` |
| `mark-evenodd-hole.svg` | One `fill-rule="evenodd"` path whose second subpath is a declared counter (hole) of 120 units | `mark/tiny-detail` |

**Why the overshoot is declared rather than inferred.** A 0.5° segment sits
inside the 0.3–3° window by construction; nothing in the geometry tells a
deliberate overshoot from a slip. "Is this intended" is a question only the
author can answer — the same reasoning that gave `ui:render` its `data-hole`
attribute. The declaration is per element, so it cannot silence a second,
undeclared near-miss in the same file.

## The readings, thresholds and severities

| Rule id (linter) | Taxonomy id | Fires when | Severity | Gates the exit code |
|---|---|---|---|---|
| `svg-mark-live-text` | `mark/live-text` | any rendered `<text>`, `<tspan>` or `<textPath>` in the master mark | error | yes |
| `svg-mark-near-miss-angle` | `mark/near-miss-angle` | a straight segment (`M`/`L`/`H`/`V`/`Z` path edge, `<line>`, `<polyline>`/`<polygon>` edge) of length ≥ 4 % of the larger viewBox side whose direction, folded into [0°, 90°], is between 0.3° and 3° (inclusive) from the nearest of 0, 15, 30, 45, 60, 90°; silent on an element carrying `data-optical="overshoot"` | warning | yes |
| `svg-mark-tiny-detail` | `mark/tiny-detail` | a rendered subpath, circle, ellipse or rect whose larger extent is > 0 and < 1/48 of the smaller viewBox side | warning | yes |
| `svg-mark-colour-count` | `mark/colour-count` | more than 3 distinct solid paints (`fill`, `stroke`, `stop-color`, attribute or inline `style`; `none`, `transparent`, `currentColor` and `url(…)` excluded) | report | **never** |

Elements inside a non-rendered container (`defs`, `symbol`, `clipPath`,
`mask`, `marker`, `pattern`) and transformed elements are skipped by the
geometry readings — a box the reading has to guess at is a box it can be wrong
about.

### Why the numbers are these numbers

- **0.3–3°** — below 0.3° the endpoint drift over a canvas-length segment is
  under 2.5 units of 480, sub-pixel at every delivered size up to 512 px. Above
  3° the angle reads as intended, not as a miss. The window is the drafted
  plan's, carried unchanged; it is a stated default, not a measured optimum.
- **4 % of the canvas** — a shorter segment cannot carry a visible angle at
  16 px (4 % of 16 px is 0.64 px).
- **1/48 of the viewBox** — a mark delivered at 16 px maps 48 units of a
  48-unit grid onto 16 px, so 1/48 of the side is one third of a pixel: the
  detail cannot render as a distinct shape at favicon size.
- **More than 3 colours** — the drafted plan's advisory line. **No threshold was
  measured**, which is why this reading stays report-only. It matches the
  recorded stance in `src/cli/commands/uiRenderAssetTypes.ts` ("reported, never
  gated") and does not move it.

## Predictions, written down so the run can be wrong

- The lane probe (live text, a 1.2° stroke, 2–3 unit dots, six colours on a
  480 canvas) exits **0** today and exits **2** under `--class mark`, reported
  by `svg-mark-live-text`, `svg-mark-near-miss-angle`, `svg-mark-tiny-detail`,
  plus `svg-mark-colour-count` in the report column.
- Every clean twin and every control reads zero `svg-mark-*` findings.
- `lint_svg_asset` without `--class` produces byte-identical output on the
  existing corpus.

## Kill criteria

- A reading that fires on any of the three controls, after **one** tuning pass,
  is withdrawn — not tuned twice against this corpus.
- A reading that fails to fire on its planted file is withdrawn, not
  re-planted to fit.
- `svg-mark-colour-count` changes the exit code under any input → the change is
  reverted; promoting it to a gate needs a measured threshold and a new
  pre-registration.
- `svg-mark-near-miss-angle` or `svg-mark-tiny-detail` produce more than one
  finding across the held-out real set (`tests/design-artifacts/fixtures/svg-real/`)
  when its `mark`-class files are run with `--class mark` → demoted to report.

## Reopen condition for what is not here

The render readings reopen on `later/road-to-a-mark-render-readings` with
their own pre-registration; this file does not cover them.
