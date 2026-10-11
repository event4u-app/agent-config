---
complexity: structural
status: ready
execution:
  mode: phase-checkpoints
capability_gap: hand-authored-svg-has-no-witness
relates:
  - slug: road-to-svg-in-the-authorities
    relation: disjoint
    note: "Same source set. The prose half — SVG mechanism lines in § Motion, two ARIA rows, one render-security row — lands there and does not wait for this fixture; this roadmap's owner skill points at those lines instead of restating them."
  - slug: road-to-design-mechanism-harvest
    relation: supersedes
    note: "In part only. Archived. Its Phase 2 shipped the three geometric pre-checks as author self-checks verified only by the skill linter (a recorded choice, not an oversight). Phase 2 here gives them a witness and Phase 3 moves them to the owner; its council rejection of vendored easing, palette and grid tables stays in force (Non-goals)."
  - slug: road-to-frontend-design-intelligence
    relation: disjoint
    note: "Archived. Its Step 7.3 (port a generative SVG-icon/logo asset corpus) was cancelled on the domain-adoption gates. Mechanism-match fails: this roadmap verifies SVG an agent already writes on six existing lanes, it ports no asset corpus and opens no domain."
estate_offset_exempt: "Adds one active roadmap with nothing to offset: none of the twenty top-level roadmaps owns a design, frontend or asset surface, so folding this into one would misfile it, and parking an unrelated roadmap would misstate it as blocked. The gap is reproduced, not asserted: an infinite SMIL animation with no reduced-motion branch reads clean under lint_design_quality today, and an .svg write is not a UI surface."
---
# Road to SVG with a witness

> **Source:** `agents/tmp.old/inbox-2026-10-l/` — a maintainer transcript (one
> user turn: analyse the suite and four external SVG-skill sources in depth,
> plan a roadmap, challenge it in three loops) plus the two three-loop plans it
> produced on two hosts, a planted-defect evidence bundle and a probe
> prototype. Both plans were pinned at `main@d41121927`; every line reference
> below was re-read at `main@9a4dbb753`, and every engine reading was
> re-run offline (`file://` only, every other request aborted) on Chromium 151
> through the repo's own Playwright devDependency.

## Goal

When an agent writes an SVG by hand — a missing glyph, a geometric mark, an
illustration, a diagram, an animated asset — something other than the agent's
own belief checks it. One owner holds the procedure; a dependency-free static
check reads the defect classes visible in source (including "this is a raster
wrapped in a vector file" and "this edit touched geometry it was not allowed
to touch"); a browser witness reads the classes that only exist once rendered,
at a declared moment of an animation; a host without a browser says
`static-only` instead of passing; and the routing that today ends in a dry-run
plan ends in an asset. Not the goal: generating more SVG, a drawn-asset corpus,
a model judge, or a second motion authority.

## Context — defects confirmed at `main@9a4dbb753`

The tree's posture on SVG is restrictive and correct — use the incumbent icon
set (`src/skills/iconography/SKILL.md:102-105`), never fake a logo. What it
lacks is the other half: the six lanes on which hand-authoring is legitimate
have no procedure and no check beyond "verify".

| # | Defect | Evidence |
|---|---|---|
| D1 | Six lanes produce hand-authored SVG; none has an authoring procedure or a check | `iconography/SKILL.md:102-105` (missing glyph, "matches the set's grid + stroke"); `logo-generation/SKILL.md:43-44` (LLM-authored SVG for geometric marks); `docs/guidelines/design-antipatterns.md:117` (V5 exception: illustrative section); `design-intelligence/references/integration-mapping.md:65-74` (diagrams); `canvas-design/SKILL.md:76` (SVG as execution tool); `wireframe/SKILL.md:80-81` (SVG canvas) |
| D2 | The only routed SVG path ends in a plan, not an asset, while the icon floor sends icons to the set | `image-provider-routing/SKILL.md:40` routes "Vector / SVG logo or icon" to an adapter whose header says `experimental — scaffold tier. dry-run plumbing only` (`src/scripts/ai-image/adapters/recraft.sh:14`, live calls die at `:39`) |
| D3 | The logo vector check is presence-of-`<path>`: false green and false red at once | `logo-generation/SKILL.md:53-55`, `:80-82`. A raster embedded beside one dummy path passes; a mark built from `rect`/`circle` — the "simple geometric mark" `:44` recommends — fails |
| D4 | The diagram pre-checks are self-checks with no witness | `integration-mapping.md:65-74`; reproduced R1 below: a published "known-good" example violates exactly the viewBox rule they state |
| D5 | The render primitive is page-shaped | `src/cli/commands/uiRender.ts:41-46` fixes 1440/375/320 page viewports; `:172` waits for `load`, `:175` takes one full-page screenshot. No asset sizes, no background variants, no time control, no geometry |
| D6 | Verification has no time axis | `docs/contracts/design-artifact-verification.md:47-60` lists 14 primitives; none seeks an animation to a declared time (R6) |
| D7 | The reduced-motion lint is blind to SMIL and to `.svg` | `src/scripts/lint_design_quality.ts:97-112` matches only `@keyframes`/`animation:`; `:275` walks `html|htm|css|scss|sass|less|vue|svelte|astro` (reproduced below) |
| D8 | Where DQ4 passes, SMIL can still run | a page-level `svg * { animation: none !important }` under emulated `reduce` leaves an `<animate>` moving (R4); `fe-design/references/design-patterns.md:181`'s requirement is unmeetable that way |
| D9 | The design pass never fires on an `.svg` write | `src/scripts/_lib/ui_surface.ts:20-32` — `UI_EXTENSIONS` has no `svg`; `isUiPath('a/logo.svg')` → `false`. Read by `design_pass_hook.ts` and `ui_route_nudge_hook.ts` |
| D10 | Stale reference inside the render command | `uiRender.ts:26` cites `package.json:97` for the Playwright devDependency; it is at `package.json:111` |

### Reproduction at `main@9a4dbb753` (Phase 4b of the inbox run)

| # | Step from the source | How it was reproduced | Verdict | Observed |
|---|---|---|---|---|
| R1 | A published example violates its own bounds rule | engine bbox over the planted copy | reproduced | viewBox 600×200, content x 20–460, y 70–130 → 140 units empty right, 70 below; `<text>` resolves to `Times` |
| R2 | `transform-origin: center` without `transform-box` mis-pivots | bbox of twin rects scaled 0.5 | reproduced | without the box (60,60); with `fill-box` (130,30) |
| R3 | `keySplines` outside [0,1] stops the animation | `cx` after 1.5 s | reproduced | in-range twin 180; `0.34 1.56 0.64 1` still at 20 |
| R4 | A CSS kill switch does not stop SMIL | emulated `reduce`, `svg * {animation:none!important}` | reproduced | `cx` 20.2 → 76.8 in 700 ms |
| R5 | `<img>`-delivered SVG ignores the emulated preference | frame diff, inline vs `<img>`, internal CSS gated on `no-preference` | reproduced | inline stops under `reduce`, the `<img>` copy keeps animating; `<picture><source media="(prefers-reduced-motion: reduce)">` selects the static file |
| R6 | `screenshot({animations:'disabled'})` does not freeze SMIL | three captures 300 ms apart | reproduced | `cx` 21.3 → 46.3 → 70.9; `pauseAnimations()` + `setCurrentTime(1)` holds 100 → 100 |
| R7 | A generic `id="title"` in two inline graphics names both after the first | aria snapshot | reproduced | `img "Revenue chart"` twice |
| R8 | Guessed dash lengths draw nothing for part of the duration | `getTotalLength()` | reproduced | 300 dashed on a 214.65 path; 50 on a 32.53 checkmark |
| R9 | A prototype static check catches the planted set | the prototype's static half, run offline over 13 planted files | **diverged** | the origin rule is file-scoped, so a file whose *twin* element carries `transform-box` hides the planted defect beside it; the guessed-dash rule fires on an intentional spinner pattern |
| R10 | DQ4 reads SMIL as clean | `lint_design_quality --dir` on an HTML file with only an infinite `<animate>` | reproduced | "clean — 1 file(s) checked"; the CSS control (`@keyframes` without the media query) reds as `dq4-reduced-motion`; a directory of `.svg` → "scanned 0", exit 1 |
| R11 | A meaningful graphic has no ARIA pattern | `ground search` over the a11y corpus for "meaningful standalone svg chart graphic accessible name" | reproduced | the only hit is "Icon-only button" (`aria-hidden=true`) at confidence 0.748 — the opposite of the right answer |

Not reproduced here: the non-browser rasteriser divergence on `transform-box`
(the rasteriser is not installed and installing one is out of bound) and the
prototype's two engine false positives (the 24-grid icon file is not in the
bundle) — both carried as unverified, and Phase 1's rule design does not rest on
them. R9 is the correction this roadmap carries:
`corrected-from-reproduction` — every motion rule in 1.1 binds per element or
per selector, never per file.

## Phase 0 — The fixture, and what today's instruments read on it

- [ ] **0.1 Commit a planted-defect fixture.** Under
      `tests/design-artifacts/fixtures/svg-assets/` <!-- ref-ignore -->
      one file per planted defect and a clean twin differing by exactly one
      edit, tagged by asset class (`icon`, `mark`, `illustration`, `diagram`,
      `animated`), delivery mode (`inline`, `img`, `css-bg`) and layer
      (`static` or `engine`). The set: loose viewBox; element outside the
      viewBox; text overflowing its box; default-serif fallback; generic id
      collision across two inline graphics; meaningful graphic without a name;
      `aria-label` plus `<title>`; `keySplines` out of range;
      `transform-origin` without `transform-box` **with a correct twin
      element in the same file** (R9); animation without a reduced-motion
      branch; SMIL whose only reduced-motion branch is CSS; guessed dash
      length; active content (`<script>`, `on*`, `foreignObject`,
      `javascript:` href); a DOCTYPE or entity declaration; a missing `xmlns`;
      unparseable path data; an unused `<defs>` entry; an `<animate
      attributeName="d">` whose values differ in command count or type; an external
      `href` or `url()`; a dangling `url(#id)` / `<use href="#id">`; a raster
      `<image href="data:image/...">` beside one dummy `<path>` (false
      "true vector"); a mark built only from `rect`/`circle` (must NOT be
      flagged as non-vector); an icon whose stroke or padding is off the
      incumbent set; and three surgical-edit pairs (flat paths, groups with
      transforms, `<use>`/`<symbol>`) where the edit touches one allowed
      element and the planted defect moves a neighbour. A README pre-registers
      every target in 0.3 before any checker exists.
      verify: `npx vitest run tests/design-artifacts/svg_assets_fixture.test.ts --reporter=verbose` -> /✓.*every-planted-file-has-a-one-edit-twin/ <!-- ref-ignore -->
- [ ] **0.2 Record today's detection.** Run `lint_design_quality --dir` over
      the HTML fixtures, `isUiPath` over every fixture path, and the
      `<path>`-presence check `logo-generation` describes over the vector
      fixtures; write the per-row result into the README. Expected from R10
      and D9, not assumed: 0 SMIL rows for the lint, 0 `.svg` paths for the
      predicate, a pass for the raster-with-dummy-path file and a fail for the
      `rect`/`circle` mark.
      verify: the README's baseline table has one row per planted file with
      a non-empty cell per instrument.
- [ ] **0.3 Pre-register the targets.** Static layer: every row tagged
      `static` found, 0 findings on twins. Engine layer: every row tagged
      `engine` found where Playwright resolves, `unverified` otherwise — never
      a pass. Fill-ratio thresholds per asset class, never global.
      verify: the README carries the target table and its commit precedes the
      first commit that adds a checker.

## Phase 1 — Static witness

- [ ] **1.1 `lint_svg_asset.ts`, dependency-free, advisory.** <!-- ref-ignore -->
      Same conventions as `lint_design_quality` (inline-ignore, project
      config, exit 0/2/1, the scanned-nothing refusal). Rule families:
      structure (viewBox, xmlns, dangling `#id` references, unparseable path
      data, unused `<defs>` entries); safety (active
      content, DOCTYPE/entity declarations, external references);
      vector honesty (an embedded raster or `foreignObject` is reported as
      such, and the file is never called a true vector while it carries one;
      `rect`/`circle`/`polygon` count as vector geometry); accessibility (role
      undeclared, meaningful without a name, double name, generic ids);
      motion (`keySplines` range, `transform-origin` without `transform-box`
      **per rule or per element**, no reduced-motion branch, SMIL whose only
      branch is CSS, a `d` morph whose values differ in command count, type
      or order). Draw-on dead time is not a static rule — it moves to
      2.1. `corrected-from-reproduction` (R9).
      verify: `npx vitest run tests/scripts/lint_svg_asset.test.ts --reporter=verbose` -> /✓.*every-static-row-found-and-twins-clean/ <!-- ref-ignore -->
- [ ] **1.2 Preservation readout for a surgical edit.** `lint_svg_asset
      --baseline <before.svg> --allow <id,…>` compares every element outside
      the allowed set after attribute canonicalisation (number formatting,
      attribute order, whitespace) and reports each one that changed, with
      the attribute that changed. No pixel diff decides it — anti-aliasing and
      font metrics would make that a per-machine verdict. This is the witness
      for the surgical-edit discipline `docs/guidelines/design-fidelity-mechanics.md:124`
      already states as prose.
      verify: the three surgical-edit pairs from 0.1 each report exactly the
      moved neighbour, and their clean twins report nothing.
- [ ] **1.3 DQ4 learns the definite case, inline only.** For inline SVG in
      HTML, `lint_design_quality` DQ4 reports SMIL with no reduced-motion route
      and SMIL whose only route is a CSS `animation: none` (R4). Standalone
      `.svg` stays in 1.1: a file cannot see its host's `<picture>` route, and
      flagging it there would break the linter's zero-false-positive header
      (`lint_design_quality.ts:12`).
      verify: `npx vitest run tests/scripts/lint_design_quality_dq4_smil.test.ts --reporter=verbose` -> /✓.*inline-smil-without-route-is-reported/ <!-- ref-ignore -->
- [ ] **1.4 `.svg` becomes a UI surface.** Add `svg` to `UI_EXTENSIONS`
      (`ui_surface.ts:20`) so `design_pass_hook` delivers `lint_svg_asset`
      findings as context. `isUiPath` also feeds `ui_route_nudge_hook.ts`:
      decide in the same change whether an `.svg` write should nudge UI
      routing, and pin the answer with a test either way. No new hook concern.
      verify: `npx vitest run tests/scripts/ui_surface_svg.test.ts --reporter=verbose` -> /✓.*svg-is-a-ui-path/ <!-- ref-ignore -->

## Phase 2 — Engine witness: an asset profile for `ui:render`

- [ ] **2.1 `ui:render <file> --profile asset`.** The page profile and its
      `VIEWPORTS` contract stay untouched. The asset profile renders per class
      (icon at 16/24/48 px; other classes at 1× and 2× intrinsic) on a light
      and a dark background read from the project's tokens, and records:
      every painted element inside the viewBox; fill ratio against the class
      threshold; each `<text>` inside its declared box and its resolved font
      family; unique accessible names across graphics on one page; frames at
      t = 0, mid and end — SMIL via `pauseAnimations()` + `setCurrentTime()`
      (R6), CSS/WAAPI via `document.getAnimations()` and `currentTime`;
      draw-on dead time from `getTotalLength()` against the dash (R8); an
      inline reduced-motion capture. An `img` or background delivery records
      `reduced_motion: not_witnessable` with the R5 reason and checks the host
      for a `<picture>` route instead. Rendering runs with every non-`file:`
      request aborted, so an asset cannot fetch during its own witness.
      The `render` row of `src/domains/engineering-base/design/command.md:35`
      and the `ui:render` synopsis in `src/cli/registry.ts:50` name the
      profile in the same change.
      verify: `npx vitest run tests/cli/ui_render_asset_profile.test.ts --reporter=verbose` -> /✓.*every-engine-row-found-and-twins-clean/ <!-- ref-ignore -->
- [ ] **2.2 The manifest stays readable.** New fields are optional and keyed
      under `profile: asset`; a reader of today's manifest sees what it sees
      today. No second manifest schema.
      verify: the existing page-profile manifest produced before and after the
      change is byte-identical for the same input.
- [ ] **2.3 Absence path unchanged.** No Playwright → `verification:
      unverified`, and the owner (3.1) then reports `static-only`. Playwright
      stays a devDependency; no rasteriser or renderer dependency is added.
      verify: `npx vitest run tests/cli/ui_render_asset_profile.test.ts -t absent-path-reads-unverified --reporter=verbose` -> /✓.*absent-path-reads-unverified/ <!-- ref-ignore -->
      (the case runs the existing render-absent fixture with the asset profile).
- [ ] **2.4 A time point is a primitive.** Add `frame_seek` to
      `design-artifact-verification.md`'s primitive table ("an animation's
      state at a declared time", dependent on `playwright`), and a scope line
      on `media_emulation`: page document only — an image document was
      measured unreachable by emulation (R5).
      verify: `grep -cE '^[|] .frame_seek. [|]' docs/contracts/design-artifact-verification.md` -> /^1$/
- [ ] **2.5 Fix the stale reference** at `uiRender.ts:26` (`package.json:97` →
      the line that holds `@playwright/test`, `:111` today).
      verify: `grep -c 'package.json:97' src/cli/commands/uiRender.ts` -> /^0$/

## Phase 3 — One owner for hand-authored SVG

- [ ] **3.1 Create the `svg-authoring` skill.** <!-- ref-ignore -->
      `packs:` lists every pack a lane sits in — `frontend-design`,
      `ai-image`, `ai-video`, `engineering-base` — and the same diff carries
      `estate_growth_exempt` for `skill_count` +1 and its description tokens
      (both have 0 allowance in `src/config/estate-count-budget.json`).
      Procedure, in order: read the delivery mode (inline, `img`, CSS
      background, deck) because it decides what can animate and how the
      graphic is named; classify the asset; plan concept → layout →
      attributes, primitives before detail; write with the invariants
      (namespaced ids, `<title>`/`<desc>` or `aria-hidden`, colour from tokens
      or `currentColor`, an explicit `font-family` with a fallback the target
      ships); run 1.1; run 2.1; look at the render; fix; stop at a clean
      witness or after three render passes, whichever comes first; report the
      renderer and the checks that ran — `verified`, `static-only` or
      `unverified`, never a visual inspection that did not happen, and name
      only output files it read back from disk. For an
      edit to an existing SVG, 1.2 with the declared allowed ids replaces the
      look-and-compare. Motion, ARIA and render-security mechanism are
      pointers to their authorities, never restated.
      verify: `./scripts-run src/scripts/skill_linter src/skills/svg-authoring/SKILL.md` -> 0 <!-- ref-ignore -->
- [ ] **3.2 Move the diagram pre-checks.** `integration-mapping.md:65-74`
      moves to the owner as witnessed checks (viewBox safety, arrow-through-box
      and label-fits-box map onto 2.1's geometry). The verb routing table and
      the noun-count triage stay and point to the owner.
      verify: `grep -c 'Geometric pre-checks' src/skills/design-intelligence/references/integration-mapping.md` -> /^0$/
- [ ] **3.3 Point the six lanes at it.** One pointer line each, no restated
      rule: `iconography/SKILL.md:102-105` (missing glyph — read the incumbent
      set's grid, stroke and padding from its own SVGs); `logo-generation`
      step 2 and step 5; `canvas-design/SKILL.md:76` when the execution tool
      is SVG; `wireframe/SKILL.md:80-81`; the V5 remediation cell in
      `design-antipatterns.md:117`.
      verify: `grep -l 'svg-authoring' src/skills/iconography/SKILL.md src/skills/logo-generation/SKILL.md src/skills/canvas-design/SKILL.md src/skills/wireframe/SKILL.md docs/guidelines/design-antipatterns.md` -> /iconography.*\n.*logo-generation.*\n.*canvas-design.*\n.*wireframe.*\n.*design-antipatterns/
- [ ] **3.4 Trigger rows.** An `evals/triggers.json` for the owner with
      sibling negatives: icon-set lookup → `iconography`, brand pipeline →
      `logo-generation`, raster → `image-generation`, video motion →
      `motion-choreographer`; positives include "draw an SVG icon the set
      does not have", "animate this logo SVG", "change only the hat in this
      SVG".
      verify: `./scripts-run src/scripts/check_trigger_evals` -> 0

## Phase 4 — Routing that ends in an asset

- [ ] **4.1 Split `image-provider-routing/SKILL.md:40`.** Icon →
      `iconography` (set first) → the owner for a missing glyph; simple
      geometric mark → the owner; complex illustrative vector art → the
      provider, with the adapter's lifecycle stated in the answer. Trigger
      rows of both skills updated in the same diff.
      verify: `./scripts-run src/scripts/check_trigger_evals` -> 0
- [ ] **4.2 Replace the path-presence check.** `logo-generation/SKILL.md:53-55`
      and the good example at `:80-82` use 1.1's vector-honesty family plus the
      witness: a `rect`/`circle` mark stops failing, a raster beside a dummy
      path stops passing.
      verify: `grep -c 'elements before treating it' src/skills/logo-generation/SKILL.md` -> /^0$/

## Phase 5 — Measured outcome

- [ ] **5.1 Re-run the fixture with every layer on** and write the per-row
      table beside 0.2's baseline in the fixture README. Claims in the owner
      skill follow the numbers, not the plan.
      verify: the README carries both tables with identical row sets.

## Decisions

| ID | ownership | resolved by | decision | evidence | revisit if |
|---|---|---|---|---|---|
| E1 | reversible-technical | evidence | Own active roadmap with `estate_offset_exempt` (frontmatter) | none of the twenty top-level roadmaps owns a design, frontend or asset surface | a design-surface roadmap becomes active and this folds into it |
| E2 | reversible-technical | evidence | A new skill, not a reference under `fe-design`. The overlap scan found no skill that holds a hand-authored-SVG procedure; the six lanes sit in four packs (`iconography`, `wireframe`, `design-intelligence` → `frontend-design`; `logo-generation` → `ai-image`; `canvas-design` → `ai-video`; `fe-design` → `engineering-base`), so a reference file is unreachable from two lanes, while `packs:` takes a list (`src/scripts/schemas/skill.schema.json`). The other plan's "skill only if routing fails" condition already holds: D2 | D1, D2; skill schema `packs` is an array | 3.4's trigger evals show the owner never wins against the lanes it serves |
| E3 | reversible-technical | evidence | `frame_seek` is a primitive, not a `screenshot` parameter | `design-artifact-verification.md:62-64`: a state that is not a frame property gets its own primitive | the contract folds its four state primitives back into `screenshot` |
| E4 | reversible-technical | evidence | SMIL delivered as `img`/background requires a host static route (`<picture>` with a reduced-motion source), not a ban | R5: the `<picture>` route was selected under `reduce` | a real OS preference is shown to reach image documents (open: the two instrument paths disagree) |
| E5 | reversible-technical | agent | Every rule here ships advisory. A blocking promotion is a consumer-facing default flip and is not in this roadmap | `lint_design_quality` and the design pass are advisory/default-off today | a later change proposes blocking — that change carries its own owner gate |
| E6 | reversible-technical | evidence | The icon grid is read from the incumbent set's own SVGs, never declared or vendored | `iconography/SKILL.md:95-97`; council rejection of vendored grid tables in archived `road-to-design-mechanism-harvest` § Notes | a consumer's set has no consistent grid to read |
| E7 | reversible-technical | evidence | DQ4's SMIL extension is inline-only | `lint_design_quality.ts:12` (zero false positives on correct implementation); a standalone file cannot see its host route | — |
| E8 | reversible-technical | evidence | No second manifest schema; the asset profile extends today's render manifest under `profile: asset` | one manifest reader already exists (`uiRender.ts`) | a consumer needs an export-format manifest the render manifest cannot express |
| E9 | reversible-technical | evidence | No renderer beyond the existing Playwright devDependency; no capability probe over several rasterisers | R2/R4/R6 are browser behaviours a rasteriser does not have; the absence path already degrades to `unverified` | an export target (PDF, deck) needs a rasteriser witness |

## Non-goals

No model judgement — the agent's own look included — counts as the pass for
geometry; looking stays mandatory for meaning. No vendored easing, palette or
icon-grid tables. No "prefer SMIL for a self-contained asset" default (R4, R5).
No new command or verb — a profile flag on an existing CLI subcommand. No source
text or recipe copied from any external skill. No non-browser rasteriser as the
witness for web-delivered SVG. No optimiser in the write path, and no automatic
id renaming or path simplification on a surgical edit. No global fill-ratio
threshold and no static guessed-dash rule (R9). No new hook concern. No blind
real-task benchmark scored by a model. No export matrix for email, PDF or deck
in this roadmap — those deliveries go through `pdf_render` / `deck_export`
when a demand appears. Mermaid render validation stays out (no rendering defect
was found for it).

## Source crosswalk

The two plans argue in their own ids; each lands here, in
`road-to-svg-in-the-authorities`, or in a one-line decline.

- **Adopted here.** The second plan's D1–D10, D13 (as D10 here), R1–R8, R9 as
  corrected, P1–P14, Phase 0, Phase 1 (as 3.1–3.3), Phase 2, Phase 3, 4.2,
  4.3 (as 1.4), Phase 6, Phase 7, K1–K10, K12, E1–E7, AC-1–AC-4, AC-6,
  AC-7, V3 (as 3.1's claim), V4 (as 0.2). The first plan's true-vector rule
  (embedded raster, `foreignObject`, hybrid never called vector) as 1.1,
  DOCTYPE/entity rejection and external references as 1.1, dangling
  references as 1.1, the "remove one part, keep the rest" golden in three
  variants as 0.1 and 1.2, `verified` / `static-only` / `unverified` as 3.1,
  no network during render as 2.1, its routing evals as 3.4 and 4.1.
- **In `road-to-svg-in-the-authorities`.** The second plan's D8 mechanism
  lines, D10–D12, 4.1, 5.1, 5.2, AC-5, V1, and the first plan's
  sanitise-by-context, CSP and target-dependent motion fallback.
- **Declined.** The first plan's `svg-artifact/v1` manifest — E8. Its renderer
  capability probe and rasteriser adapters — E9. Its optional optimiser
  normalisation — Non-goals. Its 20–30 real-task baseline with a scoring
  rubric and the blind-rated canary — K1: a model-scored baseline is the
  lenient judge the fixture replaces. Its fail-closed rollout — E5. Its
  email/PDF/React/deck target matrix — Non-goals. Its context budget
  "≤ baseline + 2 %" — replaced by the description-token claim in 3.1, which
  is measured, not estimated. Its version-control and review-process lines —
  already governed by `commit-policy`, `non-destructive-by-default` and the
  ratification gate. The second plan's K11 Mermaid line and V5 — Non-goals.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-10-11 | reviewer: claude -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | A witness that reds on clean assets gets switched off | product | A rule that fires on designed padding or an intentional dash pattern trains the agent to ignore the lint, the state the design pass already lived through | One-edit twins with a pre-registered 0-findings target, per-class thresholds, advisory only (E5) | Phase 1 — Static witness |
| 2 | File-scoped rules hide planted defects | implementation | A rule that reads "the file mentions `transform-box`" passes a file whose wrong element sits beside a correct twin (R9 diverged) | 0.1 plants exactly that pair; 1.1 binds motion rules per rule or element | Phase 1 — Static witness |
| 3 | Font metrics differ between machines | implementation | Text-fit and fill-ratio readings move with the resolved font | The resolved family is recorded; an unresolvable declared family degrades the reading to `degraded`, never to pass | Phase 2 — Engine witness: an asset profile for `ui:render` |
| 4 | Widening `isUiPath` changes a second hook | implementation | `ui_route_nudge_hook.ts` reads the same predicate, so `.svg` writes start nudging UI routing as a side effect | 1.4 decides that behaviour explicitly and pins it with a test | Phase 1 — Static witness |
| 5 | The owner grows into a drawn-asset corpus | product | Recipes accrete in the skill until it restates motion, ARIA and security mechanism | 3.1 states procedure and invariants only and points to the authorities; Non-goals forbid vendored tables | Phase 3 — One owner for hand-authored SVG |
| 6 | Skill-count growth is refused at the estate gate | implementation | `skill_count` and description tokens have 0 allowance | 3.1's diff carries the `estate_growth_exempt` claim with its reason | Phase 3 — One owner for hand-authored SVG |

## Acceptance Criteria

- [ ] AC-1 — The fixture holds every planted row from 0.1 with a one-edit
      twin, and its README carried the 0.3 targets before any checker merged.
- [ ] AC-2 — Every `static` row is reported by `lint_svg_asset`, with zero
      findings on twins; a raster beside a dummy path is never reported as a
      true vector and a `rect`/`circle` mark is never reported as non-vector.
- [ ] AC-3 — Every surgical-edit pair reports exactly the moved neighbour and
      nothing on its twin.
- [ ] AC-4 — Every `engine` row is reported by the asset profile where
      Playwright resolves; without it the manifest reads `unverified` and no
      layer reports a pass.
- [ ] AC-5 — An inline SMIL animation with no reduced-motion route, or with
      only a CSS route, is reported by DQ4; an `.svg` path is a UI path.
- [ ] AC-6 — "SVG icon the set lacks" and "simple geometric logo" requests
      route to an asset-producing lane in the trigger corpus; the dry-run
      provider is reached only for illustrative vector art and says so.
- [ ] AC-7 — 5.1's table stands beside 0.2's baseline with identical rows.
