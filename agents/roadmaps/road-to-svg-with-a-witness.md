---
complexity: structural
status: ready
execution:
  mode: phase-checkpoints
capability_gap: hand-authored-svg-has-no-witness
depends: [road-to-svg-in-the-authorities]
relates:
  - slug: road-to-svg-in-the-authorities
    relation: depends
    note: "Phase 3 only. The prose half — SVG mechanism lines in § Motion, two ARIA rows, one render-security row — lands there and does not wait for this fixture; this roadmap's owner skill (3.1) points at those lines, so 3.1 cannot land before they exist. Phases 0-2 and 4-6 do not depend on it."
  - slug: road-to-design-mechanism-harvest
    relation: supersedes
    note: "In part only. Archived. Its Phase 2 shipped the three geometric pre-checks as author self-checks verified only by the skill linter (a recorded choice, not an oversight). Phase 2 here gives them a witness and Phase 3 moves them to the owner; its council rejection of vendored easing, palette and grid tables stays in force (Non-goals)."
  - slug: road-to-frontend-design-intelligence
    relation: disjoint
    note: "Archived. Its Step 7.3 (port a generative SVG-icon/logo asset corpus) was cancelled on the domain-adoption gates. Mechanism-match fails: this roadmap verifies SVG an agent already writes on six existing lanes, it ports no asset corpus and opens no domain."
estate_growth_exempt: "Step 3.1 adds src/skills/svg-authoring/SKILL.md: skill_count +1 and its description tokens, both with 0 allowance in src/config/estate-count-budget.json. The owner is the artefact the whole roadmap exists to produce — six lanes hand-author SVG and none had a procedure — and decision E2 records why it cannot be a reference under any one skill: the lanes sit in three packs and packs: takes a list. The per-spawn preamble payload is paid back in the same change rather than claimed: the four lane descriptions this change already edits are trimmed by more than the new catalogue line costs, measured with check_preamble_payload_budget."
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
>
> **Second source:** an external review of PR #2297 (six improvements, a
> verify-parser defect and five end-to-end task scenarios), a second review of
> the same PR (six must-fix and four minor items, each re-checked against the
> tree before it landed), and a maintainer session converting a raster logo to
> SVG (2026-10-11), read from its transcript and its two artefacts; its file
> was re-rendered offline here.

## Goal

When an agent writes an SVG by hand — a missing glyph, a geometric mark, an
illustration, a diagram, an animated asset — something other than the agent's
own belief checks it. One owner holds the procedure; a dependency-free static
check reads the defect classes visible in source (including "this is a raster
wrapped in a vector file" and "this edit touched geometry it was not allowed
to touch"); a browser witness reads the classes that only exist once rendered,
at a declared moment of an animation; a host without a browser says
`static-only` instead of passing; and the routing that today ends in a dry-run
plan ends in an asset — a file that is delivered, re-opened from disk and
re-rendered, with its status bound to that render. Converting a raster into a
vector is named as its own sub-case with a measured agreement, not a look.
Not the goal: generating more SVG, a drawn-asset corpus,
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
| D8 | Where DQ4 passes, SMIL can still run | a page-level `svg * { animation: none !important }` under emulated `reduce` leaves an `<animate>` moving (R4); `fe-design/references/design-patterns.md:182`'s requirement is unmeetable that way |
| D9 | The design pass reads no SVG rule, and misses an `.svg` outside a UI tree | `src/scripts/hooks/design_pass_hook.ts:132` fires on `isUiPath \|\| isUiTreePath`, so `components/logo.svg` already is a surface while `public/logo.svg` or `assets/logo.svg` is not (`UI_EXTENSIONS` at `src/scripts/_lib/ui_surface.ts:20-32` has no `svg`). Where it fires it scans with `lint_design_slop`'s `scanFile` (`:63`, `:520`), which has 0 SVG rules. `ui_route_nudge_hook.ts:125` reads the same two predicates |
| D10 | Stale reference inside the render command | `uiRender.ts:26` cites `package.json:97` for the Playwright devDependency; it is at `package.json:111` |
| D11 | No asset render counts as verification | `src/scripts/_lib/verification_command.ts:78-93` lists test and type-check binaries; `isVerificationCommand` returns `false` for `xmllint --noout`, `qlmanage -t`, a comparison script and `ui:render` alike (re-run here). A turn that edits an `.svg` can only satisfy the turn-end gate with a syntax check or not at all (S6) |

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
| R12 | The prototype's engine half has two false positives | its loose-viewBox verdict (`fill_ratio < 0.5`) and its guessed-dash regex, re-run offline over the bundle's `fx/s4_recipe_5.svg` and `fx/s4_recipe_3.svg` | reproduced | the 24-grid hamburger reads `fill_ratio` 0.38 — designed padding, flagged loose; the spinner's `stroke-dasharray="90 150"` without `pathLength` fires the guessed-dash rule on an intentional pattern |

Not reproduced here: the non-browser rasteriser divergence on `transform-box`
(the rasteriser is not installed and installing one is out of bound) — carried
as unverified, and Phase 1's rule design does not rest on it. The prototype's
two engine false positives were first recorded as not reproducible; the second
review located both files in the bundle and R12 reproduces them. R9 and R12 are
the corrections this roadmap carries: `corrected-from-reproduction` — every
motion rule in 1.1 binds per element or per selector, never per file; fill
ratio is per class (0.3), and draw-on dead time is an engine reading (2.1),
never a static regex.

### A live conversion session (2026-10-11)

A maintainer asked for the logo at the top of a raster brand sheet "as a real
vector graphic, without the app name, usable at any size". Five user turns:
three rejections, then a pass budget, then acceptance — "perfect", and the
same procedure asked for a second figure (`10:29:29`). The session was read
twice, at `09:41Z` and after the acceptance; rows S1-S8 are the failing half
and are corrected where the later half refines them, S9-S15 are what changed.
Both files were re-rendered here offline in Chromium (`file://`, every other
request aborted) and scored against the source sheet at the best of a
registration search:

| File | Silhouette IoU (saturated regions) | Vector-only / raster-only px | Mean colour error in the overlap (0-255) | Best registration |
|---|---|---|---|---|
| `09:23` state (hand-drawn, overlay-checked) | 0.883 | 9,271 / 6,116 of 131,334 | 24.0 | (316, 57) |
| `09:49` state (pixel-derived, score-driven, accepted) | 0.984 | 395 / 1,619 of 122,441 | 7.8 | (320, 60) — exactly the session's own crop offset |

The session's own score for the accepted file (OS thumbnailer, its own crop)
was mean error 7.83 and 1.20 % of pixels off by more than 40; the independent
browser reading agrees within 0.1, so the result does not depend on the
renderer.

| # | Observation | Evidence |
|---|---|---|
| S1 | The first draft was hand-drawn from a look, then rejected | PNG read `08:33:44`, `logo.svg` written `08:34:39`; the user at `08:43:03`: the hat does not match, fix it "until it matches 100 %". The source raster was put under the vector only in the second pass (`08:45`) |
| S2 | No renderer and no raster library were present — and that was not what blocked success | `rsvg-convert` not found (`08:34:45`), every render went through the OS thumbnailer; no Python imaging module (`08:43:09`), so the agent wrote its own PNG decoder (`09:22:28`), contour tracer and segmenter (`09:36`-`09:41`). The repo's Chromium was never used. Corrected by S9-S12: the same missing tools were present in the accepted pass; what changed was the method, and a self-built tracer took about 15 minutes |
| S3 | Until `09:22` agreement was judged by eye | a 50 %-opacity overlay was the comparison; only the hat band got a number (max edge error 0.84 / 0.99 px, `09:23:39`). At `08:48:26` the report said the outlines coincide "within a few pixels". Refined by S12: from `09:42` every pass and every choice was scored |
| S4 | The eye-judged claim does not survive a measurement | the `09:23` state reads IoU 0.883 (table above), against 0.984 for the score-driven state |
| S5 | Near-white inside the mark is ambiguous | the band was painted white; the user at `09:20:23`: it must be transparent. A dark-background render appeared only after that correction (`09:21:05`) |
| S6 | Syntax validity was offered as the check | the turn-end gate refused twice (`08:35:30`, `08:48:27`, no verification after the last edit); both times the answer was `xmllint --noout` and a report that the SVG "is valid" — D11 |
| S7 | "100 %" had to be asked three times, then bounded by the user | `08:43`, `09:20`, `09:34`; the last turn imposes compare-and-redo "at most 5 times". Before `09:42` the agent said 100 % is unreachable without a number. Corrected by S13: the accepted report gave a per-pass table and named the residual's cause, and the user accepted a measured near-match, not a literal 100 % |
| S8 | The delivered file is a true vector; two gaps remain | `09:23` state: 0 `<image>`, 0 `<text>`, crown box at y = -0.3 outside the viewBox. Accepted state, read here: 0 `<image>`, 0 `<text>`, 13 painted elements under one silhouette `clipPath`, the band a notch in that silhouette (alpha 0 at four sampled band points), and the viewBox fitted to the content (`7 -1 445 441`, nothing outside). Still no `<title>` or `role`, generic ids (`sil`, `g_B`, `g_face`), and the file was never re-opened as a deliverable |
| S9 | The source crop became the coordinate system | from `08:43` the logo region was cut from the sheet (`sips` crop, 480 × 460) and every vector coordinate was written in that crop's pixel units; the viewBox was fitted to the content only at the end. The independent search above lands on exactly that offset |
| S10 | Geometry was derived from the pixels, region by region | an edge map plus a threshold sweep split the mark into named regions — crown, loop, brim, B, stem, scarf, crescent, face, eyes, mouth, tongue (`09:39`-`09:41`); each contour was smoothed, resampled and simplified (`09:44`); one traced silhouette clips everything, so the outer edge comes from one contour and holes come from the source |
| S11 | Colour was fitted, not picked | each region's gradient was a least-squares fit to its own pixels; a radial gradient replaced the linear one where it lowered the residual by more than 3 % — crescent, stem, loop, crown (`09:46:35`) |
| S12 | One score decided every choice | mean absolute colour error and the share of pixels off by more than 40, over non-background pixels, with a per-region breakdown pointing at the worst region. Extra shading layers were tried on five regions and dropped because the score got worse (`09:45:04`); a sub-pixel offset sweep found +0.5 px best (2.30 % → 1.30 % off, `09:45:28`-`09:45:38`); four face thresholds were scored and 128 kept (`09:49:01`) |
| S13 | The stop was a budget, with diminishing returns, and an explained residual | five passes: 8.83 / 2.51 %, 8.77 / 2.31 %, 8.76 / 2.30 %, 7.93 / 1.26 %, 7.83 / 1.20 % (`09:49:33`); the report placed the remaining 1.2 % on the source's soft edges and 3D lighting that per-region gradients cannot carry. The user accepted at `10:29:29` |
| S14 | The final check looked for a raster | the last command parsed the file, printed its size and counted `<image>` elements: 0 (`09:49:23`). Still the OS thumbnailer, still no re-open as a deliverable |
| S15 | Fidelity cost size | 5.3 KB → 49.5 KB; 14 paths, the longest 5.7 k characters of path data, 176 gradient stops. Nothing measured or reported the size |

## Phase 0 — The fixture, and what today's instruments read on it

- [x] **0.1 Commit a planted-defect fixture.** Under
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
      `javascript:` href); an internal DTD subset or `<!ENTITY` declaration,
      whose clean twin carries a bare public DOCTYPE (exported assets often
      do, and it is harmless); a missing `xmlns`;
      unparseable path data; an unused `<defs>` entry, whose clean twin is a
      sprite sheet of `<symbol id>` entries addressed from a host page
      (`<use href="sprite.svg#id">`); near-white paint inside a mark where
      the source shows a hole (S5), with its masked twin; an `<animate
      attributeName="d">` whose values differ in command count or type; an external
      `href` or `url()`; a dangling `url(#id)` / `<use href="#id">`; a raster
      `<image href="data:image/...">` beside one dummy `<path>` (false
      "true vector"); a mark built only from `rect`/`circle` (must NOT be
      flagged as non-vector); an icon whose stroke or padding is off the
      incumbent set; and three surgical-edit pairs (flat paths, groups with
      transforms, `<use>`/`<symbol>`) where the edit touches one allowed
      element and the planted defect moves a neighbour. A README pre-registers
      every target in 0.3 before any checker exists.
      One conversion source joins the set: a raster rendered by Chromium from a
      committed reference vector (mark, wordmark and slogan, with a hole inside
      the mark), so the ground-truth geometry of every region is known and no
      third-party brand image is committed (S1, S4).
      verify: `npx vitest run tests/design-artifacts/svg_assets_fixture.test.ts --reporter=verbose` -> /✓.*every-planted-file-has-a-one-edit-twin/ <!-- ref-ignore -->
- [x] **0.2 Record today's detection.** Run `lint_design_quality --dir` over
      the HTML fixtures, `isUiPath` over every fixture path, and the
      `<path>`-presence check `logo-generation` describes over the vector
      fixtures; write the per-row result into the README. Expected from R10
      and D9, not assumed: 0 SMIL rows for the lint, 0 `.svg` paths for the
      predicate, a pass for the raster-with-dummy-path file and a fail for the
      `rect`/`circle` mark.
      verify: the README's baseline table has one row per planted file with
      a non-empty cell per instrument.
- [x] **0.3 Pre-register the targets.** Static layer: every row tagged
      `static` found, 0 findings on twins. Engine layer: every row tagged
      `engine` found where Playwright resolves, `unverified` otherwise — never
      a pass. Fill-ratio thresholds per asset class, never global.
      verify: the README carries the target table and its commit precedes the
      first commit that adds a checker.

## Phase 1 — Static witness

- [x] **1.1 `lint_svg_asset.ts`, dependency-free, advisory.** <!-- ref-ignore -->
      Same conventions as `lint_design_quality` (inline-ignore, project
      config, exit 0/2/1, the scanned-nothing refusal). Rule families:
      structure (viewBox, xmlns, dangling `#id` references, unparseable path
      data, unused `<defs>` entries — a `<symbol id>` is exempt, since a
      sprite sheet is addressed from outside the file); safety (active
      content, an internal DTD subset or `<!ENTITY` declaration — a bare
      public DOCTYPE is clean — external references; severity per 1.5);
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
- [x] **1.2 Preservation readout for a surgical edit.** `lint_svg_asset
      --baseline <before.svg> --allow <id,…>` compares every element outside
      the allowed set after attribute canonicalisation (number formatting,
      attribute order, whitespace) and reports each one that changed, with
      the attribute that changed. No pixel diff decides it — anti-aliasing and
      font metrics would make that a per-machine verdict. This is the witness
      for the surgical-edit discipline `docs/guidelines/design-fidelity-mechanics.md:124`
      already states as prose.
      verify: the three surgical-edit pairs from 0.1 each report exactly the
      moved neighbour, and their clean twins report nothing.
- [x] **1.3 DQ4 learns the definite case, inline only.** For inline SVG in
      HTML, `lint_design_quality` DQ4 reports SMIL with no reduced-motion route
      and SMIL whose only route is a CSS `animation: none` (R4). Standalone
      `.svg` stays in 1.1: a file cannot see its host's `<picture>` route, and
      flagging it there would break the linter's zero-false-positive header
      (`lint_design_quality.ts:12`).
      verify: `npx vitest run tests/scripts/lint_design_quality_dq4_smil.test.ts --reporter=verbose` -> /✓.*inline-smil-without-route-is-reported/ <!-- ref-ignore -->
- [x] **1.4 The design pass reads an `.svg` with the SVG rules, and nothing
      else changes.** `design_pass_hook` already fires on an `.svg` inside a UI
      tree (`design_pass_hook.ts:132`) and then scans it with
      `lint_design_slop.scanFile` (`:520`), which has no SVG rule (D9). Route
      an `.svg` write — inside a UI tree or not — to `lint_svg_asset`'s
      findings instead, inside this hook only. `svg` is NOT added to
      `UI_EXTENSIONS`: that predicate also gates `ui_route_nudge_hook`'s
      `isUiWrite` (`:125`), and an icon dropped into `public/` is not a UI
      change worth a routing nudge and its tokens. Pinned both ways: the hook
      delivers `lint_svg_asset` findings for `assets/logo.svg` and for
      `components/logo.svg`; `isUiWrite` stays `false` for `assets/logo.svg`
      and `true` for `components/logo.svg`, as today. No new hook concern.
      verify: `npx vitest run tests/scripts/design_pass_svg.test.ts --reporter=verbose` -> /✓.*svg-write-gets-svg-rules-and-no-new-nudge/ <!-- ref-ignore -->
- [x] **1.5 One safety profile per delivery mode.** The safety family reads
      the declared delivery mode and grades by what can execute there: inline
      DOM (scripts, `on*`, `javascript:` hrefs and `foreignObject` run in the
      host's origin — error); a standalone document opened directly (scripts
      run in the file's own context — error); `img` or CSS background (no
      script runs and no external reference loads — reported as `inert`, never
      as clean, because the same file can later be inlined). An undeclared
      mode is graded as inline, the strictest. The fixture's active-content
      rows carry one expected grade per mode.
      verify: `npx vitest run tests/scripts/lint_svg_asset.test.ts -t safety-grade-follows-delivery-mode --reporter=verbose` -> /✓.*safety-grade-follows-delivery-mode/ <!-- ref-ignore -->

## Phase 2 — Engine witness: an asset profile for `ui:render`

- [ ] **2.1 `ui:render <file> --profile asset`.** The page profile and its
      `VIEWPORTS` contract stay untouched. The asset profile renders per class
      (icon at 16/24/48 px; other classes at 1× and 2× intrinsic) on a light
      and a dark background read from the project's tokens, and records:
      the rendered file's path and digest (3.5 binds status to it);
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
      today. No second manifest schema. `generated_at` is written per run
      (`uiRender.ts:144`, `:212`, `:232`), so the comparison drops that one key
      and nothing else.
      verify: `npx vitest run tests/cli/ui_render_asset_profile.test.ts -t page-manifest-unchanged-except-generated-at --reporter=verbose` -> /✓.*page-manifest-unchanged-except-generated-at/ <!-- ref-ignore -->
- [ ] **2.3 Absence path unchanged.** No Playwright → `verification:
      unverified`, and the owner (3.1) then reports `static-only`. Playwright
      stays a devDependency; no rasteriser or renderer dependency is added.
      verify: `npx vitest run tests/cli/ui_render_asset_profile.test.ts -t absent-path-reads-unverified --reporter=verbose` -> /✓.*absent-path-reads-unverified/ <!-- ref-ignore -->
      (the case runs the existing render-absent fixture with the asset profile).
- [x] **2.4 A time point is a primitive.** Add `frame_seek` to
      `design-artifact-verification.md`'s primitive table ("an animation's
      state at a declared time", dependent on `playwright`), and a scope line
      on `media_emulation`: page document only — an image document was
      measured unreachable by emulation (R5).
      verify: `grep -cE '^[|] .frame_seek. [|]' docs/contracts/design-artifact-verification.md` -> /^1$/
- [x] **2.5 Fix the stale reference** at `uiRender.ts:26` (`package.json:97` →
      the line that holds `@playwright/test`, `:111` today).
      verify: `grep -c 'package.json:97' src/cli/commands/uiRender.ts` -> /^0$/
- [ ] **2.6 Geometry comparison with declared tolerances.** One comparison
      for two renders of the same frame — before and after an edit, or a
      source raster against its vector (S3, S4): silhouette IoU and the
      largest boundary distance, both in viewBox units, against a tolerance
      declared per asset class in 0.3's table. A one-device-pixel
      anti-aliasing band is excluded. `<text>` is compared by box and resolved
      family only: a delta whose only cause is a different resolved font or
      renderer reads `degraded` with the two families named, never `fail`. The
      raster comparison needs a declared registration (offset and scale of the
      source region); without one the reading is `unverified` rather than the
      best of several guesses. For a raster source the reading carries two
      numbers, because S4 and S13 show either alone misleads: silhouette IoU
      over saturated regions, and mean colour error plus the share of pixels
      off by more than 40/255 over non-background pixels — each broken down
      per region so the worst region is named. The registration is the source
      crop's own pixel frame (S9); a sub-pixel offset of the vector against it
      is part of the reading, not a hidden fudge (S12).
      verify: `npx vitest run tests/cli/ui_render_asset_profile.test.ts -t geometry-within-tolerance-and-font-delta-degrades --reporter=verbose` -> /✓.*geometry-within-tolerance-and-font-delta-degrades/ <!-- ref-ignore -->

## Phase 3 — One owner for hand-authored SVG

- [x] **3.1 Create the `svg-authoring` skill.** <!-- ref-ignore -->
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
      look-and-compare, and it applies between the owner's own passes too: a
      part the user already accepted joins the baseline and may not move by
      hand; a conversion pass that re-derives it from the source instead
      re-measures it and re-checks the accepted property (the band stayed a
      hole through the full re-trace, S8, S10).
      Converting a raster is its own branch, and the accepted session run
      (S9-S13) is its procedure: crop the source region and write every
      coordinate in that crop's pixel frame; derive geometry from the pixels —
      one traced silhouette that clips everything, then named regions split
      along an edge map, each contour smoothed and simplified — never draw it
      by eye (S1, S4); fit each region's colour to its own pixels, linear or
      radial by residual; classify near-white inside the mark as hole or paint
      from the source and check it on a dark background before the first
      report (S5); keep text, wordmark and slogan out unless asked; score
      every pass and every candidate change with 2.6's two numbers and keep a
      change only when the score improves, so a tried-and-worse idea is
      dropped by the number (S12); stop at 2.6's tolerance or at the user's
      pass budget, whichever comes first, and report the per-pass numbers,
      the remaining residual's cause and the file size — never "matches" or
      "100 %" (S7, S13, S15). Any tracing tool the host has may do the
      deriving; the measurement, not the tool, is the procedure (E11). Motion, ARIA and render-security mechanism are
      pointers to their authorities, never restated.
      verify: `./scripts-run src/scripts/skill_linter src/skills/svg-authoring/SKILL.md` -> 0 <!-- ref-ignore -->
- [x] **3.2 Move the diagram pre-checks.** `integration-mapping.md:65-74`
      moves to the owner as witnessed checks (viewBox safety, arrow-through-box
      and label-fits-box map onto 2.1's geometry). The verb routing table and
      the noun-count triage stay and point to the owner.
      verify: `grep -c 'Geometric pre-checks' src/skills/design-intelligence/references/integration-mapping.md` -> /^0$/
- [x] **3.3 Point the six lanes at it.** One pointer line each, no restated
      rule: `iconography/SKILL.md:102-105` (missing glyph — read the incumbent
      set's grid, stroke and padding from its own SVGs); `logo-generation`
      step 2 and step 5; `canvas-design/SKILL.md:76` when the execution tool
      is SVG; `wireframe/SKILL.md:80-81`; the V5 remediation cell in
      `design-antipatterns.md:117`.
      verify: `grep -l 'svg-authoring' src/skills/iconography/SKILL.md src/skills/logo-generation/SKILL.md src/skills/canvas-design/SKILL.md src/skills/wireframe/SKILL.md docs/guidelines/design-antipatterns.md` -> /iconography.*\n.*logo-generation.*\n.*canvas-design.*\n.*wireframe.*\n.*design-antipatterns/
- [x] **3.4 Trigger rows.** An `evals/triggers.json` for the owner with
      sibling negatives: icon-set lookup → `iconography`, brand pipeline →
      `logo-generation`, raster → `image-generation`, video motion →
      `motion-choreographer`; positives include "draw an SVG icon the set
      does not have", "animate this logo SVG", "change only the hat in this
      SVG", "turn the logo in this PNG into a real vector without the app
      name" (S1).
      verify: `./scripts-run src/scripts/check_trigger_evals` -> 0
- [ ] **3.5 Status follows render evidence.** The owner may report
      `verified` only when a render manifest from 2.1 exists whose recorded
      file digest equals the delivered file's digest on disk — a manifest from
      an earlier pass does not count. A parser or `xmllint` pass alone reports
      `static-only` (S6). `isVerificationCommand` (`verification_command.ts:293`)
      learns `ui:render --profile asset`, so the turn-end gate accepts the
      check that actually looks at the file, and does not learn `xmllint`.
      verify: `npx vitest run tests/scripts/verification_command_asset_render.test.ts --reporter=verbose` -> /✓.*asset-render-verifies-and-xmllint-does-not/ <!-- ref-ignore -->
- [x] **3.6 Deliver, re-open, re-render.** The owner's last step reads every
      delivered file back from its final path in a fresh browser context
      (`file://`, other requests aborted), re-renders it from there — not from
      the source text it wrote — and reports path, byte size and digest; an
      `img` delivery is also loaded through a host `<img>` and must report a
      non-zero natural width. A file that does not re-open is not delivered
      (S8).
      verify: `grep -cE 'read\sback|re-open' src/skills/svg-authoring/SKILL.md` -> /^[1-9]/ <!-- ref-ignore -->

## Phase 4 — Routing that ends in an asset

- [x] **4.1 Split `image-provider-routing/SKILL.md:40`.** Icon →
      `iconography` (set first) → the owner for a missing glyph; simple
      geometric mark → the owner; complex illustrative vector art → the
      provider, with the adapter's lifecycle stated in the answer. Trigger
      rows of both skills updated in the same diff.
      verify: `./scripts-run src/scripts/check_trigger_evals` -> 0
- [x] **4.2 Replace the path-presence check.** `logo-generation/SKILL.md:53-55`
      and the good example at `:80-82` use 1.1's vector-honesty family plus the
      witness: a `rect`/`circle` mark stops failing, a raster beside a dummy
      path stops passing.
      verify: `grep -c 'elements before treating it' src/skills/logo-generation/SKILL.md` -> /^0$/

## Phase 5 — Measured outcome

- [ ] **5.1 Re-run the fixture with every layer on** and write the per-row
      table beside 0.2's baseline in the fixture README. Claims in the owner
      skill follow the numbers, not the plan.
      verify: the README carries both tables with identical row sets.
- [ ] **5.2 Record the promotion bar, not the promotion.** Beside each rule
      in 5.1's table, record its finding count on clean twins and on Phase 6's
      outputs across two consecutive measured runs. A rule is a blocking
      candidate only at zero twin findings in both runs and at least one true
      finding on its planted row; the README states that bar and which rules
      meet it. Promoting any of them stays out of this roadmap (E5).
      verify: `grep -cE '^[|]\s*rule\s*[|].*twin' tests/design-artifacts/fixtures/svg-assets/README.md` -> /^1$/ <!-- ref-ignore -->

## Phase 6 — Five end-to-end tasks

Each scenario is one recorded run of the owner on a fresh session, with the
task text, the inputs and the delivered files committed under
`tests/design-artifacts/scenarios/` <!-- ref-ignore -->. The witnesses — never a
model — decide the outcome, and one test file checks all five.

- [ ] **6.1 A new logo as a true vector.** Two sub-cases, because the session
      showed they fail differently. (a) From a brief: the delivered file has 0
      `<image>`, 0 `foreignObject`, no `<text>` unless the brief asks for one,
      a fill ratio inside its class threshold, `lint_svg_asset` at 0 errors and
      status `verified` (3.5). (b) From 0.1's conversion raster, "the mark
      only, as a real vector": the same file properties, no wordmark or slogan
      region, the hole inside the mark is a hole on a dark background, and
      2.6's two readings against the reference vector meet the declared
      tolerance — reported as numbers with the pass count. The tolerance is
      pre-registered in 0.3 and starts from the one accepted point on record
      (S13: IoU 0.984, mean colour error 7.8, 1.2 % of pixels off): the
      fixture raster is rendered from a flat-gradient vector, so it must do
      at least that well, and a run that needs more than five scored passes
      to get there fails.
      verify: `npx vitest run tests/design-artifacts/svg_scenarios.test.ts -t new-logo-true-vector --reporter=verbose` -> /✓.*new-logo-true-vector/ <!-- ref-ignore -->
- [ ] **6.2 Remove only one figure's face, keep its hat.** Input: an SVG of a
      figure whose hat and face are separate, with transforms and a `<use>`.
      Outcome: 1.2 reports 0 changed elements outside the face's declared ids,
      and 2.6 reports no silhouette change outside the face's box beyond the
      anti-aliasing band.
      verify: `npx vitest run tests/design-artifacts/svg_scenarios.test.ts -t face-removed-hat-unchanged --reporter=verbose` -> /✓.*face-removed-hat-unchanged/ <!-- ref-ignore -->
- [ ] **6.3 Scale 3000× without loss.** A 512 px tile clipped from an edge
      of 6.1's output is rendered at 3000× device scale; the edge transition
      is at most 2 device pixels wide (an embedded raster would blur across
      hundreds), and the file still has 0 `<image>` and no filter that
      rasterises at a fixed resolution.
      verify: `npx vitest run tests/design-artifacts/svg_scenarios.test.ts -t scales-3000x-sharp --reporter=verbose` -> /✓.*scales-3000x-sharp/ <!-- ref-ignore -->
- [ ] **6.4 An animated variant with a reduced-motion fallback.** `frame_seek`
      (2.4) at t = 0, mid and end yields three different frames; under
      emulated `reduce` the inline delivery yields equal frames; the `img`
      delivery records `not_witnessable` and its host carries the
      `<picture>` static route; DQ4 (1.3) and 1.1's motion family report 0.
      verify: `npx vitest run tests/design-artifacts/svg_scenarios.test.ts -t animated-with-reduced-motion-route --reporter=verbose` -> /✓.*animated-with-reduced-motion-route/ <!-- ref-ignore -->
- [ ] **6.5 Working files, verified after re-opening.** Every file 6.1-6.4
      delivered exists at its reported path with its reported digest, parses,
      re-renders non-empty from disk in a fresh context with the network
      aborted, and, for `img` delivery, loads through a host `<img>` with a
      non-zero natural width (3.6).
      verify: `npx vitest run tests/design-artifacts/svg_scenarios.test.ts -t delivered-files-reopen --reporter=verbose` -> /✓.*delivered-files-reopen/ <!-- ref-ignore -->

## Decisions

| ID | ownership | resolved by | decision | evidence | revisit if |
|---|---|---|---|---|---|
| E1 | reversible-technical | evidence | Own active roadmap with `estate_offset_exempt` (frontmatter) | none of the twenty top-level roadmaps owns a design, frontend or asset surface | a design-surface roadmap becomes active and this folds into it |
| E2 | reversible-technical | evidence | A new skill, not a reference under `fe-design`. The overlap scan found no skill that holds a hand-authored-SVG procedure; the five skill lanes sit in three packs (`iconography`, `wireframe`, `design-intelligence` → `frontend-design`; `logo-generation` → `ai-image`; `canvas-design` → `ai-video`) and the sixth is a guideline (`design-antipatterns.md`), so a reference file under any one skill is unreachable from two packs, while `packs:` takes a list (`src/scripts/schemas/skill.schema.json`). `engineering-base` joins the list because the motion authority the owner points at, `fe-design`, lives there. The other plan's "skill only if routing fails" condition already holds: D2 | D1, D2; skill schema `packs` is an array | 3.4's trigger evals show the owner never wins against the lanes it serves |
| E3 | reversible-technical | evidence | `frame_seek` is a primitive, not a `screenshot` parameter | `design-artifact-verification.md:62-64`: a state that is not a frame property gets its own primitive | the contract folds its four state primitives back into `screenshot` |
| E4 | reversible-technical | evidence | SMIL delivered as `img`/background requires a host static route (`<picture>` with a reduced-motion source), not a ban | R5: the `<picture>` route was selected under `reduce` | a real OS preference is shown to reach image documents (open: the two instrument paths disagree) |
| E5 | reversible-technical | agent | Every rule here ships advisory. A blocking promotion is a consumer-facing default flip and is not in this roadmap; 5.2 records the measured bar a later promotion must cite | `lint_design_quality` and the design pass are advisory/default-off today | a later change proposes blocking — that change carries its own owner gate and 5.2's two-run zero-twin reading |
| E6 | reversible-technical | evidence | The icon grid is read from the incumbent set's own SVGs, never declared or vendored | `iconography/SKILL.md:95-97`; council rejection of vendored grid tables in archived `road-to-design-mechanism-harvest` § Notes | a consumer's set has no consistent grid to read |
| E7 | reversible-technical | evidence | DQ4's SMIL extension is inline-only | `lint_design_quality.ts:12` (zero false positives on correct implementation); a standalone file cannot see its host route | — |
| E8 | reversible-technical | evidence | No second manifest schema; the asset profile extends today's render manifest under `profile: asset` | one manifest reader already exists (`uiRender.ts`) | a consumer needs an export-format manifest the render manifest cannot express |
| E9 | reversible-technical | evidence | No renderer beyond the existing Playwright devDependency; no capability probe over several rasterisers | R2/R4/R6 are browser behaviours a rasteriser does not have; the absence path already degrades to `unverified`; S2: the session fell back to an OS thumbnailer because nothing told it the repo already ships Chromium | an export target (PDF, deck) needs a rasteriser witness |
| E10 | reversible-technical | evidence | An `.svg` gets SVG rules inside `design_pass_hook` only; `UI_EXTENSIONS` stays without `svg` | `design_pass_hook.ts:132` already covers UI trees and scans with `lint_design_slop` (`:520`, no SVG rule); `ui_route_nudge_hook.ts:125` shares the predicate, so widening it would nudge on every asset write | an `.svg` write outside a UI tree is shown to need UI routing |
| E11 | reversible-technical | evidence | Raster-to-vector conversion is a named branch of the owner whose procedure is pixel-derived geometry under a score (3.1, 2.6); no tracing dependency is added and none is named | S1-S4 failed by drawing by eye; S9-S13 succeeded with the same missing tools by deriving contours from the registered pixels and scoring every pass — the session built its own tracer in about 15 minutes (`09:36`-`09:49`), so the method transfers without a package; E9 keeps the dependency set closed | a host can neither run a tracing tool nor write one, and 6.1(b) cannot reach its tolerance |
| E12 | reversible-technical | evidence | `img`/background delivery grades active content `inert`, never clean | 1.5: a file delivered as `img` today can be inlined tomorrow with no edit to the file | a delivery mode is shown to be fixed by the file itself |

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
  internal-subset/entity rejection (a public DOCTYPE stays clean) and external references as 1.1, dangling
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
- **From the external review.** Render evidence bound to status as 3.5;
  security profiles per embedding mode as 1.5; no needless UI hook for every
  `.svg` as 1.4 (merged with the second review's D9 correction); geometry
  tolerances as 2.6; deliver and re-open as 3.6 and 6.5; blocking coupled to
  measured error rates as 5.2; the five task scenarios as Phase 6. The verify
  parser defect is Phase 0 of `road-to-svg-in-the-authorities`.
- **From the second review.** D9 and 1.4 corrected; 2.2's comparison drops
  `generated_at`; the `:181` → `:182` reference; `depends` for Phase 3; the
  DOCTYPE rule narrowed to internal subsets and entities; sprite sheets
  exempt from unused `<defs>`; E2's pack rationale; R12.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-10-11 | reviewer: claude -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | A witness that reds on clean assets gets switched off | product | A rule that fires on designed padding or an intentional dash pattern trains the agent to ignore the lint, the state the design pass already lived through | One-edit twins with a pre-registered 0-findings target, per-class thresholds, advisory only (E5) | Phase 1 — Static witness |
| 2 | File-scoped rules hide planted defects | implementation | A rule that reads "the file mentions `transform-box`" passes a file whose wrong element sits beside a correct twin (R9 diverged) | 0.1 plants exactly that pair; 1.1 binds motion rules per rule or element | Phase 1 — Static witness |
| 3 | Font metrics differ between machines | implementation | Text-fit and fill-ratio readings move with the resolved font | The resolved family is recorded; an unresolvable declared family degrades the reading to `degraded`, never to pass | Phase 2 — Engine witness: an asset profile for `ui:render` |
| 4 | Widening `isUiPath` changes a second hook | implementation | `ui_route_nudge_hook.ts` reads the same predicate, so `.svg` writes would start nudging UI routing and spending tokens on every asset write | 1.4 leaves the predicate alone, routes `.svg` inside `design_pass_hook` only and pins `isUiWrite` unchanged (E10) | Phase 1 — Static witness |
| 5 | The owner grows into a drawn-asset corpus | product | Recipes accrete in the skill until it restates motion, ARIA and security mechanism | 3.1 states procedure and invariants only and points to the authorities; Non-goals forbid vendored tables | Phase 3 — One owner for hand-authored SVG |
| 6 | Skill-count growth is refused at the estate gate | implementation | `skill_count` and description tokens have 0 allowance | 3.1's diff carries the `estate_growth_exempt` claim with its reason | Phase 3 — One owner for hand-authored SVG |
| 7 | A conversion is reported as a match without a number | product | S3/S4: the session said the outlines coincide while a measurement reads IoU 0.883; the user asked three times. Once every pass was scored (S12-S13) the same session reached 0.984 and was accepted | 2.6 makes agreement two numbers against a declared tolerance and registration; 3.1 forbids "matches"/"100 %" without them and keeps a change only when the score improves | Phase 2 — Engine witness: an asset profile for `ui:render` |
| 8 | Syntax validity is accepted as the visual check | product | S6: the turn-end gate was satisfied by `xmllint`; a file can parse and still be wrong | 3.5 binds `verified` to a render manifest of the delivered digest and teaches the gate the asset render, not `xmllint` | Phase 3 — One owner for hand-authored SVG |
| 9 | A delivery-mode profile under-reports | implementation | An asset graded for `img` is later inlined and its script runs | 1.5 grades undeclared mode as inline and never reports `img`-mode active content as clean (E12) | Phase 1 — Static witness |
| 10 | Tolerances absorb real defects | implementation | A tolerance wide enough for font and anti-aliasing deltas also hides a moved neighbour | Tolerances are per class in 0.3 before any checker; 1.2's attribute readout, not pixels, decides a surgical edit; a font-only delta reads `degraded`, never `pass` | Phase 2 — Engine witness: an asset profile for `ui:render` |
| 11 | Fidelity bloats the file unnoticed | implementation | S15: the accepted file grew from 5.3 KB to 49.5 KB with no size reading; a pixel-derived contour carries every jag unless it is simplified | 3.1 reports the file size with the score; simplification is the contour step, not an optimiser in the write path (Non-goals) | Phase 3 — One owner for hand-authored SVG |

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
      only a CSS route, is reported by DQ4; an `.svg` write receives
      `lint_svg_asset` findings from the design pass, and `isUiWrite` is
      unchanged for `.svg` paths.
- [ ] AC-6 — "SVG icon the set lacks" and "simple geometric logo" requests
      route to an asset-producing lane in the trigger corpus; the dry-run
      provider is reached only for illustrative vector art and says so.
- [ ] AC-7 — 5.1's table stands beside 0.2's baseline with identical rows,
      with 5.2's per-rule twin counts from two runs beside it.
- [ ] AC-8 — Active content is graded per delivery mode; an undeclared mode
      is graded as inline, and `img` mode never reads clean.
- [ ] AC-9 — The owner reports `verified` only with a render manifest whose
      digest equals the delivered file's; `xmllint` alone yields
      `static-only`, and the turn-end gate counts the asset render.
- [ ] AC-10 — 2.6 reports silhouette agreement and boundary distance against
      a declared per-class tolerance, and for a raster source also mean colour
      error and the share of pixels off, per region; a font-only delta reads
      `degraded`.
- [ ] AC-11 — 6.1 (both sub-cases), 6.2, 6.3, 6.4 and 6.5 each pass their
      witness check on a recorded run, and every delivered file re-opens
      from disk.
