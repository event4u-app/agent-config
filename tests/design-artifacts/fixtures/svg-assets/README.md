# SVG-assets fixture — planted defects, one-edit twins, and what today's instruments read

Phase 0 of `road-to-svg-with-a-witness`. This directory exists **before** any of
the checkers that will read it, so the target table in § Targets is a
pre-registration rather than a description of what a checker happened to do.

`manifest.json` is the machine-readable form; this README is the human one, and
the test `tests/design-artifacts/svg_assets_fixture.test.ts` holds the two to
each other.

## Layout

| Directory | What it is |
|---|---|
| `assets/` | One planted `.svg` per defect, each beside its clean twin (`*.clean.svg`), plus three controls that must report nothing. |
| `hosts/` | Host HTML pages. Four defect classes only exist in a host — an id collision across two inline graphics, an `img` delivery with no static route, and the two inline-SMIL cases DQ4 reads. |
| `surgical/` | Three `before` / `good` / `bad` triples for the preservation readout (1.2) and the surgical-edit scenario (6.2). |
| `conversion/` | The committed reference vector the raster-to-vector sub-case (6.1b) is scored against. |

## The one-edit twin contract

Every row tagged `one-edit` differs from its twin in **exactly one contiguous
changed line region**. That is the whole point of the fixture: a rule that fires
on the planted file and not on its twin has been shown to read the defect rather
than the file.

Two authoring conventions make that contract reachable, and both are load-bearing
rather than stylistic:

- **The planted-defect comment sits immediately next to the line it describes.**
  A comment two lines away from the edit would split the change into two hunks
  and make the twin un-provable, so each file's comment is part of its single
  changed region.
- **Nothing identical appears *inside* a changed region.** A multi-line
  `<style>` block whose opening and closing lines are identical in both files
  would be matched by the diff and split one hunk into three; every internal
  style is therefore written on one line.

`assets/unused-defs.clean.svg` is the one `structural` twin, and
`manifest.json` says why: the defect is a reference dangling inside one file and
the clean form is a sprite sheet addressed from outside it. That is a different
file shape, not an edited line.

### Two traps this fixture fell into while being written

Both are recorded because a later author will hit them again:

- A comment containing the literal `@keyframes` or `animation:` makes
  `lint_design_quality` DQ4 fire on the comment. `hosts/smil-only.html` did,
  and reported a CSS finding on a page with no CSS motion at all.
- A comment containing the literal `<path` satisfies the `<path>`-presence check
  that `assets/primitive-only-mark.svg` exists to **fail**. That control now
  spells the element name out in prose instead.

## § Baseline — what today's instruments read (step 0.2)

Three instruments, run over this fixture on 2026-10-11. One row per planted
file; the controls follow in their own table.

**Which build was measured, stated plainly.** The readings below are from
`origin/main` at `fd02787ef` — the commit this roadmap's Context section pins
its reproduction to. The worktree this fixture was authored in carries
*uncommitted* work on `lint_design_quality.ts` from a parallel lane (the step
1.3 SMIL extension), and that build reports both inline-SMIL host rows. Quoting
that build as "today's baseline" would record a checker this phase is supposed
to precede, so the pre-checker build was materialised from `origin/main` and run
against these same files. The in-flight reading is noted at the foot of the
table, because hiding it would be the other half of the same dishonesty.

Commands:

```
npx tsx src/scripts/lint_design_quality.ts --dir tests/design-artifacts/fixtures/svg-assets/hosts
npx tsx src/scripts/lint_design_quality.ts --dir tests/design-artifacts/fixtures/svg-assets/assets
```

`isUiPath` was imported from `src/scripts/_lib/ui_surface.ts` and evaluated over
every path under this directory. The `<path>`-presence check is the one
`src/skills/logo-generation/SKILL.md:53-55` describes — "validate that the output
contains `<path>` elements before treating it as an editable mark" — applied as
a literal search for `<path`. **PASS** means the check accepts the file as an
editable true vector.

| file | `lint_design_quality --dir` | `isUiPath` | `<path>`-presence check | note |
|---|---|---|---|---|
| `assets/loose-viewbox.svg` | not scanned — `.svg` is outside the walk extension set; the directory run exits 1 with "scanned 0 HTML/CSS file(s)" | `false` | FAIL | A viewBox defect no instrument in the tree can see. |
| `assets/element-outside-viewbox.svg` | not scanned (exit 1, scanned 0) | `false` | PASS | Accepted as a true vector while a whole element never paints. |
| `assets/text-overflows-box.svg` | not scanned (exit 1, scanned 0) | `false` | FAIL | Text fit is an engine reading; nothing reads it today. |
| `assets/default-serif-fallback.svg` | not scanned (exit 1, scanned 0) | `false` | FAIL | The resolved family is an engine reading; nothing reads it today. |
| `hosts/inline-generic-ids.html` | clean — 10 file(s) checked, no violations | `true` | n/a | DQ1-DQ6 carry no ARIA-name rule, so the collision passes. |
| `assets/meaningful-without-name.svg` | not scanned (exit 1, scanned 0) | `false` | PASS | Accepted as a true vector while carrying no accessible name. |
| `assets/double-name.svg` | not scanned (exit 1, scanned 0) | `false` | FAIL | Two competing names, unreported. |
| `assets/keysplines-out-of-range.svg` | not scanned (exit 1, scanned 0) | `false` | FAIL | An animation that never runs, unreported. |
| `assets/transform-origin-no-box.svg` | not scanned (exit 1, scanned 0) | `false` | FAIL | The R9 pair — a correct twin element sits in the same file. |
| `assets/animation-no-reduced-motion.svg` | not scanned (exit 1, scanned 0) | `false` | FAIL | A standalone `.svg` reaches no motion rule at all. |
| `assets/smil-css-only-branch.svg` | not scanned (exit 1, scanned 0) | `false` | FAIL | Same, for the subtler CSS-only branch. |
| `assets/guessed-dash.svg` | not scanned (exit 1, scanned 0) | `false` | PASS | Accepted as a true vector; the dead time is invisible without a render. |
| `assets/active-content-script.svg` | not scanned (exit 1, scanned 0) | `false` | FAIL | Script, handler, `foreignObject` and `javascript:` href, unreported. |
| `assets/internal-dtd-entity.svg` | not scanned (exit 1, scanned 0) | `false` | PASS | Accepted as a true vector while carrying an internal DTD subset. |
| `assets/missing-xmlns.svg` | not scanned (exit 1, scanned 0) | `false` | PASS | Accepted as a true vector although an `img` delivery renders nothing. |
| `assets/unparseable-path.svg` | not scanned (exit 1, scanned 0) | `false` | PASS | The sharpest false green: the presence check reads `<path`, never the `d`. |
| `assets/unused-defs.svg` | not scanned (exit 1, scanned 0) | `false` | FAIL | A dead gradient, unreported. |
| `assets/near-white-hole.svg` | not scanned (exit 1, scanned 0) | `false` | FAIL | S5's failure; only a dark-background render shows it. |
| `assets/d-morph-mismatch.svg` | not scanned (exit 1, scanned 0) | `false` | PASS | Accepted as a true vector while the morph cannot interpolate. |
| `assets/external-reference.svg` | not scanned (exit 1, scanned 0) | `false` | FAIL | An external `href` and an external `url()`, unreported. |
| `assets/dangling-reference.svg` | not scanned (exit 1, scanned 0) | `false` | FAIL | Two dangling references, unreported. |
| `assets/raster-in-vector.svg` | not scanned (exit 1, scanned 0) | `false` | PASS | **D3's false green, confirmed**: a PNG beside one dummy path passes. |
| `assets/icon-off-grid.svg` | not scanned (exit 1, scanned 0) | `false` | PASS | Off-grid stroke and padding; the grid is an engine reading. |
| `hosts/img-delivery.html` | clean — 10 file(s) checked, no violations | `true` | n/a | No rule reads delivery mode, so the missing static route passes. |
| `hosts/smil-only.html` | clean — 10 file(s) checked, no violations | `true` | n/a | **R10, confirmed**: an indefinite inline `<animate>` with no route reads clean. |
| `hosts/smil-css-only.html` | clean — 10 file(s) checked, no violations | `true` | n/a | **R4 / D8, confirmed**: a CSS-only branch satisfies DQ4 and leaves SMIL running. |

Controls, same three instruments:

| file | `lint_design_quality --dir` | `isUiPath` | `<path>`-presence check | note |
|---|---|---|---|---|
| `assets/primitive-only-mark.svg` | not scanned (exit 1, scanned 0) | `false` | FAIL | **D3's false red, confirmed**: the geometric mark `logo-generation` recommends is rejected as non-vector. |
| `assets/spinner-intentional-dash.svg` | not scanned (exit 1, scanned 0) | `false` | FAIL | An intentional dash pattern (R12); no static rule may fire on it. |
| `assets/hamburger-24-grid.svg` | not scanned (exit 1, scanned 0) | `false` | PASS | Fill ratio 0.375 is designed padding (R12); it must stay clean at the icon threshold. |

### The four pre-registered expectations, and whether they held

The roadmap's step 0.2 states four expectations "from R10 and D9, not assumed".
All four held on the `origin/main` build:

| Expectation | Observed | Held |
|---|---|---|
| 0 SMIL rows from `lint_design_quality --dir` over `hosts/` | `clean — 10 file(s) checked, no violations`, exit 0 | yes |
| 0 `.svg` paths from `isUiPath` | 0 of 59 `.svg` files; `true` on exactly the 10 `.html` files | yes |
| A pass for the raster-with-dummy-path file | `assets/raster-in-vector.svg` → PASS | yes |
| A fail for the `rect`/`circle` mark | `assets/primitive-only-mark.svg` → FAIL | yes |

Two readings beyond the four, recorded because they are part of the baseline:

- `lint_design_quality --dir` over `assets/` exits **1** with the scanned-nothing
  refusal — `scanned 0 HTML/CSS file(s) … the scan scope is dead or the root
  moved`. It does not pass, and it does not report; it refuses. That refusal is
  the honest shape of D7 and the convention 1.1 inherits.
- On the worktree build carrying the parallel lane's uncommitted step-1.3 work,
  the same host run reports exactly **2** findings — `smil-only.html:15` (no
  route at all) and `smil-css-only.html:15` (CSS-only route) — and nothing on
  the other eight host files, their two clean twins included. That build is not
  the baseline, but it is evidence that both inline-SMIL host rows are
  reachable and that neither twin is a false positive.

## § Targets — pre-registered before any checker exists (step 0.3)

Static layer: every row tagged `static` found, **0 findings on twins**. Engine
layer: every row tagged `engine` found where Playwright resolves, and
`unverified` otherwise.

```
AN ENGINE ROW WITHOUT PLAYWRIGHT IS `unverified`. NEVER A PASS.
```

That is not a formality. An engine row reports a property of a render, and a
host with no renderer has not produced one — so the only honest reading is that
nobody looked, which is a different fact from "nothing was wrong".

| rule id | layer | planted rows it must find | findings allowed on clean twins | asset-class threshold |
|---|---|---|---|---|
| `structure/loose-viewbox` | engine | `loose-viewbox` | 0 | fill ratio, per class (below) |
| `structure/element-outside-viewbox` | static | `element-outside-viewbox` | 0 | — |
| `structure/missing-xmlns` | static | `missing-xmlns` | 0 | — |
| `structure/unparseable-path-data` | static | `unparseable-path` | 0 | — |
| `structure/dangling-reference` | static | `dangling-reference` | 0 | — |
| `structure/unused-defs-entry` | static | `unused-defs` | 0 (a `<symbol id>` is exempt) | — |
| `safety/active-content` | static | `active-content-script` | 0 | graded per delivery mode (1.5) |
| `safety/internal-dtd-subset` | static | `internal-dtd-entity` | 0 (a bare public DOCTYPE is clean) | — |
| `safety/external-reference` | static | `external-reference` | 0 | — |
| `vector-honesty/embedded-raster` | static | `raster-in-vector` | 0 | — |
| `accessibility/meaningful-without-name` | static | `meaningful-without-name` | 0 | — |
| `accessibility/double-name` | static | `double-name` | 0 | — |
| `accessibility/generic-id-collision` | static | `generic-id-collision` | 0 | — |
| `motion/keysplines-out-of-range` | static | `keysplines-out-of-range` | 0 | — |
| `motion/transform-origin-without-box` | static | `transform-origin-no-box` | 0 — binds per element, never per file (R9) | — |
| `motion/no-reduced-motion-branch` | static | `animation-no-reduced-motion`, `inline-smil-no-route` | 0 | — |
| `motion/smil-css-only-branch` | static | `smil-css-only-branch`, `inline-smil-css-only-route` | 0 | — |
| `motion/d-morph-command-mismatch` | static | `d-morph-mismatch` | 0 | — |
| `motion/draw-on-dead-time` | engine | `guessed-dash` | 0 | — |
| `motion/img-delivery-no-static-route` | engine | `img-delivery-no-picture-route` | 0 | — |
| `geometry/text-overflows-box` | engine | `text-overflows-box` | 0 | — |
| `geometry/default-font-fallback` | engine | `default-serif-fallback` | 0 | — |
| `geometry/near-white-hole` | engine | `near-white-hole` | 0 | — |
| `geometry/icon-off-grid` | engine | `icon-off-grid` | 0 | read from the incumbent set's own SVGs (E6) |

Three controls bound the whole table: `primitive-only-mark` must never be
reported by the vector-honesty family, `spinner-intentional-dash` never by a
dash rule, and `hamburger-24-grid` never by `structure/loose-viewbox`.

### Fill-ratio thresholds, per class

Never global — a global 0.5 is what made the prototype call a 24-grid hamburger
loose (R12). A file is loose below its class threshold.

| asset class | minimum fill ratio |
|---|---|
| `icon` | 0.30 |
| `mark` | 0.45 |
| `illustration` | 0.40 |
| `diagram` | 0.35 |
| `animated` | 0.35 |

### Geometry tolerances, per class

For 2.6's comparison of two renders of the same frame, in viewBox units, with a
one-device-pixel anti-aliasing band excluded.

| asset class | minimum silhouette IoU | maximum boundary distance (viewBox units) |
|---|---|---|
| `icon` | 0.98 | 1.0 |
| `mark` | 0.98 | 2.0 |
| `illustration` | 0.96 | 3.0 |
| `diagram` | 0.97 | 2.0 |
| `animated` | 0.97 | 2.0 |

### Raster-conversion tolerance

For the raster source in 6.1(b), against `conversion/reference.svg`. These are
the one accepted point on record (S13), used as a **floor**: the fixture raster
is rendered from a flat-gradient vector, so a conversion of it must do at least
as well as the session's conversion of a photographic brand sheet did.

| reading | threshold |
|---|---|
| silhouette IoU over saturated regions | ≥ 0.984 |
| mean colour error over non-background pixels (0-255) | ≤ 7.8 |
| share of pixels off by more than 40/255 | ≤ 0.012 |
| scored passes to reach it | ≤ 5 |

A font-only delta reads `degraded` with both resolved families named, never
`fail`, and a raster comparison without a declared registration reads
`unverified` rather than the best of several guesses.

## § Measured — every layer on (step 5.1)

Identical row set to the baseline table above, which is the point: a row that
appears in one and not the other is a row somebody stopped measuring. The
engine layer reads `unverified` wherever the asset profile did not run — never
a pass.

| file | layer | pre-registered rule | answered by | planted | twin findings |
|---|---|---|---|---|---|
| `assets/loose-viewbox.svg` | engine | `structure/loose-viewbox` | ui:render --profile asset | found | 0 |
| `assets/element-outside-viewbox.svg` | static | `structure/element-outside-viewbox` | lint_svg_asset svg-structure-outside-viewbox | found | 0 |
| `assets/text-overflows-box.svg` | engine | `geometry/text-overflows-box` | ui:render --profile asset | found | 0 |
| `assets/default-serif-fallback.svg` | engine | `geometry/default-font-fallback` | ui:render --profile asset | found | 0 |
| `hosts/inline-generic-ids.html` | static | `accessibility/generic-id-collision` | lint_svg_asset svg-a11y-generic-id | found | 0 |
| `assets/meaningful-without-name.svg` | static | `accessibility/meaningful-without-name` | lint_svg_asset svg-a11y-no-accessible-name | found | 0 |
| `assets/double-name.svg` | static | `accessibility/double-name` | lint_svg_asset svg-a11y-double-name | found | 0 |
| `assets/keysplines-out-of-range.svg` | static | `motion/keysplines-out-of-range` | lint_svg_asset svg-motion-keysplines-range | found | 0 |
| `assets/transform-origin-no-box.svg` | static | `motion/transform-origin-without-box` | lint_svg_asset svg-motion-transform-box | found | 0 |
| `assets/animation-no-reduced-motion.svg` | static | `motion/no-reduced-motion-branch` | lint_svg_asset svg-motion-no-reduced-motion | found | 0 |
| `assets/smil-css-only-branch.svg` | static | `motion/smil-css-only-branch` | lint_svg_asset svg-motion-smil-css-only | found | 0 |
| `assets/guessed-dash.svg` | engine | `motion/draw-on-dead-time` | ui:render --profile asset | found | 0 |
| `assets/active-content-script.svg` | static | `safety/active-content` | lint_svg_asset svg-safety-active-content | found | 0 |
| `assets/internal-dtd-entity.svg` | static | `safety/internal-dtd-subset` | lint_svg_asset svg-safety-internal-subset | found | 0 |
| `assets/missing-xmlns.svg` | static | `structure/missing-xmlns` | lint_svg_asset svg-structure-missing-xmlns | found | 0 |
| `assets/unparseable-path.svg` | static | `structure/unparseable-path-data` | lint_svg_asset svg-structure-unparseable-path | found | 0 |
| `assets/unused-defs.svg` | static | `structure/unused-defs-entry` | lint_svg_asset svg-structure-unused-defs | found | 0 |
| `assets/near-white-hole.svg` | engine | `geometry/near-white-hole` | ui:render --profile asset | found | 0 |
| `assets/d-morph-mismatch.svg` | static | `motion/d-morph-command-mismatch` | lint_svg_asset svg-motion-d-morph-mismatch | found | 0 |
| `assets/external-reference.svg` | static | `safety/external-reference` | lint_svg_asset svg-safety-external-reference | found | 0 |
| `assets/dangling-reference.svg` | static | `structure/dangling-reference` | lint_svg_asset svg-structure-dangling-reference | found | 0 |
| `assets/raster-in-vector.svg` | static | `vector-honesty/embedded-raster` | lint_svg_asset svg-vector-embedded-raster | found | 0 |
| `assets/icon-off-grid.svg` | engine | `geometry/icon-off-grid` | ui:render --profile asset | found | 0 |
| `hosts/img-delivery.html` | engine | `motion/img-delivery-no-static-route` | ui:render --profile asset | found | 0 |
| `hosts/smil-only.html` | static | `motion/no-reduced-motion-branch` | lint_design_quality DQ4 | found | 0 |
| `hosts/smil-css-only.html` | static | `motion/smil-css-only-branch` | lint_design_quality DQ4 | found | 0 |
| `assets/primitive-only-mark.svg` | static | `vector-honesty/embedded-raster / vector-honesty/not-a-true-vector` | must stay silent | n/a — control | 0 |
| `assets/spinner-intentional-dash.svg` | static | `motion/draw-on-dead-time / motion/guessed-dash` | must stay silent | n/a — control | 0 |
| `assets/hamburger-24-grid.svg` | static | `structure/loose-viewbox` | must stay silent | n/a — control | 0 |

## § Promotion bar (step 5.2)

The BAR a later promotion would have to cite, not the promotion. Every rule here
ships advisory (decision E5). A rule becomes a blocking candidate only at zero
twin findings across TWO CONSECUTIVE measured runs and at least one true finding
on its planted row — two runs rather than one, because a single run cannot tell a
rule that is stable from a rule that happened to be quiet. Promoting any of them
stays outside this roadmap.

The twin column is measured over EVERY clean file in the corpus, not over the
rule's own twin alone — a rule that reds a different row's clean file has not
cleared a zero-false-positive bar in any sense a consumer would recognise, and a
column scoped to its own twin would have scored it `yes`.

**Outcome of this run: 23 of 26 rules meet the bar, 3 do not.** Each miss names the clean file it fired on, in its own row.

| rule | file | layer | true findings on planted | twin findings run 1 | twin findings run 2 | meets bar |
|---|---|---|---|---|---|---|
| `structure/loose-viewbox` | `assets/loose-viewbox.svg` | engine | 1+ | 1 | 1 (assets/text-overflows-box.clean.svg) | no |
| `structure/element-outside-viewbox` | `assets/element-outside-viewbox.svg` | static | 1+ | 0 | 0 | yes |
| `geometry/text-overflows-box` | `assets/text-overflows-box.svg` | engine | 1+ | 0 | 0 | yes |
| `geometry/default-font-fallback` | `assets/default-serif-fallback.svg` | engine | 1+ | 0 | 0 | yes |
| `accessibility/generic-id-collision` | `hosts/inline-generic-ids.html` | static | 1+ | 0 | 0 | yes |
| `accessibility/meaningful-without-name` | `assets/meaningful-without-name.svg` | static | 1+ | 0 | 0 | yes |
| `accessibility/double-name` | `assets/double-name.svg` | static | 1+ | 0 | 0 | yes |
| `motion/keysplines-out-of-range` | `assets/keysplines-out-of-range.svg` | static | 1+ | 0 | 0 | yes |
| `motion/transform-origin-without-box` | `assets/transform-origin-no-box.svg` | static | 1+ | 0 | 0 | yes |
| `motion/no-reduced-motion-branch` | `assets/animation-no-reduced-motion.svg` | static | 1+ | 1 | 1 (assets/guessed-dash.clean.svg) | no |
| `motion/smil-css-only-branch` | `assets/smil-css-only-branch.svg` | static | 1+ | 0 | 0 | yes |
| `motion/draw-on-dead-time` | `assets/guessed-dash.svg` | engine | 1+ | 0 | 0 | yes |
| `safety/active-content` | `assets/active-content-script.svg` | static | 1+ | 0 | 0 | yes |
| `safety/internal-dtd-subset` | `assets/internal-dtd-entity.svg` | static | 1+ | 0 | 0 | yes |
| `structure/missing-xmlns` | `assets/missing-xmlns.svg` | static | 1+ | 0 | 0 | yes |
| `structure/unparseable-path-data` | `assets/unparseable-path.svg` | static | 1+ | 0 | 0 | yes |
| `structure/unused-defs-entry` | `assets/unused-defs.svg` | static | 1+ | 0 | 0 | yes |
| `geometry/near-white-hole` | `assets/near-white-hole.svg` | engine | 1+ | 0 | 0 | yes |
| `motion/d-morph-command-mismatch` | `assets/d-morph-mismatch.svg` | static | 1+ | 0 | 0 | yes |
| `safety/external-reference` | `assets/external-reference.svg` | static | 1+ | 0 | 0 | yes |
| `structure/dangling-reference` | `assets/dangling-reference.svg` | static | 1+ | 0 | 0 | yes |
| `vector-honesty/embedded-raster` | `assets/raster-in-vector.svg` | static | 1+ | 0 | 0 | yes |
| `geometry/icon-off-grid` | `assets/icon-off-grid.svg` | engine | 1+ | 0 | 0 | yes |
| `motion/img-delivery-no-static-route` | `hosts/img-delivery.html` | engine | 1+ | 0 | 0 | yes |
| `motion/no-reduced-motion-branch` | `hosts/smil-only.html` | static | 1+ | 1 | 1 (assets/guessed-dash.clean.svg) | no |
| `motion/smil-css-only-branch` | `hosts/smil-css-only.html` | static | 1+ | 0 | 0 | yes |

## The held-out real set

Step 3.2 of `road-to-svg-review-followups`. Everything above this heading is
**planted**: a defect written on purpose, with a one-edit twin. A promotion bar
measured only on planted files says how well the checkers find defects somebody
chose for them, and nothing about how they behave on a file written to be
right. So there is a second set, and it is reported separately — never merged
into the planted totals.

It lives in `tests/design-artifacts/fixtures/svg-real/` <!-- ref-ignore --> and
covers every asset class. Every file is this project's own: two are already in
the tree (`site/public/favicon.svg`,
`src/scripts/media/lib/fixtures/recraft/asset-0001.svg`), two are the
conversion scenarios' delivered marks, and three were authored for this set.
**No third-party file**, which is the same rule the scenario directory keeps.

**Pre-registered, under 0.3's rule.** The expected column below was written
before any checker ran over the set, and no rule has been tuned against it.
The measured column is the reading that followed.

| File | class | pre-registered | measured | reading |
|---|---|---|---|---|
| `favicon-32.svg` | icon | 0 | 0 | xmlns, viewBox, `role="img"`, `aria-label`, no references |
| `recraft-asset-0001.svg` | icon | 1 · `svg-a11y-no-accessible-name` | 1 · `svg-a11y-no-accessible-name` | a generated 16-unit square with no role, title or label — a real file that is genuinely unnamed |
| `authored-mark.svg` | mark | 0 | 0 | scenario 1's delivered mark |
| `conversion-reference-mark.svg` | mark | 0 | 0 | scenario 1b's delivered mark |
| `runway-illustration.svg` | illustration | 0 | 0 | `aria-labelledby` pointing at its own `<title>`, explicit font stack |
| `dispatch-diagram.svg` | diagram | 0 | 0 | namespaced marker id, three labelled nodes |
| `settle-spinner.svg` | animated | 0 | 0 | CSS animation with a `prefers-reduced-motion` branch and `transform-box` |

**7 files, 1 finding, and the prediction matched the measurement on every
row.** That is the reading, not a target: a second set exists so that a future
rule which starts firing on correct files has somewhere to show up, and a row
that moves is the signal rather than a failure to explain away.

**What this set does NOT do.** It is small, it is ours, and it is therefore not
a sample of SVGs in the wild. It bounds false positives on files written to
this project's own conventions, which is the population the checkers actually
meet, and it says nothing about a file written to anybody else's.
