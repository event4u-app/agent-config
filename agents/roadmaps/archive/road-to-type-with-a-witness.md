---
complexity: structural
status: ready
execution:
  mode: phase-checkpoints
relates:
  - slug: road-to-svg-with-a-witness
    relation: extends
    note: "Archived. Its raster branch (svg-authoring § Trace to measure, construct to deliver, measured silhouette IoU) and its asset witness (`ui:render --profile asset`) are reused for glyphs and for the proof page instead of being rebuilt."
  - slug: road-to-svg-witness-provenance
    relation: disjoint
    note: "Active. It hardens the SVG turn-end obligation and the declared delivery mode; Phase 1 here touches only the font sentinel inside the asset profile and adds no obligation, so neither waits on the other."
  - slug: road-to-webfont-delivery-ownership
    relation: extends
    note: "Archived. ADR-205 gave third-party webfont delivery one owner; the section now lives in docs/guidelines/design-asset-discipline.md, and Phase 2 adds rows there and nowhere else."
  - slug: road-to-design-craft-antislop
    relation: disjoint
    note: "Archived. It deferred the font-weight-count detector as a design-system opinion; this roadmap keeps that disposition (decision A6) and adds no weight-count tell."
  - slug: road-to-skill-scripts-that-run-where-they-land
    relation: disjoint
    note: "Active. Owns the bundled-script contract; the new skill bundles no script and runs a pinned peer-side toolchain, so that contract is not touched."
estate_offset_exempt: "Adds one active roadmap with nothing to offset: no active, later or stub roadmap owns font construction, the font states of the asset witness, or the typography carriers (swept agents/roadmaps/ for font, glyph, typography, line-height and document.fonts on 2026-10-12). Merging into road-to-svg-witness-provenance would bind a typography programme to a three-finding security follow-up."
estate_growth_exempt: "2026-10-18 change: one skill (`type-design`) and its description tokens — no existing skill can carry a twelve-step font-construction pipeline behind its own trigger (decision A1), and the description cost is paid by a same-change rules reduction, so the per-spawn payload falls. Earlier change: one open blocker (benchmark-fixture-fonts) is added with this file: the reconstruction benchmark needs real font families as held-out truth, and whether the 2026-06-28 no-font-bundler council lock covers a maintainer-run benchmark is a lock interpretation the council owns, not a step an agent can take."
---
# Road to type with a witness

> **Source:** `agents/tmp.old/inbox-2026-10-m/` — a maintainer transcript asking
> for a deep look at an external skill collection with a focus on frontend and
> font skills, and for a skill that designs an original font from a lettering
> image or from a prompt; plus the two three-loop plans it produced on two hosts.
> Re-verified at `main@17f028941`. Engine readings re-run offline on the repo's
> own Playwright Chromium (`file://` and intercepted routes only, no network).

## Goal

1. The typography guidance an agent receives has one value per question, and
   every capability `typography-system` claims to carry exists in the tree.
2. The witness reports which face actually painted the text — loaded, failed,
   or synthesised — instead of the first declared family.
3. An agent can design an original font from a lettering image or from a prompt
   as a constructed system: measured parameters, outlines built by code from
   measured parts, spacing before kerning, and a build that passes outline,
   metric, coverage and fidelity gates with a rendered proof the agent looked at.
4. The package still ships no font binary and no Python, and no output claims a
   licence it cannot show.

## Context — reproduced at `main@17f028941`

- **One question, two values.** Body line-height is `1.5` in
  `src/skills/typography-system/SKILL.md:52` and in
  `src/skills/design-intelligence/references/design-rules-checklist.md:27`, and
  `1.5-1.75` at `design-rules-checklist.md:131`. The Q8 row
  (`docs/guidelines/design-antipatterns.md:211`, `>= 1.3`) is a floor, not a
  second value. `design-rules-checklist.md:115` attaches the iOS focus-zoom
  rationale to body text, while the zoom is a form-control behaviour; the Q2
  floor (`design-antipatterns.md:205`) is the body rule.
- **A claim with nothing behind it.** `typography-system/SKILL.md:189-196`
  justifies `token_budget_class: rich` with "6 worked-through modular-scale
  examples" and "per-pairing line-height + weight guidance". The skill directory
  holds `SKILL.md` and `evals/` only; the pairings CSV has no line-height column,
  and 3 of its 73 rows mention leading in free text (parsed as CSV; 15 rows carry
  a `T7:` flag, matching `design-intelligence/SKILL.md:184`).
- **Inter is not a system face.** `tailwind-engineer/SKILL.md:204-205` reads
  "fallback to Arial / Helvetica / Inter via system defaults".
- **Font files without a licence line.** `canvas-design/SKILL.md:79,119` places
  a chosen font file into a working directory with no name, source or licence
  recorded; `svg-authoring/SKILL.md:245-248` already states that rule for
  outlined lettering.
- **The page witness reports the declared family.** `collectTypeFamilies`
  (`src/cli/commands/uiRender.ts:252-258`) returns the first family of the
  computed stack: for `"Not Installed X", Georgia, serif` it returned
  `not installed x` (reproduced through tsx).
- **The asset witness tells resolved from unresolved, not loaded from failed.**
  Its sentinel (`src/cli/commands/uiRenderAsset.ts:813-821`) compares a
  `measureText` width against an absent family. Nothing in `src/cli` or
  `src/scripts` reads `document.fonts` (0 hits for `document.fonts`, `FontFace`,
  `fonts.ready`), so a face whose file failed and a requested weight the face
  lacks are not reported as such.
- **The load event already waits for a used webfont** —
  `corrected-from-reproduction`. The source predicted a flaky false fallback
  because navigation waits for `load` (`uiRender.ts:354`,
  `uiRenderAsset.ts:707`). Reproduced on Chromium with the font route delayed
  by 2,000 ms: `load` fired at 2,019 ms and the face read `loaded`, the
  sentinel `resolves: true`. The flake did not reproduce for a face the page
  uses; it stays open for a face only a later script uses, and WebKit was not
  measured.
- **The counter trap is real.** Two same-direction circles (r 250 and 160) in
  one path: `fill-rule="nonzero"` painted 196,314 px (a full disc is 196,350),
  `evenodd` painted 116,007 px (the ring is 115,925). The SVG tooling does not
  know the property: 0 hits for `fill-rule`, `evenodd` or `winding` in
  `src/skills/svg-authoring`, `src/scripts/lint_svg_asset.ts`,
  `src/scripts/_lib/svg_rules.ts` and `src/scripts/_lib/svg_geometry.ts`.
- **No capability builds a glyph or a font.** 0 hits under `src/` for
  `fonttools`, `fontmake`, `ufo2ft`, `potrace` or `ufoLib`; no skill directory
  matches `font` or `type`. `logo-generation` and `svg-authoring` mention
  wordmarks and hand off nothing toward the rest of an alphabet.
- **Delivery tells are absent.** 0 hits under `src/` and `docs/` for
  `font-synthesis`, `size-adjust`, `ascent-override`, `font-feature-settings`,
  `tabular-nums`. The delivery owner is
  `docs/guidelines/design-asset-discipline.md:14-27` (the section ADR-205 points
  at moved there from `design-fidelity-mechanics.md`).
- **Registry items are viewed, not audited.**
  `react-shadcn-ui/references/registry.md:58-60` says inspect with `view`
  before `add`; nothing routes a namespaced third-party item through
  `supply-chain-intake`.

### Hard constraints, each measured today

- **Zero net growth of the per-spawn payload.** `check_preamble_payload_budget`
  measured 135,975 tokens against a ceiling of 135,975 measured at the base ref
  (design ceiling 107,646). A skill's catalogue entry costs tokens, so a new
  skill lands only beside a reduction of at least its own cost in the same change.
- **No skill allowance.** `src/config/estate-count-budget.json:25`:
  `skill_count` is "0 — no allowance"; an addition carries an
  `estate_growth_exempt` claim. The new-skill gate wants at least 5
  should-trigger and 5 should-not-trigger queries and at most 0.7 body overlap
  (`src/scripts/lint_new_skill_gate.ts:43-44`).
- **No Python under `src/`.** `.github/workflows/no-python-in-src.yml` fails on
  any `src/**/*.py`, permanently. `markitdown/SKILL.md:67-78` is the precedent
  for a pinned peer-side Python tool.
- **No font binaries, no font bundler — amended 2026-10-16 to bind published
  artefacts.** At authoring time no tracked file anywhere ended in `.ttf`,
  `.otf`, `.woff`, `.woff2` or `.ttc`;
  `design-system-capture/references/design-system-json.md:61-63` and the
  2026-06-28 council lock cited at
  `agents/roadmaps/stubs/road-to-multi-host-screenshot-census.md:77-79`. The
  council narrowed that lock to **published** artefacts on 2026-10-16 (A11), so
  5.8's benchmark fixtures are tracked and 5.9 verifies the produced archive
  rather than the exclusion list that is supposed to produce it. The sentence
  the stub cites — *"no font-bundler is to be shipped"* — is unchanged by the
  amendment; shipping is exactly what still binds.
- **No new hook concern.** `concern_count` carries no allowance either
  (`estate-count-budget.json:27`), so the font build gets no turn-end
  obligation of its own; the proof goes through the existing asset witness.

## Phase 0 — Typography truth

- [x] **0.1 One body line-height authority.** `typography-system` owns the
      value: 1.5 default, a stated 1.4 to 1.7 band chosen by measure and
      x-height. `design-rules-checklist.md:27` and `:131` cite it instead of
      restating a number; Q8 stays a floor.
      verify: `grep -c "1.5-1.75" src/skills/design-intelligence/references/design-rules-checklist.md` -> /^0$/
      Done 2026-10-16: authority line in typography-system step 3; checklist rows cite it.
- [x] **0.2 Two rows where one mixed two facts.** `design-rules-checklist.md:115`
      becomes a body floor that cites Q2 and a separate form-control row:
      inputs, selects and textareas at 16 px or more on touch layouts, which is
      what triggers the zoom. The engine behaviour is not re-measured here
      (no WebKit in reach); the row states it as the documented trigger.
      verify: `grep -cE "readable-font-size.*auto-zoom" src/skills/design-intelligence/references/design-rules-checklist.md` -> /^0$/
      Done 2026-10-16: `readable-font-size` cites Q2; new `control-font-size` row carries the zoom trigger.
- [x] **0.3 The rich claim matches the content (decision A4).** Add
      `src/skills/typography-system/references/worked-scales.md` with six
      worked scales (marketing, dashboard, docs, e-commerce, SaaS, editorial),
      each the ratio, the base, the rounded sizes and the line-height it takes
      from 0.1. Rewrite `SKILL.md:189-196` to name what the skill carries and
      drop the per-pairing line-height claim.
      verify: `grep -c "per-pairing line-height" src/skills/typography-system/SKILL.md` -> /^0$/
      Done 2026-10-16: `references/worked-scales.md` with six scales; rich justification rewritten.
- [x] **0.4 Inter is a webfont.** `tailwind-engineer/SKILL.md:204-205` says the
      template default reaches for Inter as a webfont and the OS stack resolves
      to Arial or Helvetica.
      verify: `grep -c "Inter$" src/skills/tailwind-engineer/SKILL.md` -> /^0$/
      Done 2026-10-16.
- [x] **0.5 Every placed font file carries its licence.** `canvas-design` step 2
      and its § Font availability inherit the lettering rule at
      `svg-authoring/SKILL.md:245-248`: name, source and licence of every font
      file placed; an unknown licence is reported as unknown; no file is
      fetched whose licence is not shown.
      verify: `grep -ci "licen" src/skills/canvas-design/SKILL.md` -> /^[1-9]/
      Done 2026-10-16: step 4.2 and § Font availability record name, source and licence.
- [x] **0.6 A drift test for the two values.** A vitest under `tests/skills/`
      reads the three carriers and fails when body line-height or the control
      font-size floor appears with a second value. Seen red against a copy of
      today's text before 0.1 and 0.2 land.
      verify: `npx vitest run tests/skills/typography_value_drift.test.ts` -> 0
      Done 2026-10-16: seen red on the live text before 0.1/0.2 (2 failing cases), and a pinned prior-text case keeps the sensitivity.

## Phase 1 — The witness says which face painted

- [x] **1.1 Face status per declared family** — `corrected-from-reproduction`.
      In the asset profile's in-page reading next to the sentinel
      (`uiRenderAsset.ts:813-821`), read `document.fonts` for every declared
      family and report `loaded`, `error` or `unloaded` beside the existing
      resolved flag. No added wait: `load` already holds for a used face. One
      bounded `document.fonts.ready` wait (3 s) runs only when a declared face
      still reads `loading`, and a timeout is its own state, never a fallback.
      verify: `npx vitest run tests/cli/ui_render_asset_font_state.test.ts --reporter=verbose` -> /✓.*face-error-reads-error/
      Done 2026-10-17: `src/cli/commands/uiRenderAssetFonts.ts`, called right after the geometry reading (the 1,500-line ceiling keeps it out of `uiRenderAsset.ts`); `face_family`/`face_state` on each text reading, finding `geometry/font-face-error`.
- [x] **1.2 Synthesis is a state.** An SVG text element whose requested weight or style
      no loaded face of its family carries, and whose `font-synthesis` is not
      `none`, reports `synthesised`.
      verify: `npx vitest run tests/cli/ui_render_asset_font_state.test.ts --reporter=verbose` -> /✓.*missing-weight-reads-synthesised/
      Done 2026-10-17: matched on the `@font-face` descriptors; finding `geometry/font-synthesised`; `font-synthesis: none` and a 500 request are pinned near misses.
- [x] **1.3 The page profile keeps declared and adds painted.**
      `collectTypeFamilies` gains a resolved family per sampled node beside the
      declared one; the A1.5 threshold and the preserve check in
      `ui_authority.ts` keep reading the declared list.
      verify: `npx vitest run tests/cli/ui_render_painted_family.test.ts` -> 0
      Done 2026-10-17: a `painted-family` per sampled text node in `<viewport>.styles.json`, read by `collectPaintedFamilies`; the manifest gains no key, because its page key set is pinned (E8) by `page-manifest-unchanged-except-generated-at`.
- [x] **1.4 A test font made at test time (decision A7).** A small TrueType
      writer under `tests/` builds a face with a handful of rectangle glyphs at
      weight 400 in memory; no font file is committed and nothing is downloaded.
      Three fixtures served through intercepted routes read `loaded`, `error`
      (a 404) and `synthesised` (700 requested of the 400-only face), and a
      fourth with a 2,000 ms delay pins that `load` waited. They run in the
      existing `svg-witness-tests` job (`.github/workflows/tests.yml:543`) on
      ubuntu and macOS.
      verify: `npx vitest run tests/cli/ui_render_asset_font_state.test.ts --reporter=verbose` -> /✓.*load-waited-for-delayed-face/
      Done 2026-10-17: `tests/_lib/test_truetype_face.ts`; the two suites reach the `svg-witness-tests` job through an import in `ui_render_asset_profile.test.ts` (no workflow edit) and join `BROWSER_SUITES` in `vitest.config.ts`, so the verify lines of 1.1-1.4 run with `AGENT_CONFIG_BROWSER_SUITES=1`, as the asset profile suite does. Seen red: with the error, synthesis and wait branches neutralised, three cases failed. Checked 2026-10-18 for AC-1: `SVG Witness Tests` on ubuntu-latest and macos-latest passed on PR #2430 (run 38987233705), and both job logs carry the font-state cases.

## Phase 2 — Two delivery tells under the delivery owner

- [x] **2.1 T11 faux styles.** A row in `design-antipatterns.md` § Typography:
      bold or italic requested of a family that lacks the face; remedy is to
      load the face or set `font-synthesis: none` on purpose. Detector:
      witness-backed through 1.2, with a fixture.
      verify: `grep -c "^| T11 " docs/guidelines/design-antipatterns.md` -> /^1$/
      Done 2026-10-17: row T11; status `witness`, a sixth status the parity lint now checks against the witness source (the note must name `geometry/font-synthesised`, and that rule must exist there).
- [x] **2.2 T12 swap without a metric-matched fallback.** A self-hosted webfont
      with `font-display: swap` and no fallback `@font-face` carrying
      `size-adjust`, `ascent-override` and `descent-override`. Detector: static
      CSS parse in `design_slop_rules.ts`, with a positive and a near-miss
      fixture. The derivation of the overrides from the font's vertical metrics
      lands as a mechanics row in `design-asset-discipline.md`.
      verify: `npx vitest run tests/scripts/design_slop_t12.test.ts` -> 0
      Done 2026-10-17: `slop-t12-swap-without-metric-fallback` (P3), a size-adjust-only near miss pinned; the derivation is a bullet in `design-asset-discipline.md`.
- [x] **2.3 Mechanics rows, no tells.** In `design-asset-discipline.md`:
      `unicode-range` subsetting for self-hosted files and `preload` for the one
      above-the-fold face. In `typography-system`: `tabular-nums` for aligned
      figures, `opsz` for optical-size families.
      verify: `grep -c "unicode-range" docs/guidelines/design-asset-discipline.md` -> /^[1-9]/
      Done 2026-10-16: subsetting + preload bullet in design-asset-discipline; tabular-nums + opsz in typography-system (step 3 points at `references/worked-scales.md`, which carries them).
- [x] **2.4 Parity holds.** The detector-status table lists T11 and T12 with
      their status, and no row reads backed without a test.
      verify: `./scripts-run src/scripts/lint_design_antipattern_parity` -> 0
      Done 2026-10-17: T11 `witness`, T12 `backed`; parity green, 52 entries.

## Phase 3 — The SVG tooling learns fill rule and counters

- [x] **3.1 `svg-authoring` states the counter rule.** In § Trace to measure,
      construct to deliver: a shape with counters (o, e, a, B, 8, an O-ring
      mark) declares its fill rule, outer and inner contours wind in opposite
      directions, and overlap removal runs only after both are settled.
      verify: `grep -ci "fill-rule" src/skills/svg-authoring/SKILL.md` -> /^[1-9]/
      Done 2026-10-16: counter rule in § Trace to measure step 2.
- [x] **3.2 An advisory finding, measured before it gates (decision A8).**
      `svg-structure-filled-counter` in `src/scripts/_lib/svg_rules.ts`: a
      `path` under `nonzero` whose subpath sits inside another subpath with
      the same winding. Fixtures: the two-circle disc above and its even-odd
      twin, under `tests/fixtures/svg-filled-counter/` <!-- ref-ignore -->
      verify: `npx vitest run tests/scripts/svg_filled_counter.test.ts` -> 0
      Done 2026-10-17: `src/scripts/_lib/svg_filled_counter.ts`, wired into `scanSvg` at `warning`; fixtures add an opposite-winding twin and an inherited `evenodd` twin, each rendered (disc 196,282 px, rings 115,940 px).
- [x] **3.3 False-positive census.** Run the finding over every SVG tracked in
      the repository and record hits and true hits in
      `agents/evidence/analysis/`; the finding stays advisory unless the
      false-positive count is zero.
      verify: `ls agents/evidence/analysis` -> /filled-counter/
      Done 2026-10-17: `filled-counter-census-2026-10-17.md` — 0 hits, 0 false positives over 96 files, but no tracked multi-contour path is under `nonzero`, so the zero is vacuous and the finding stays advisory.

## Phase 4 — The type-design skill: contract and procedure

One skill, `execution: manual`, pack `frontend-design`. The model perceives,
decides and judges; code does every coordinate. The skill bundles no script and
no font; it runs a pinned toolchain in the consumer's environment.

- [x] **4.1 Scope and honest limit.** Two entry paths, one core. Path A starts
      from lettering (raster or SVG, including a wordmark the agent just made
      with `logo-generation` or `image-generation`). Path B starts from a brief.
      The body states that a coherent display or brand family is in reach and
      text-grade optical refinement is a type designer's work.
      verify: `grep -c "type designer" src/skills/type-design/SKILL.md` -> /^[1-9]/
      Done 2026-10-18: § The honest limit.
- [x] **4.2 Rights gate before any trace.** Own or commissioned lettering
      proceeds. Lettering set in an existing typeface is named, and licensing
      that typeface is recommended instead of reconstructing it. A third party's
      mark stops until its owner's rights are stated. An origin the agent cannot
      establish is treated as not owned and asked about.
      verify: `grep -ci "rights gate" src/skills/type-design/SKILL.md` -> /^[1-9]/
      Done 2026-10-18: § Rights gate, five rights classes recorded in the spec's source block.
- [x] **4.3 No default output licence (decision A3).** The skill asks which
      licence the new font carries, records it in the spec and the name table,
      and writes `unknown` when none is given; it never stamps one on its own.
      verify: `grep -ci "license" src/skills/type-design/SKILL.md` -> /^[1-9]/
      Done 2026-10-18: § License — asked, never stamped. The verify spells `license`: lint_canonical_terms gates the tree on that spelling, so the step's original `licence` would have required a new canonical-term violation.
- [x] **4.4 Freehand outlines are not a deliverable.** The model never writes
      path data for a glyph by hand and never ships a freehand SVG glyph; it
      changes spec parameters and lets code rebuild.
      verify: `grep -ci "freehand" src/skills/type-design/SKILL.md` -> /^[1-9]/
      Done 2026-10-18: § No freehand outlines.
- [x] **4.5 `font-spec.yaml`, documented in `references/font-spec.md`.** Units
      per em; baseline, x-height, cap height, ascender, descender; stems
      (lowercase and capitals, vertical and horizontal), contrast, stress angle,
      overshoot, aperture, terminal and serif style; spacing values; coverage
      tier; licence block; source block (path, rights class from 4.2, digest
      of the source image, locked glyphs).
      verify: `grep -c "stress angle" src/skills/type-design/references/font-spec.md` -> /^[1-9]/
      Done 2026-10-18: `references/font-spec.md`.
- [x] **4.6 Path A.** Ingest (SVG parse, or threshold and deskew a raster) →
      code segments and the model labels a numbered contact sheet → trace with
      the fill rule declared (Phase 3) → measure the spec from the traced
      letters → normalise the present letters to it → extend per 4.8. A
      wordmark's one-off tweaks become alternates or ligatures, never the
      default forms, and a signature letter the brief names is a locked glyph
      whose drift fails 5.6. A source below a stated resolution is reported
      as low confidence and cannot reach `validated-static` on fidelity.
      verify: `grep -ci "contact sheet" src/skills/type-design/SKILL.md` -> /^[1-9]/
      Done 2026-10-18: procedure step 2; the low-resolution floor is a stated default (600 px cap height / 1,000 units), labelled as such.
- [x] **4.7 Path B.** Brief → spec with numbers → `n o H O` built → proof
      sheet rendered → the four control glyphs approved by the person asking
      before anything else is built.
      verify: `grep -c "n o H O" src/skills/type-design/SKILL.md` -> /^[1-9]/
      Done 2026-10-18: procedure step 3.
- [x] **4.8 Construction order.** `n o H O` → derivation chains (n to h m u r;
      o to c e b d p q; H to E F I L T; O to C D G Q) → diagonals → free shapes
      (a g s S f t z and the figures) → composites for diacritics through
      anchors, the German set included.
      verify: `grep -ci "derivation chain" src/skills/type-design/SKILL.md` -> /^[1-9]/
      Done 2026-10-18: procedure step 4.
- [x] **4.9 Coverage tiers, defined here (decision A9).** `wordmark` (the
      letters present plus alternates), `latin-basic` (A-Z, a-z, 0-9, basic
      punctuation, space, `.notdef`), `latin-de` (adds the umlauts, both forms
      of sharp s and the German quotation marks). The tier is written into the
      spec and the QA report, and nothing claims a tier it does not cover.
      verify: `grep -c "latin-de" src/skills/type-design/references/font-spec.md` -> /^[1-9]/
      Done 2026-10-18: § Coverage tiers in `references/font-spec.md`.
- [x] **4.10 Toolchain manifest.** A pip-installable outline library, a path
      boolean library, a UFO library, a font compiler, a shaping binding and a
      raster tracer, each pinned to an exact version in
      `references/toolchain.md` and taken through `supply-chain-intake` before
      the skill names it. Bumped by pull request, never floating.
      verify: `grep -cE "==[0-9]" src/skills/type-design/references/toolchain.md` -> /^[1-9]/
      Done 2026-10-18: six exact pins, each the newest release at least two weeks old, with an intake record (registry JSON, publish date, downloads, OSV: no advisory). The raster tracer is MIT (`vtracer`); the GPL candidates were rejected per the non-goal.
- [x] **4.11 Outputs land in the consumer tree.** UFO source, `font-spec.yaml`,
      built `woff2` and `ttf`, the proof page and the QA report, at the location
      `design-system-capture` conventions give; never inside the package. The
      QA report carries one maturity label — `concept`, `prototype` or
      `validated-static` (every Phase 5 gate green) — and never a claim the run
      cannot show.
      verify: `grep -c "design-system-capture" src/skills/type-design/SKILL.md` -> /^[1-9]/
      Done 2026-10-18: § Outputs and § Maturity; `design-system-capture` is where the family is recorded.
- [x] **4.12 The skill lands within the payload ceiling (decision A1).** The
      change that adds `src/skills/type-design/SKILL.md` carries a reduction of
      at least the new catalogue entry's tokens elsewhere in the preamble
      payload, and an `estate_growth_exempt` claim naming why no existing skill
      can carry the capability.
      verify: `./scripts-run src/scripts/check_preamble_payload_budget` -> 0
      Done 2026-10-18: 135,880 tok against the 135,907 ceiling (net -27). The reduction is two See-also bullets that repeated a link the same rule's "Body migrated to" line already carries (`context-hygiene`, `roadmap-ci-steps-policy`) — duplicates, so no load-bearing line was cut and A1's fallback did not fire. The estate claim is the amended `estate_growth_exempt` above.
- [x] **4.13 Trigger evals.** At least 5 should-trigger and 5 should-not
      queries, the latter naming the neighbours: choosing a font
      (`typography-system`), making a logo (`logo-generation`), tracing an icon
      (`svg-authoring`), an icon font (`iconography`).
      verify: `./scripts-run src/scripts/lint_new_skill_gate` -> 0
      Done 2026-10-18: `evals/triggers.json`, 6 exemplars, 5 near-misses naming the four neighbours and 1 counterexample; the gate cleared it against origin/main.
- [x] **4.14 Route it in.** `logo-generation`, `brand-identity` and
      `svg-authoring` hand "the rest of the alphabet / make this a font" to
      `type-design`. `typography-system` gains a `custom` source beside its CSV
      pairing path (spec path, licence, fallback overrides),
      and T7 is satisfied by a stated custom family. `design-system-capture`
      records a custom family with its source and licence; `bundled_local`
      stays a flag. The neighbours' trigger evals stay green.
      verify: `grep -c "type-design" src/skills/logo-generation/SKILL.md` -> /^[1-9]/
      Done 2026-10-18: logo-generation, svg-authoring and brand-identity hand off by name; typography-system § Custom source; `design-system-json.md` records a `custom` block beside `bundled_local`.

## Phase 5 — Gates, proof and the benchmark

Each gate is a peer-side command in the skill's procedure with a threshold and a
failure message the agent can act on.

- [x] **5.1 Outline hygiene, in `references/gates.md`.** Every contour closed; counters per glyph equal an
      expected table (o 1, e 1, a 1, B 2, 8 2, g 1 or 2); points at extrema; no
      contour under the size threshold; direction correct for the outline
      format; fill rule declared before overlap removal.
      verify: `grep -ci "counters per glyph" src/skills/type-design/references/gates.md` -> /^[1-9]/
      Done 2026-10-18: `references/gates.md` § 1, coverage included.
- [x] **5.2 Vertical metrics.** Typo and hhea agree, both line gaps 0,
      `USE_TYPO_METRICS` set, win values cover the family's extremes.
      verify: `grep -c "USE_TYPO_METRICS" src/skills/type-design/references/gates.md` -> /^[1-9]/
      Done 2026-10-18: gates § 2.
- [x] **5.3 System consistency.** Stems by ray-cast at half x-height across
      n h m u l i within 3 %; overshoot 1 to 3 % on o O e c s; ink area per
      glyph group within a stated band.
      verify: `grep -ci "ray-cast" src/skills/type-design/references/gates.md` -> /^[1-9]/
      Done 2026-10-18: gates § 3; thresholds labelled stated defaults the benchmark may move.
- [x] **5.4 Spacing before kerning.** Sidebearings from edge classes (straight,
      round, diagonal) set on H, n, O, o first; kerning classes from edge groups
      only afterwards; a collision check on the kerning strings; `kern`,
      `mark`, `liga` and, where figures exist, `tnum` built; shaping confirms the features apply.
      verify: `grep -ci "sidebearing" src/skills/type-design/references/gates.md` -> /^[1-9]/
      Done 2026-10-18: gates § 4.
- [x] **5.5 Rendered proof through the existing witness (decision A7).** A
      generated host page whose specimens are SVG text elements: waterfall 12 to
      72 px, `HHOHH nnonn`, every letter between n and n and between o and o,
      the kerning strings, the wordmark text. `ui:render --profile asset` must
      read `loaded` for the new family, never `error` or `synthesised`; the
      agent opens the PNG and states what it saw. A failing gate gets at most
      three repair rounds; after that the QA report names the gate and the
      label stays below `validated-static`.
      verify: `grep -c "profile asset" src/skills/type-design/SKILL.md` -> /^[1-9]/
      Done 2026-10-18: procedure steps 7 and 10, gates § 5.
- [x] **5.6 Source fidelity, path A.** The wordmark text set in the new font,
      aligned by baseline and cap height, compared with the source by
      silhouette IoU with the method `svg-authoring` already uses: 0.90 per
      glyph, 0.85 per word, and a locked signature glyph at 0.95. The diff
      overlay is produced and looked at.
      verify: `grep -c "0.95" src/skills/type-design/references/gates.md` -> /^[1-9]/
      Done 2026-10-18: gates § 6.
- [x] **5.7 Metric-matched fallback.** The skill emits the fallback
      `@font-face` overrides for the new family, which is what T12 asks for.
      verify: `grep -c "size-adjust" src/skills/type-design/references/gates.md` -> /^[1-9]/
      Done 2026-10-18: gates § 7, deriving from the `design-asset-discipline` bullet rather than restating it.
- [x] **5.8 Pre-registered reconstruction benchmark — committed fixtures, per
      the council's (a) of 2026-10-16.** Held-out real families live under
      `tests/fixtures/fonts/` <!-- ref-ignore -->, each with its licence text
      beside it and recorded in `docs/THIRD-PARTY-NOTICES.md`, outside the
      `files` list in `package.json`. The harness renders a 5- to 7-letter word
      from each, gives the skill **only that image** — never a fixture name, a
      path or any metadata, which committing the set makes easier to leak by
      accident than fetching it would have — asks for `latin-basic`, and
      compares the held-out glyphs with the real family by per-glyph IoU, stem
      deviation, sidebearing deviation and gate pass rate. Thresholds frozen
      before the first run; a null is a valid result; the grader never sees the
      generating session's notes. Raw measurements, the frozen thresholds and
      the fixture identities are retained beside the verdict. A claim enters
      `docs/CLAIMS.md` only from this run.
      verify: the rendered proof exists for each family; a fixture's name does not appear in the input handed to the skill; the measurements and thresholds are committed with the verdict.
      Done 2026-10-19: verdict **`partial`** — one family of three passes (geometric sans, M1 0.752 against 0.75); the serif (M1 0.672, M3 24.3) and the humanist sans (M1 0.715) do not. No claim enters `docs/CLAIMS.md`. Thresholds and grader frozen in `1ba3ec047` before any run and unchanged; generating subagents saw only `lettering.png` and the brief (leak grep 0 hits); the orchestrator graded. Record: `internal/bench/type-reconstruction/run-2026-10-19/VERDICT.md`, raw `grade.json`, input and proof PNGs per run; generated fonts by SHA-256.
- [x] **5.9 The published archive carries no typeface binary.** The lock's one
      bright line, verified against the produced archive rather than against the
      configuration that is supposed to produce it. The check also covers
      release archives, container build contexts and provenance bundles, because
      an exclusion from `package.json#files` is necessary and not sufficient.
      verify: the produced tarball carries no typeface binary and no fixture path — `npm pack --dry-run | grep -cE '[.](ttf|otf|woff2?|ttc)$'` -> /^0$/
      Done 2026-10-19: lands with the three committed fixtures, so the zero is not vacuous. `tests/scripts/typeface_fixture_bound.test.ts` reads the produced npm tarball, the produced `git archive` (release and Packagist), every Dockerfile's `COPY`/`ADD` and `.dockerignore`; the verify reads 0 against three tracked `.ttf` files.
- [x] **5.10 The fixture carve-out states its own bound.** The amendment covers
      typeface families for this benchmark and nothing else: a later family
      joins by an explicit decision, never drive-by, and "openly licensed" means
      an OSI-approved SPDX identifier. Without the bound, "non-shipped binary
      fixtures" becomes a category that drifts into audio samples and image
      sets.
      verify: the bound and the SPDX restriction are written where the fixtures live, and a family carrying a non-OSI identifier is refused by the same check as 5.9
      Done 2026-10-19: `tests/fixtures/fonts/README.md` § The bound states the four limits; `fixtures.json` names the admitting decision per family; the 5.9 test refuses a non-OSI identifier and a typeface binary with no admitting entry.

## Phase 6 — Third-party registry items are audited before `add`

- [x] **6.1 Route the item through intake.** `react-shadcn-ui/references/registry.md`
      § CLI verbs: a namespaced or third-party item goes through
      `supply-chain-intake` before `add`, with a checklist (network calls,
      environment reads, `eval` or dynamic import, install scripts) and a
      `diff` after `add`. One should-trigger eval for the route.
      verify: `grep -c "supply-chain-intake" src/skills/react-shadcn-ui/references/registry.md` -> /^[1-9]/
      Done 2026-10-16: intake checklist + `diff` after `add` in registry.md; eval rsu-e7.

## Decisions

| ID | ownership | resolved by | decision | evidence | revisit if |
|---|---|---|---|---|---|
| A1 | reversible-technical | evidence | A new skill `type-design`, landed only with a same-change payload reduction and an estate claim | the transcript asks for a skill by name; the measured ceiling is zero net growth; `skill_count` takes the claim path; a reference under `svg-authoring` would bury a twelve-step pipeline behind a one-asset trigger | no reduction of the needed size can be found without cutting a load-bearing line, then the capability lands as `svg-authoring/references/type-design.md` |
| A2 | reversible-technical | evidence | The toolchain runs peer-side and pinned; no TypeScript port of a font compiler | `no-python-in-src.yml`; `markitdown/SKILL.md:67-78` precedent | a maintained TypeScript compiler reaches parity on the Phase 5 gates |
| A3 | reversible-technical | evidence | No default output licence; the skill asks and records `unknown` otherwise | `svg-authoring/SKILL.md:245-248` reports an unknown licence as unknown; a default licence would be a commitment made for the person asking | a project configures its own default licence in its settings |
| A4 | reversible-technical | evidence | Six worked scales land as a reference file; the per-pairing line-height claim is dropped | a per-pairing line-height column would contradict the single authority 0.1 creates | a measured case where one pairing needs its own line-height |
| A5 | reversible-technical | evidence | The page witness gets no blanket font wait; a bounded wait runs only on a face still loading | reproduction: a used face delayed 2,000 ms held `load` until 2,019 ms | WebKit or a script-injected face reproduces the flake |
| A6 | reversible-technical | evidence | No weight-count tell | `road-to-design-craft-antislop` deferred font-weight-count as a design-system opinion; `lint_design_quality.ts:21-25` keeps it out; its revisit condition (a measured false-positive rate in real use) has not fired | that measurement exists |
| A7 | reversible-technical | evidence | Witness fixtures use a TrueType face built in memory at test time; the proof page uses SVG `<text>` | no tracked font binary exists; the asset profile already reads `<text>` (`uiRenderAsset.ts:813-821`) | **FIRED 2026-10-16** — the council ruled exactly this, see A11. The witness fixtures themselves are unchanged: A11 admits typeface binaries for the **benchmark** only, and an in-memory face remains the right shape for a unit test |
| A8 | reversible-technical | evidence | The filled-counter finding starts advisory | a check proposed for enforcement needs a measured false-positive rate first; 3.3 measures it | 3.3 records zero false positives |
| A9 | reversible-technical | agent | Coverage tiers are defined by this roadmap, not copied from an external glyph-set definition | own analysis: the German set is the stated need of the source | a project needs a script beyond Latin |
| A10 | reversible-technical | agent | The skill is named `type-design` | neighbour names describe the activity (`typography-system`, `svg-authoring`) | the name collides in the trigger corpus |
| A11 | contested-technical | council:agents/evidence/council/benchmark-fixture-fonts-20261016.md | **(a) — the 2026-06-28 no-typeface-bundler lock binds published artefacts, not the repository.** The benchmark commits openly licensed families with their licence texts under `tests/fixtures/fonts/` <!-- ref-ignore -->, outside `package.json#files`. Stated as an **amendment**, never as a reinterpretation, and bounded to typeface fixtures for this benchmark | AI council, 2026-10-16, members `anthropic` + `openai`, prompt mode, 2 rounds, 2/2 concluded, no split, $0.00 (subscription transport) — **against this roadmap's own recommendation of (b)**, which is why the round was run. The deciding principle: this is the only run allowed to put a reconstruction claim into `docs/CLAIMS.md`, and a first-class claim should be re-derivable from the tree; a checksum authenticates a retrieved file but cannot make an unavailable one retrievable. No tracked record of the 2026-06-28 lock exists, so `agents/evidence/council/benchmark-fixture-fonts-20261016.md` is where the amendment lives | a typeface binary is found in any published artefact · licence review of the fixture set becomes a recurring chore · the exception is cited to admit a binary class other than typeface fixtures for this benchmark |

## Non-goals

No font binary in any published artefact and no font fetcher in the package — the fixtures 5.8 commits are repository-only and 5.9 verifies the produced archive carries none of them. No Python under `src/`. No
hook concern and no turn-end obligation for fonts. No variable font, second
master or interpolated weight. No machine-learning glyph generator. No
weight-count tell. No moodboard, inspiration or font-browsing adapter. No editor
GUI. No tool that downloads commercial fonts. No flat banned-font list (T7 stays
register-scoped). No paid or platform-bound font editor as a required path. No
GPL system package as the default builder. No text copied from any external
skill.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-10-16 | reviewer: claude-opus -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | A plausible font that is not a system | product | Glyphs that each look fine and do not share stems, overshoot or spacing pass a visual glance | 5.1 to 5.4 measure the system; 5.5 makes the agent look at the proof | Phase 5 — Gates, proof and the benchmark |
| 2 | Cloning a licensed typeface | product | A wordmark set in a commercial typeface is traced into a new font | 4.2 runs before any trace and an unknown origin is treated as not owned | Phase 4 — The type-design skill: contract and procedure |
| 3 | The signature letter drifts | product | The letter that makes the wordmark recognisable is normalised away | 4.6 locks it and 5.6 fails it below 0.95 IoU | Phase 4 — The type-design skill: contract and procedure |
| 4 | The skill cannot land under the ceiling | implementation | No reduction of the needed size is found in the same change | decision A1 names the fallback to a reference file | Phase 4 — The type-design skill: contract and procedure |
| 5 | The new finding fires on clean SVG | implementation | Nested same-winding subpaths that are meant to overlap read as filled counters | 3.3 measures it over the tracked SVGs before it can gate | Phase 3 — The SVG tooling learns fill rule and counters |
| 6 | The face state flakes across hosts | implementation | macOS and ubuntu disagree on `loaded` for the in-memory face | 1.4 runs on both and the timeout is its own state | Phase 1 — The witness says which face painted |
| 7 | One value returns in a third carrier | implementation | A later edit restates body line-height elsewhere | the drift test in 0.6 reads every carrier | Phase 0 — Typography truth |
| 8 | The fixture carve-out drifts | product | A committed binary class, once admitted, is the path of least resistance for the next one — audio samples for a transcription benchmark, image sets for a vision test — and licence review of a growing fixture set becomes a recurring chore nobody owns | 5.10 bounds the amendment to typeface families for this benchmark, restricts "openly licensed" to OSI-approved SPDX identifiers and requires an explicit decision per addition; A11's revisit-if fires on the chore, not on a family count or a megabyte figure, both of which were floated in the council round and rejected as unsupported | Phase 5 — Gates, proof and the benchmark |

## Blockers

### blocker: benchmark-fixture-fonts
- **Status:** resolved — (a), AI council 2026-10-16, 2/2 concluded, no split, so
  it never reached the maintainer. The verdict runs **against this roadmap's
  written recommendation of (b)**; 5.8 is rewritten and 5.9 / 5.10 carry the
  bound the council made it conditional on. Record:
  `agents/evidence/council/benchmark-fixture-fonts-20261016.md`, which is also
  where the lock's amendment lives — no tracked record of the 2026-06-28 lock
  exists to amend.
- **Owner:** council (maintainer if the council splits — it did not split)
- **Blocks:** 5.8 and AC-6.
- **What to do:** pick exactly one — (a) the council rules that the 2026-06-28
  no-font-bundler lock covers shipped artefacts only, and the benchmark commits
  a small set of openly licensed families with their licence texts under
  `tests/fixtures/fonts/` <!-- ref-ignore --> (outside the `files` list in
  `package.json`), recorded in `docs/THIRD-PARTY-NOTICES.md`; or (b) the council
  rules that the lock covers the repository, and the benchmark is a
  maintainer-run harness that fetches pinned families by checksum into
  `agents/runtime/tmp/` at run time and commits only the recorded verdict under
  `agents/evidence/analysis/`.
- **Resolved when:** a council record under `agents/evidence/council/` names
  (a) or (b) and 5.8 is rewritten to the chosen option.
- **Recommendation:** (b) — it keeps the lock literal, ships nothing and leaves
  only the verdict in the tree.
- **If you do nothing:** the capability ships with its gates but no measured
  quality figure, and no claim about generated type may enter `docs/CLAIMS.md`.

## Acceptance Criteria

- [x] AC-0 — Body line-height and the control font-size floor have one value
      each across the carriers, the drift test was seen red first, and
      `typography-system` claims only content it carries.
- [x] AC-1 — The asset witness reports `loaded`, `error` and `synthesised` for
      the three in-memory fixtures on ubuntu and macOS, and the page profile
      reports a painted family beside the declared one.
- [x] AC-2 — T11 and T12 sit in the catalogue with fixtures, and the parity
      lint is green.
- [x] AC-3 — `svg-structure-filled-counter` flags the two-circle disc and not
      its even-odd twin, and its false-positive count over the tracked SVGs is
      recorded.
- [x] AC-4 — `type-design` passes the new-skill gate, the payload ceiling holds
      in the change that adds it, and the rights gate, the licence question and
      the no-freehand rule are in its body.
- [x] AC-5 — A path A run on a wordmark produces a font whose proof page reads
      `loaded` in the witness and whose locked glyph clears the fidelity
      threshold, and a path B run from a brief produces a font whose four
      control glyphs were approved before the rest was built; both QA reports
      name the coverage tier and the maturity label.
      Done 2026-10-19: `agents/evidence/analysis/type-design-path-runs-20261019.md` — locked `M` 0.9992, proof `loaded` 27/27 with this branch's CLI; path B controls witnessed before the build, approved by the commissioning session, not a human.
- [x] AC-6 — The reconstruction benchmark has run once with frozen thresholds,
      and its verdict is recorded, a null included.
      Done 2026-10-19: `partial`, `internal/bench/type-reconstruction/run-2026-10-19/VERDICT.md`.
- [x] AC-7 — A third-party registry item is routed through
      `supply-chain-intake` before `add`.
