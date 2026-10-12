---
complexity: lightweight
status: ready
execution:
  mode: phase-checkpoints
relates:
  - slug: road-to-svg-with-a-witness
    relation: extends
    note: "Archived. It built the witness and the owner skill from session learnings S1-S15; this roadmap carries S16-S31, taken from the same work after the logo was accepted, and runs the shipped witness on the session's real files for the first time."
  - slug: road-to-svg-review-followups
    relation: disjoint
    note: "Its 2.3 (goal axis) and 3.2 (held-out real set) touch the same question from the review side. Nothing here amends a step there; 1.1 and 1.2 here are concrete false positives its real set would also surface."
  - slug: road-to-svg-rules-in-the-dispatch-path
    relation: disjoint
    note: "Hook routing and the four carried R2 findings. No step here touches the hook bundle or Registration.scale."
estate_offset_exempt: "Carries false positives and gaps found by running the shipped witness on a live session's real files after its parent roadmap was archived; the two active SVG roadmaps own hook routing and review amendments, neither owns the engine readings or the skill's conversion branch, so there is nothing to fold into."
---
# Road to SVG from a live session

> **Source:** a maintainer session converting raster artwork to SVG
> (2026-10-11), continued — the mascot, the rebuilt mark, the wordmark and the
> small-size variant, after the traced mark was accepted at 10:29Z. Two
> transcripts (the conversion session and a parallel rebuild session) and the
> files they left behind. The shipped `lint_svg_asset` and
> `ui:render --profile asset` were run on those files offline (`file://`,
> every other request aborted); the readings are in § Measurements.

## Goal

The witness that shipped with `road-to-svg-with-a-witness` gives on real
conversion files the same answer the owner and the reviewers gave: no motion
finding on a file that does not move, no hole finding on white the owner chose
to paint, a raster comparison whose verdict passes the point the owner
accepted, and readings for the three defects that sent accepted files back —
seams between abutting shapes, a mark unreadable on a dark ground, and file
cost. The owner skill's conversion branch teaches the procedure both sessions
ended on (trace as the underlay, construct the deliverable), stops a pass loop
on a plateau instead of a count, and keeps numbered snapshots so an accepted
property cannot silently disappear between hand edits.

## Context

- **When the tools existed.** PR #2300 merged at 15:52Z. The conversion
  session ran 08:33Z-16:17Z on a checkout without it, so it never loaded
  `svg-authoring` or ran either witness; its verification stayed "`xmllint`
  reports it valid" (18 times after 10:29Z) plus "rendered and looked at it".
  Nothing here blames the session for not using a tool it did not have; every
  finding below is about what the tool says now that it exists.
- **Owner material stays out of the tree.** The session files are the owner's
  brand artwork. No step commits them; every fixture is a synthetic replica of
  the failure shape (D4).
- **The prior learnings S1-S15** live in the archived parent's Context. Three
  of them are contradicted below (S5, S10-S13, S13's tolerance) and the
  contradiction is the reason for Phases 1, 2 and 5.

## Measurements

Run on 2026-10-11 from this worktree, files copied to
`agents/runtime/tmp/svg-l3/` (gitignored), delivery `img`.

| File | Owner outcome | `lint_svg_asset` | `ui:render --profile asset` findings |
|---|---|---|---|
| traced mark, 49,490 B (accepted 10:29Z) | rejected 10:44Z by review, replaced | 1 error (no name) | 1 — `img-delivery-no-static-route` |
| constructed mark, 4,622 B | accepted 11:26Z | clean | 2 — `near-white-hole` (the band the owner chose white), `img-delivery-no-static-route` |
| small-size variant, 2,064 B | accepted 11:27Z | clean | 2 — `near-white-hole`, `img-delivery-no-static-route` |
| wordmark, 4,465 B | delivered 11:36Z, dark variant missing | clean | 1 — `img-delivery-no-static-route` |
| traced mascot, 195,282 B, 355 gradients | rejected (12:15Z, 13:28Z) | 1 error (no name) | 1 — `img-delivery-no-static-route` |
| hand-built mascot, 59,485 B | accepted as base 16:17Z | clean | 6 — 5 x `near-white-hole` (face, gloves, shirt, legs), `img-delivery-no-static-route` |

None of the six files contains `<animate`, `@keyframes` or `animation`.

Raster comparison (`--compare` the board, `--registration` reconstructed from
the session's own crop calls):

| File | Verdict | Silhouette IoU / boundary | Region "whole": IoU · mean colour error · share off by 40 |
|---|---|---|---|
| traced mark | **fail** | 0.872 / 33.0 units | 0.989 · 10.2 · 3.3 % |
| constructed mark | **fail** | 0.843 / 32.7 units | 0.935 · 24.9 · 12.7 % |
| traced mascot | **fail** | 0.832 / 17.6 units | 0.893 · 23.6 · 10.1 % |
| hand-built mascot | **fail** | 0.688 / 16.1 units | 0.588 · 61.2 · 36.2 % |
| wordmark | **fail** | 0.68-0.81 over y ± 5 px | 0.56-0.81 · 53-73 |

Three readings follow. The witness ranks the rejected trace above the accepted
construction on every number. Its verdict fails the trace the owner accepted at
10:29Z, so the tolerance seeded "from this accepted point" is not met by that
point. And the wordmark's registration cannot be recovered from the file: three
plausible frames move IoU from 0.56 to 0.81. The session's own scorer gave the
traced mascot 6.12 mean error and 1.53 % off; the witness gives 23.6 and 10.1 %
for the same bytes, so two scorers disagree on one file by a factor of four.

## Session learnings

Numbered after S1-S15. Timestamps are UTC; the paraphrase is short.

| # | Learning | Evidence | Disposition |
|---|---|---|---|
| S16 | A measured near-match the owner accepted was rejected 15 min later by a visual review on criteria the score does not see: crown cut at the crop edge, hairlines between segments, an off-palette spot, jagged edges, 49 KB of edit-hostile points, face unreadable at 32 px | 10:29Z owner accepts ("perfect"); 10:44Z review list; 11:15Z rebuild 4.5 KB, 14 shapes, ~180 points | 5.1, 2.1, 3.2, 4.1, 4.3 |
| S17 | The traced crown was cut because the crop started 5 px below it; the trace took the crop border as contour, and a comparison against the same crop cannot see the cut | parallel session 10:46Z: cropped from row 60, the crown starts near row 55 | 2.1, 5.2 |
| S18 | "Band transparent" (09:20Z) was reversed: the review graded the hole a defect, the agent surfaced the conflict with options, the owner chose white and opaque | parallel 10:46Z options; 11:05Z owner picks white | 1.2 (the witness still encodes the reversed choice); surfacing already covered by `cross-source-consistency` |
| S19 | A small-size variant was required: the face turns to mush at 32 px and below; a simplified variant was built and checked at 32 and 16 px | review 10:44Z; 11:15Z, 11:27Z | 4.3, 5.5 |
| S20 | The wordmark was fitted letter by letter to measured positions, but its dark-violet fill is unreadable on a dark ground and the dark variant was not built | parallel 11:36Z | 4.2, 5.5 |
| S21 | The mascot trace used a blur filter (~300 KB, 243 paths); the agent kept pass 5 over the better-scoring pass 4 because pass 4 "looked like watercolour" — score and look disagreed and the look won | 10:47Z table | 5.1, 5.3 |
| S22 | Twelve more scored passes (16.78 → 6.12 mean error, 9.1 % → 1.5 % off) did not reach acceptance; the owner said "still unclean" twice and the plateau was named only after the owner brought a style reference | 11:40Z, 12:15Z, 13:07Z, 13:28Z, 13:53Z; 13:56Z | 5.3 |
| S23 | The goal changed from 1:1 trace to redesign (fingers, depth from a reference); the agent surfaced the contradiction with two options before rebuilding — after that the source-fidelity score has no meaning | 13:56Z | already covered — `cross-source-consistency`; 5.1 names when the score stops applying |
| S24 | Hand authoring lost an accepted property twice: the dark notch where the brim passes behind the crown went missing (15:49Z), came back with the brim in front (15:53Z), was lost again (16:13Z); the owner asked to restore "version 4" from their own downloads | 15:49Z, 15:53Z, 16:13Z; 16:08Z restore "as in version 4" | 5.4; mechanism already in `svg-authoring` SKILL.md:99-117 (`--baseline --allow`) but needs a snapshot to diff against |
| S25 | Seams: abutting traced segments left background-coloured hairlines and pinholes where three parts meet; fixed by letting each earlier surface reach 1 px under later neighbours | review 10:44Z; 13:00Z-13:06Z | 4.1 |
| S26 | Static cost went unremarked: the rejected mascot had 355 gradients, 9 with identical stops, 195 KB; external reviews counted "240 gradient definitions" and single-colour gradients; `lint_svg_asset` reports only a missing name | measurement above; pasted reviews 13:55Z, 14:33Z | 3.1, 3.2 |
| S27 | Lettering was re-set from an installed system font and outlined into the asset | 14:34Z an installed system font is chosen and outlined | 5.6 |
| S28 | `img-delivery-no-static-route` fires on every file, none of which animates | measurement above; `uiRenderAsset.ts:1122` tests only `host_picture_route === false` | 1.1 |
| S29 | `near-white-hole` fires 6 times on paint the owner chose and 0 times on the rejected trace; it decides containment from bounding boxes and has no source evidence | measurement above; `uiRenderAsset.ts:941-972` | 1.2 |
| S30 | The raster verdict fails the accepted trace; the per-region breakdown S12 asked for is unreachable — `CompareSpec.regions` exists, `main.ts` has no option for it, so `worst_region` is always `whole` | measurement above; `uiRenderAssetCompare.ts:77`; `main.ts:164-176` | 2.1, 2.2 |
| S31 | A conversion's registration and scorer are not recorded with the file, so it cannot be re-verified later (wordmark) and two scorers' numbers cannot be told apart (mascot) | measurement above | 2.3 |
| — | A pasted review meant for another chat started an unrelated task for 3 min | 11:16Z-11:19Z | declined — not an SVG surface; `question-not-instruction` and interrupt rules own it |
| — | External reviews scored the mascot 7.8 → 8.9/10 and steered each pass | 14:59Z-16:17Z | declined — an outside grader's number is input, not a witness; `evaluator-independence` owns how it may be used |
| — | `data-pivot` attributes were added as animation pivots | 15:25Z | already covered — `svg-motion-transform-box` (`svg_rules.ts:904`) applies once anything animates |

## Phase 1 — The witness stops warning about what is not there

- [x] **1.1 `motion/img-delivery-no-static-route` fires only on a file that
      moves.** Today `uiRenderAsset.ts:1122` pushes the finding whenever the
      host has no reduced-motion `<picture>` route, without asking whether the
      file animates; six of six real files read it with no animation. Gate the
      push on the duration the motion reading already computes (`> 0`). Add a
      non-animated twin beside `hosts/img-delivery.html` that must read 0.
      S28.
      verify: `npx vitest run tests/cli/ui_render_asset_profile.test.ts --reporter=verbose` -> /✓.*static-file-through-img-has-no-motion-finding/ <!-- ref-ignore -->
- [x] **1.2 `geometry/near-white-hole` needs evidence of a hole.** With a
      registered raster (`--compare` + `--registration`) the reading samples the
      source under the near-white region and reports only when the source there
      matches the source background; without a source it records the region
      in the manifest and pushes no warning. Containment is decided by sampled
      fill (`isPointInFill`), not by bounding boxes. Two twins: a white band the
      source shows as white paint (0 findings) and one the source shows as
      background (1 finding). The existing `assets/near-white-hole.svg` row keeps
      its expectation by gaining a source raster. S18, S29. D1.
      verify: `npx vitest run tests/cli/ui_render_asset_profile.test.ts --reporter=verbose` -> /✓.*near-white-hole-is-decided-by-the-source/ <!-- ref-ignore -->

## Phase 2 — The raster comparison passes what was accepted

- [x] **2.1 The raster verdict reads the subject, not the frame.** A fixture
      raster renders `conversion/reference.svg` on an opaque light ground with
      an unrelated mark and a soft glow inside the registration frame. The
      reference compared against it must read `pass`; today the background
      mask from the corner pixel folds neighbours and halo into IoU and
      boundary distance. Foreign content inside the frame is reported as its
      own reading, and source content touching the frame's edge is reported as
      `geometry/source-cut-by-frame` — the crown-cut case, where the trace and
      the crop agree and IoU cannot see it. S16, S17, S30.
      verify: `npx vitest run tests/cli/ui_render_asset_profile.test.ts --reporter=verbose` -> /✓.*registered-raster-of-the-reference-passes/ <!-- ref-ignore -->
      and `npx vitest run tests/cli/ui_render_asset_profile.test.ts --reporter=verbose` -> /✓.*source-cut-by-frame-is-found/ <!-- ref-ignore -->
- [x] **2.2 Per-region readings without a regions file.** When no regions are
      passed, the comparison derives one region per top-level `<g id>` from its
      rendered box and names the worst; `whole` stays as the first row. S12's
      per-region breakdown becomes reachable from the CLI. S30. D2.
      verify: `npx vitest run tests/cli/ui_render_asset_profile.test.ts --reporter=verbose` -> /✓.*top-level-groups-become-regions/ <!-- ref-ignore -->
- [x] **2.3 A conversion records its registration and its scorer.** The
      skill's Output format item 4 names the registration as `x,y,w,h` in the
      source's pixel frame, the scorer that produced each number (`ui:render`
      or a named script) and the sample resolution, so a later run can repeat
      the reading and a second scorer's number is never quoted as the first's.
      S31.
      verify: `grep -cE 'registration.*x,y,w,h' src/skills/svg-authoring/SKILL.md` -> /^[1-9]/

## Phase 3 — The static witness reads cost

- [x] **3.1 `svg-structure-degenerate-gradient`.** A gradient whose stops all
      carry the same colour and opacity is a flat fill in a gradient's clothes;
      warn. Planted row and clean twin in `tests/design-artifacts/fixtures/svg-assets/`,
      pre-registered in its README before the rule is written. S26.
      verify: `npx vitest run tests/scripts/lint_svg_asset.test.ts --reporter=verbose` -> /✓.*degenerate-gradient-is-found/ <!-- ref-ignore -->
- [x] **3.2 A cost reading, reported and never gated.** The asset manifest
      gains `cost: { bytes, elements, paths, gradients, coordinates }`, and the
      skill's report quotes it beside the fidelity numbers. No threshold: none
      was measured, and a gate on bytes would have refused the 195 KB trace and
      the 59 KB accepted figure alike. S16, S26. D3.
      verify: `npx vitest run tests/cli/ui_render_asset_profile.test.ts --reporter=verbose` -> /✓.*manifest-carries-a-cost-reading/ <!-- ref-ignore -->

## Phase 4 — Seams, dark grounds and small sizes

- [x] **4.1 `geometry/background-bleed-inside-silhouette`.** On the dark
      capture, count pixels inside the file's own silhouette (from the
      transparent render) whose colour sits within the anti-alias band of the
      dark ground; ids declared as holes are excluded. Twins: two abutting
      shapes on a fractional shared edge (found) and the same shapes
      overlapping by one unit (clean). The count threshold is pre-registered
      in the fixture README before the reading is written. S16, S25.
      verify: `npx vitest run tests/cli/ui_render_asset_profile.test.ts --reporter=verbose` -> /✓.*seam-between-abutting-shapes-is-found/ <!-- ref-ignore -->
- [x] **4.2 A contrast reading per background.** For each capture, the share
      of painted pixels whose contrast against that capture's background is
      below 3:1. A mark that is mostly below on one ground reads
      `accessibility/low-contrast-on-background` naming the ground. Twins: a
      dark-violet word on the dark capture (found) and a light one (clean).
      S20.
      verify: `npx vitest run tests/cli/ui_render_asset_profile.test.ts --reporter=verbose` -> /✓.*dark-mark-on-dark-ground-is-found/ <!-- ref-ignore -->
- [x] **4.3 Marks are rendered small as well.** The `mark` class captures 16
      and 32 px beside 1x and 2x, so the legibility look the review asked for
      has a capture to look at. Legibility stays a look; the capture is the
      evidence it happened. S16, S19.
      verify: `npx vitest run tests/cli/ui_render_asset_profile.test.ts --reporter=verbose` -> /✓.*mark-class-captures-16-and-32/ <!-- ref-ignore -->

## Phase 5 — The owner skill teaches what was accepted

- [x] **5.1 Trace or construct — decided, and the trace is the underlay by
      default.** A new subsection in the conversion branch of
      `src/skills/svg-authoring/SKILL.md`: trace the source to measure and to
      align, then construct the deliverable from few points, palette colours
      and named shapes over that underlay; keep a trace as the deliverable only
      when the owner asks for maximum fidelity over editability. It states the
      measured reason: the trace scores higher (0.989 against 0.935) and was
      still rejected, so the score is the alignment check, never the acceptance.
      It also states when the score stops applying — once the owner's goal
      becomes a redesign, the source-fidelity number is no longer reported as
      progress. Steps 2 and 6 of the branch are reworded to match. S16, S21,
      S23. D5.
      verify: `grep -cE '^###.*Trace.*construct' src/skills/svg-authoring/SKILL.md` -> /^[1-9]/
- [x] **5.2 Crop with margin, and never trust a crop edge.** Step 1 of the
      branch gains: crop with a margin, and widen the crop when source content
      touches its edge (2.1's finding is the check). S17.
      verify: `grep -cE 'margin.*crop|crop.*margin' src/skills/svg-authoring/SKILL.md` -> /^[1-9]/
- [x] **5.3 Stop on a plateau, not on a count.** The branch's stop rule gains:
      when two consecutive passes each improve the score by less than 5 %
      relative, stop and report the residual's cause and the construct or
      redesign option, instead of starting another pass. The user's pass budget
      still wins when it is smaller. S21, S22.
      verify: `grep -cE '[Pp]lateau' src/skills/svg-authoring/SKILL.md` -> /^[1-9]/
- [x] **5.4 One snapshot per delivered pass.** Every delivered pass is also
      written as `<name>.pass-<n>.svg`, the next pass is diffed with
      `lint_svg_asset --baseline` against the last accepted snapshot, and the
      report lists the accepted properties carried forward. Restoring "version
      4" is a copy, not a reconstruction. Extends SKILL.md:99-117. S24.
      verify: `grep -cE 'pass-<n>\.svg' src/skills/svg-authoring/SKILL.md` -> /^[1-9]/
- [x] **5.5 A mark names its variants.** The Output format gains a variants
      line: the small-size variant when the 16/32 px captures (4.3) lose the
      detail, and a light-on-dark variant when 4.2 reads low contrast — built
      or named as missing, never silent. S19, S20.
      verify: `grep -cE '[Vv]ariants' src/skills/svg-authoring/SKILL.md` -> /^[1-9]/
- [x] **5.6 Outlined lettering names its font.** A word set from an installed
      font and converted to outlines is reported with the font's name and
      whether its licence allows outlining into a distributed asset; unknown
      licence is reported as unknown, not as permitted. S27.
      verify: `grep -cE 'licen[cs]e.*outlin|outlin.*licen[cs]e' src/skills/svg-authoring/SKILL.md` -> /^[1-9]/

## Decisions

| ID | ownership | resolved by | decision | evidence | revisit if |
|---|---|---|---|---|---|
| D1 | reversible-technical | evidence | `near-white-hole` is decided by source pixels when a registered raster is given and emits no warning without one | Measurements: 6 findings on owner-chosen paint, 0 on the rejected trace; the rule's own message is conditional on "if the source shows a hole" (`uiRenderAsset.ts:1083`) | a planted hole without a source is missed in a real run |
| D2 | reversible-technical | agent | Regions default to top-level `<g id>` boxes; no new CLI flag | the hand-built file already names its parts as top-level groups (`hat`, `head-group`, `arms`, `legs`); a flag would be one more input nobody passes | a real file's top level is a single wrapper group |
| D3 | reversible-technical | evidence | The cost reading is reported and not gated | no threshold was measured; the accepted hand-built figure is 59 KB and the accepted mark 4.6 KB, a 13x spread for files the owner accepted | a measured edit-cost threshold exists |
| D4 | reversible-technical | evidence | No session artwork is committed; every fixture is a synthetic replica | the files are the owner's brand artwork; `road-to-svg-review-followups` 3.2 already rules out third-party files for the real set | the owner publishes the artwork under a licence that allows it |
| D5 | reversible-technical | evidence | Construct-over-underlay is the default deliverable for a conversion | both sessions ended on construction: the mark at 4.6 KB after the 49.5 KB trace was sent back, the mascot hand-built after 15+ scored trace passes | an owner accepts a trace as the final deliverable twice |

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-10-11 | reviewer: claude -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | A false-positive fix hides a true finding | implementation | Gating 1.1 on duration or 1.2 on source evidence silences the planted rows the promotion bar counted | The existing planted rows keep their expected finding in the same test run; 1.2's planted row gains a source rather than losing its expectation | Phase 1 — The witness stops warning about what is not there |
| 2 | The raster verdict is tuned to pass the session's files | implementation | 2.1 is adjusted until the owner's trace passes, which is fitting the checker to one case | 2.1's fixture is synthetic and its expected verdict is written before the change; the session's files are re-read only as a cross-check, never as the target | Phase 2 — The raster comparison passes what was accepted |
| 3 | The seam reading flags every anti-aliased edge | implementation | Pixels inside the silhouette near the dark ground include legitimate edge blending | The count excludes the anti-alias band already computed by the comparison and is pre-registered against the overlap twin | Phase 4 — Seams, dark grounds and small sizes |
| 4 | "Construct by default" is read as "never trace" | product | The skill loses the measured alignment step and drawing by eye returns, which S1-S4 measured at 0.883 IoU | 5.1 keeps the trace as the measured underlay and states the score's role; the eye-drawn failure stays quoted | Phase 5 — The owner skill teaches what was accepted |
| 5 | The plateau rule ends a loop the owner wanted to continue | product | A 5 % threshold stops passes the owner would have paid for | The rule surfaces the options rather than ending the task, and an explicit owner budget wins | Phase 5 — The owner skill teaches what was accepted |

## Acceptance Criteria

- [x] AC-1 — A non-animated SVG delivered through `<img>` reads no motion
      finding, and a white region reads as a hole only where a registered
      source shows background there.
- [x] AC-2 — A registered raster of the reference vector, with neighbours and a
      glow in the frame, compares as `pass`; a source cut by its frame is a
      finding; per-group regions name the worst part.
- [x] AC-3 — A degenerate gradient is a static finding, and every asset
      manifest carries a cost reading that no gate reads.
- [x] AC-4 — Background bleed inside a silhouette and a mark below 3:1 on a
      capture's ground are engine findings, and a mark has 16 and 32 px
      captures.
- [x] AC-5 — The skill's conversion branch defaults to construct over a traced
      underlay, crops with margin, stops on a plateau, snapshots every
      delivered pass, names variants and outlined fonts, and records the
      registration and scorer of every number it reports.
