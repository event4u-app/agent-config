---
complexity: lightweight
status: ready
execution:
  mode: phase-checkpoints
relates:
  - slug: road-to-svg-with-a-witness
    relation: extends
    note: "Amends it (the closed relation set has no 'amends'). Every step here names the step, AC or line of that roadmap it corrects and the corrected wording; that roadmap is not edited now because its risk review is stamped 2026-10-11 and a heading, checkbox or AC change would make the stamp stale. Its executor reads this roadmap first and applies each amendment at the step it names."
  - slug: road-to-svg-in-the-authorities
    relation: extends
    note: "Amends its Phase 0 parser wording (1.1 here). Same reason for not editing it today; same read-this-first instruction for its executor."
estate_offset_exempt: "Carries review amendments to two roadmaps whose risk review was stamped the day they merged; folding the amendments into them now would stale that stamp, and there is no other roadmap that owns either surface, so there is nothing to offset against."
---
# Road to SVG review follow-ups

> **Source:** two external reviews of PR #2298 (2026-10-11)

## Goal

Every follow-up the two reviews raised against `road-to-svg-with-a-witness`
(W) and `road-to-svg-in-the-authorities` (A) is either carried as a concrete
amendment — which W/A step, AC or line it changes, the corrected wording, and a
check that can fail — or declined in Decisions with the evidence that refutes
it. When W and A are executed with these amendments applied, a bare
`ui:render` call on a host without a browser cannot satisfy the turn-end gate,
`verified` never reads as "the user's goal is met", the static witness reads
SVG structure from a parse tree rather than from text patterns, the 3000×
scenario runs on a bounded surface, and the measured outcome is reported on
real SVGs as well as on planted ones.

## Context

**Read order.** Executors of W and A read this roadmap first. W and A are not
edited today: both carry `reviewed: 2026-10-11` in their risk register, and a
phase-heading, checkbox-count or Acceptance-Criteria change would make
`lint_plan_risk_register` report the review as stale. Each step below states
the W/A location it amends; the amendment is applied when that W/A step is
executed, and this roadmap's step is closed when its own `verify:` passes.

**Recommended execution order** (D1): A → W Phase 0-2 → W Phase 3-4 → W Phase
5-6. This is consistent with W's own `depends:` (W:7, scoped to Phase 3 by the
note at W:11): A must land before W Phase 3, and W Phase 0-2 may run beside A.

### Claims checked against the tree (`main@fd02787ef`)

| # | Review claim | Reading | Verdict |
|---|---|---|---|
| C1 | `ui:render` exits 0 on the absence path | `src/cli/commands/uiRender.ts:158-160`: "Exit 0, deliberately", after writing `verification: 'unverified'` at `:150` | confirmed |
| C2 | Teaching `isVerificationCommand` the command would let an empty render pass | `src/scripts/hooks/turn_end_gate_hook.ts:764`: the transcript path accepts any segment `isVerificationCommand` matches, with no exit code; `:745-759`: only the record path reads the outcome. A non-zero exit alone closes the record path, never the transcript path | confirmed, and narrower than stated: both exits are needed |
| C3 | `verification_command.ts:78-93` does not know `ui:render` | `VERIFY_BINARIES` at `src/scripts/_lib/verification_command.ts:79-94` lists test, type and lint binaries; 0 hits for `ui:render` in the file | confirmed |
| C4 | A 0.2's rule cuts `-> /a\/ b/` at the escaped slash | A:89-92 says "the first closing `/` that is followed by whitespace or the end of the text"; in `/a\/ b/` the `/` after `\` is followed by a space, so the regex would end as `a\`. Today's form is `\S+` (`src/scripts/_lib/verify_clause.ts:147`) | confirmed |
| C5 | Device-scale 1000× and 3000× cannot screenshot a 512 px tile | R-Z1 below | confirmed |
| C6 | A `viewBox` window gives a 1 px transition | R-Z2 below | confirmed on a committed file |
| C7 | W:99 reads as a global 0.3 fill ratio | W:98-99 "fill ratio is per class (0.3)"; W 0.3 (W:190) says "Fill-ratio thresholds per asset class, never global" | confirmed — wording only |
| C8 | Phase 6 says five tasks while six scenarios exist | W:422 "Five end-to-end tasks", W:427 "checks all five", AC-11 at W:586 "6.1 (both sub-cases), 6.2, 6.3, 6.4 and 6.5"; 6.1(a)/(b) are one step | not an inconsistency inside W — declined (D4) |
| C9 | W 3.6's verify only greps prose | W:392 greps `read\sback|re-open` in the skill text | confirmed; the behavioural proof is W 6.5 (W:462-467) — declined as a change (D5) |
| C10 | No new browser or SVG dependency; reuse Playwright | W 2.3 (W:283-284), E9 (W:481), Non-goals (W:495) already say so | already satisfied (D6) |
| C11 | A regex static check cannot prove nesting or references | `package.json` runtime dependencies have no XML parser; `happy-dom` is dev-only (`src/scripts/_lib/reddit_thread_parse.ts:24` records the same constraint); the vendored tree-sitter grammars are php, typescript and javascript only (`src/vendor/grammars/README.md`); Playwright is absent in a consumer (C1), so it cannot carry the static layer | confirmed — 3.1 |
| C12 | E9's "nothing told it the repo ships Chromium" only holds in this checkout | the conversion session ran in the agent-config checkout (its transcript lives under that project's directory); a consumer has no Playwright (W 2.3) | E9 stands for its context; the consumer lesson is added (4.2) |

### Reproduction of the 3000× scenario (offline, 2026-10-11)

Run through the repo's own `@playwright/test` Chromium 151.0.7922.34, every
non-`file:`/`data:` request aborted, all output under `agents/runtime/tmp/`,
on the committed `site/public/favicon.svg` (32-unit viewBox; rendered at
512 px, 16 px per unit).

| # | Probe | Observed |
|---|---|---|
| R-Z1 | `deviceScaleFactor` 1000 and 3000, clip of 512/scale CSS px | both abort: `Cannot take screenshot with 0 width` |
| R-Z2 | 512 px window, `viewBox` width 512/3000/16 units, centred on the outer edge of the check-mark stroke (interior to the graphic) | vector: luminance 40 → 184 across the row, **1 px** between 10 % and 90 % of the span |
| R-Z3 | same window over a 512 px raster of the same file embedded as `<image>` | raster: the row spans only 101 → 112 — the edge ramp is wider than the whole window; 188 px of the row sit inside that partial ramp |
| R-Z4 | same as R-Z2/R-Z3, but centred on the rect's own left edge at x = 0 | vector **and raster** read 0 px: the edge coincides with the embedded image's bounds, so a raster also reads sharp |

R-Z4 is a constraint the amended 6.3 carries: the probed edge must lie inside
the graphic, never on the bounds of an embedded image, or the scenario cannot
tell a vector from a raster. R-Z3 says the transition count alone misleads; the
check must also require the full contrast to appear inside the window.

## Phase 1 — The authorities roadmap's parser rule

- [x] **1.1 Amend A 0.1 and A 0.2: the regex ends at the first UNESCAPED `/`.**
      A 0.2 (A:89-92) corrected wording: "The backticked tail accepts a
      slash-delimited regex up to the first unescaped closing `/` — one not
      preceded by an odd number of backslashes — that is followed by
      whitespace or the end of the text." A 0.1 (A:82-87) gains a second case
      in its own test file beside it, red before 0.2 like the first: a backticked
      clause ending in `-> /a\/ b/` parses to `{ kind: 'regex', source: 'a\/ b' }`.
      A's Risk 1 (A:188) mitigation reads "first unescaped `/`" in the same
      edit. C4.
      verify: `npx vitest run tests/scripts/_lib/verify_clause_escaped_slash.test.ts --reporter=verbose` -> /✓.*backticked-form-keeps-an-escaped-slash/ <!-- ref-ignore -->

## Phase 2 — Status, gate and goal (W 2.3, 3.1, 3.5, AC-9)

- [x] **2.1 Amend W 3.5 and W 2.3: the gate reads the render, never the
      call.** Both exits from C2, because either alone leaves one gate path
      open. (a) W 2.3 (W:282-286) corrected: "No Playwright → `verification:
      unverified`, and the **asset** profile exits non-zero with a code
      distinct from an internal error; the page profile keeps its exit 0
      (`uiRender.ts:158-160`). Every `unverified` manifest carries a
      machine-readable `reason` beside the prose `degradation_reason`
      (`uiRender.ts:150-153` writes only the prose today): `renderer-absent`
      for the missing devDependency, `render-failed` for a renderer that ran
      and failed, `pass-cap-reached` for 2.2." (b) W 3.5 (W:377-384)
      corrected: "`isVerificationCommand` learns neither `ui:render` nor
      `xmllint`. Every `.svg` edited in the turn whose current digest has no
      matching manifest yet is an open SVG obligation — not only the turn's
      last edit, so an `.svg` → `.html` sequence stays covered. The detector
      discharges an obligation on exactly one of two records, on the record
      path and the transcript path alike: (1) an asset manifest under
      `agents/runtime/state/render/` with `verification: verified` and a
      digest equal to the file's current digest; or (2) an asset manifest
      with `reason: renderer-absent` **and** a `lint_svg_asset` run recorded
      on the same digest with 0 error findings, which the turn records as
      `static-only`. Unrelated verification commands (a test run, a linter on
      other files) never discharge an SVG obligation." W AC-9 (W:579-581)
      reads "the turn-end gate accepts an `.svg` edit only on a verified,
      digest-matching asset manifest, or on a renderer-absent manifest plus a
      clean static witness on the same digest" instead of "counts the asset
      render". Path (2) is why a consumer without Playwright is not refused
      forever on a blocking gate (`hook_manifest.yaml`, `turn-end-gate`,
      `severity: blocking`) and why 4.2's static-only path is reachable; a
      `render-failed` manifest discharges nothing. The negative cases: a bare
      `ui:render --profile asset` call with nothing else is refused; a
      `vitest` or `eslint` run after an `.svg` edit is refused; a
      renderer-absent manifest whose static witness reports an error is
      refused. Four precisions, from a third review:
      (i) **One record, not two.** On the renderer-absent path the asset
      profile runs W 1.1's static witness itself and writes
      `static: { errors: <n>, digest: <sha> }` into the same manifest, so path
      (2) reads one file and never depends on how a separate lint run is named
      or stored — W 1.1 alone writes findings to stdout only.
      (ii) **Planted fixtures are not obligations.** An `.svg` under
      `tests/design-artifacts/fixtures/**` or
      `tests/design-artifacts/scenarios/**` opens no SVG obligation: W 0.1's
      planted files carry errors on purpose and can never reach `verified`, so
      without this exemption every turn that creates or edits the fixture is
      refused on a blocking gate. The exemption is by path, not by inline
      ignore markers, because a marker would hide the planted error from the
      very test that must find it.
      (iii) **A manifest counts only if this turn's render wrote it.** On the
      record path the recorder proves an `ui:render` invocation after the
      edit; on the transcript path a matching `ui:render --profile asset`
      Bash call after the edit must be present. A manifest written by hand
      (an agent `Write` under `agents/runtime/state/render/`, digest
      included) discharges nothing.
      (iv) **A deleted `.svg` opens no obligation** — it has no current digest.
      verify: `npx vitest run tests/scripts/turn_end_gate_svg_render.test.ts -t bare-asset-render-without-playwright-is-refused --reporter=verbose` -> /✓.*bare-asset-render-without-playwright-is-refused/ <!-- ref-ignore -->
      and `npx vitest run tests/scripts/turn_end_gate_svg_render.test.ts -t svg-edit-accepted-on-verified-matching-digest --reporter=verbose` -> /✓.*svg-edit-accepted-on-verified-matching-digest/ <!-- ref-ignore -->
      and `npx vitest run tests/cli/ui_render_asset_profile.test.ts -t asset-profile-exits-nonzero-on-unverified --reporter=verbose` -> /✓.*asset-profile-exits-nonzero-on-unverified/ <!-- ref-ignore -->
      and `npx vitest run tests/scripts/turn_end_gate_svg_render.test.ts -t renderer-absent-plus-clean-static-witness-is-static-only --reporter=verbose` -> /✓.*renderer-absent-plus-clean-static-witness-is-static-only/ <!-- ref-ignore -->
      and `npx vitest run tests/scripts/turn_end_gate_svg_render.test.ts -t unrelated-check-does-not-discharge-svg-edit --reporter=verbose` -> /✓.*unrelated-check-does-not-discharge-svg-edit/ <!-- ref-ignore -->
      and `npx vitest run tests/scripts/turn_end_gate_svg_render.test.ts -t svg-then-html-edit-keeps-the-svg-obligation --reporter=verbose` -> /✓.*svg-then-html-edit-keeps-the-svg-obligation/ <!-- ref-ignore -->
      and `npx vitest run tests/cli/ui_render_asset_profile.test.ts -t renderer-absent-manifest-carries-static-digest --reporter=verbose` -> /✓.*renderer-absent-manifest-carries-static-digest/ <!-- ref-ignore -->
      and `npx vitest run tests/scripts/turn_end_gate_svg_render.test.ts -t planted-fixture-edit-is-no-svg-obligation --reporter=verbose` -> /✓.*planted-fixture-edit-is-no-svg-obligation/ <!-- ref-ignore -->
      and `npx vitest run tests/scripts/turn_end_gate_svg_render.test.ts -t hand-written-manifest-discharges-nothing --reporter=verbose` -> /✓.*hand-written-manifest-discharges-nothing/ <!-- ref-ignore -->
      and `npx vitest run tests/scripts/turn_end_gate_svg_render.test.ts -t deleted-svg-opens-no-obligation --reporter=verbose` -> /✓.*deleted-svg-opens-no-obligation/ <!-- ref-ignore -->
- [ ] **2.2 Amend W 3.1 and W 3.5: `verified` needs a clean witness, and the
      pass cap is never success.** `verified` means a digest-bound render
      manifest (2.1) **and** 0 error findings from W 1.1 and W 2.1 on that
      digest. W 3.1's stop rule (W:328-331) corrected: "stop at a clean
      witness or after three render passes; a stop at the cap with error
      findings open reports `unverified` with the reason `pass-cap-reached`
      and lists the open findings — never `verified`, never done." A fixture
      whose planted error survives three passes pins it. The pass cap is the
      owner skill's behaviour — the renderer knows nothing of passes — so the
      case lives with W's scenarios, not with the render profile's tests.
      verify: `npx vitest run tests/design-artifacts/svg_scenarios.test.ts -t pass-cap-with-open-findings-is-unverified --reporter=verbose` -> /✓.*pass-cap-with-open-findings-is-unverified/ <!-- ref-ignore -->
- [ ] **2.3 A second axis: render status is not goal status.** W 3.1's report
      (W:329-332) and W 3.5 gain a separate field: `goal: unassessed` by
      default, `accepted` or `rejected` only from an owner statement or from a
      Phase 6 scenario's pre-registered witness (W 6.1-6.5). The renderer and
      the owner skill never write `accepted` themselves; the manifest carries
      `goal: unassessed` on every asset render. W AC-9 gains: "a `verified`
      report carries a goal field, and no layer derives `accepted` from a
      digest match."
      verify: `npx vitest run tests/cli/ui_render_asset_profile.test.ts -t renderer-never-writes-goal-accepted --reporter=verbose` -> /✓.*renderer-never-writes-goal-accepted/ <!-- ref-ignore -->
      and, for the owner skill, `npx vitest run tests/design-artifacts/svg_scenarios.test.ts -t skill-never-derives-goal-accepted --reporter=verbose` -> /✓.*skill-never-derives-goal-accepted/ <!-- ref-ignore -->

## Phase 3 — The static witness reads a tree, and is measured on real SVGs

- [ ] **3.1 Amend W 1.1: a structural parse, still dependency-free.** W 1.1
      (W:196-213) corrected: "`lint_svg_asset.ts` builds an element tree with
      a dependency-free XML well-formedness parser (elements, attributes,
      comments, CDATA, processing instructions, DOCTYPE, with line and column)
      in one `src/scripts/_lib/` module; the structure, reference,
      accessibility and motion families read that tree — nesting, parentage
      and `#id` resolution are never decided by a pattern over the raw text.
      A file that is not well-formed is a finding, not a skipped file." W 0.1
      gains three planted rows a text-pattern check misses: a `<use
      href="#a">` whose only `id="a"` sits inside a comment, a CDATA section or
      another attribute's value (dangling); mis-nested tags (`<g><path></g></path>`);
      a `<title>` that is not a direct child of the graphic it names. C11 and D3.
      verify: `npx vitest run tests/scripts/lint_svg_asset.test.ts -t regex-blind-rows-found-by-the-tree --reporter=verbose` -> /✓.*regex-blind-rows-found-by-the-tree/ <!-- ref-ignore -->
- [ ] **3.2 Amend W 0.1, 0.3 and 5.1: a held-out set of real SVGs.** Beside
      the planted fixture, a set of at least six real SVGs under
      `tests/design-artifacts/fixtures/svg-real/` <!-- ref-ignore -->
      covering every asset class: `site/public/favicon.svg`,
      `src/scripts/media/lib/fixtures/recraft/asset-0001.svg`, W 0.1's
      conversion reference vector, and files authored for this set — no
      third-party file. Its expected findings per file are pre-registered in
      the README under 0.3's rule (before any checker), and no rule is tuned
      against it. W 5.1 (W:410-413) reports two tables, planted and real, and
      W 5.2's bar (W:414-420) counts findings on the real set beside the twin
      count.
      verify: `grep -cE '^##\s.*[Rr]eal' tests/design-artifacts/fixtures/svg-assets/README.md` -> /^[1-9]/ <!-- ref-ignore -->
- [ ] **3.3 Fix W:98-99's wording.** "fill ratio is per class (0.3)" →
      "fill-ratio thresholds are per asset class, pre-registered in 0.3's
      table". Prose only; no heading, checkbox or AC moves. C7.
      verify: `grep -c 'per class (0.3)' agents/roadmaps/road-to-svg-with-a-witness.md` -> /^0$/

## Phase 4 — Scenarios and the consumer path

- [ ] **4.1 Amend W 6.3: zoom by `viewBox`, not device scale.** W 6.3
      (W:450-455) corrected: "A 512 px window whose `viewBox` spans
      512/3000 of the intrinsic render's units, centred on an edge interior to
      6.1's output — never on the bounds of an embedded image (R-Z4). The full
      foreground/background contrast appears inside the window and crosses in
      at most 2 px; a control file embedding a raster of the same output fails
      the same check (R-Z3). The file still has 0 `<image>` and no filter that
      rasterises at a fixed resolution." The surface is 512 × 512 px whatever
      the factor. The test name W's verify uses is kept; the control is its
      own case. R-Z1 to R-Z4.
      verify: `npx vitest run tests/design-artifacts/svg_scenarios.test.ts -t raster-control-fails-the-3000x-zoom --reporter=verbose` -> /✓.*raster-control-fails-the-3000x-zoom/ <!-- ref-ignore -->
- [ ] **4.2 Amend W 3.1 and E9: the static-only path is walked cleanly in a
      consumer.** W 3.1 gains: "Where `ui:render` reports the renderer absent,
      the owner runs the static witness, reports `static-only`, names the
      missing capability in one line, and never makes opening the file in a
      browser a step of its procedure or of the user's." E9 (W:481) keeps its
      reading for the agent-config checkout and gains a sentence: in a consumer
      the same session would have no Chromium to be told about, so the lesson
      there is the static-only path, not a pointer to a browser (C12). One
      recorded scenario under W's scenario directory runs the owner with the
      renderer absent.
      verify: `npx vitest run tests/design-artifacts/svg_scenarios.test.ts -t consumer-without-renderer-reports-static-only --reporter=verbose` -> /✓.*consumer-without-renderer-reports-static-only/ <!-- ref-ignore -->

## Decisions

| ID | ownership | resolved by | decision | evidence | revisit if |
|---|---|---|---|---|---|
| D1 | reversible-technical | agent | Recommended order A → W 0-2 → W 3-4 → W 5-6; W 0-2 may run beside A | W:7 and W:11 scope the dependency on A to W Phase 3 | a W Phase 0-2 step is shown to need an A edit |
| D2 | reversible-technical | evidence | Both exits for the gate hole (2.1): asset profile exits non-zero AND the detector reads the manifest; `isVerificationCommand` does not learn `ui:render` | C2: the transcript path at `turn_end_gate_hook.ts:764` never sees an exit code, so a non-zero exit alone leaves it open; a manifest read with a digest closes both paths | the transcript path is retired |
| D3 | reversible-technical | evidence | The static layer gets its own dependency-free XML parser rather than a dependency, a fourth vendored grammar, or the browser | C11; `lint_design_quality.ts:35-42` records the dependency-free stance for the sibling linter; a fourth grammar would be HTML, not XML | a runtime XML parser enters `dependencies` for another reason |
| D4 | reversible-technical | evidence | Phase 6's "five" wording is not changed | C8: heading, body and AC-11 agree inside W; the six-scenario count was in a commit message, which is history | a sixth W Phase 6 step is added |
| D5 | reversible-technical | evidence | W 3.6's prose-grep verify stays | C9: W 6.5 re-opens every delivered file from disk in a fresh context and is the behavioural proof | W 6.5 is cancelled or narrowed |
| D6 | reversible-technical | evidence | "No new dependency, reuse Playwright" needs no amendment | C10 | — |
| D7 | reversible-technical | evidence | `relates:` uses `extends`; `amends` is not a valid relation | `lint_roadmap_complexity.ts:480` lists extends, supersedes, depends, disjoint | the relation set gains an amendment relation |
| D8 | reversible-technical | agent | The pass-cap status is `unverified` with a reason, not a fourth status token; the reason is a machine-readable field (`renderer-absent`, `render-failed`, `pass-cap-reached`) beside the prose `degradation_reason` | 2.1, 2.2: the three tokens W already defines (W:330-331) stay; the gate in 2.1 must tell an absent renderer from a failed render, which the prose field at `uiRender.ts:150-153` cannot carry | a consumer needs to tell the reasons apart by token alone |
| D9 | reversible-technical | agent | This roadmap is temporary: on or after 2026-10-12 its amendments are folded into W and A under a new `reviewed:` stamp, and this file is then archived; the fold is not a checkbox here, because adding one today reds `lint_plan_risk_register` against the same-day stamp | `lint_plan_risk_register.ts:620-625` bases staleness on the commit that introduced the current `reviewed:` value and compares the date only, so a same-day re-review cannot be recorded (Risk 1 names the read-this-first coupling as the weak point); a revision number in the stamp would remove the cause | the lint learns a revision or time component in the stamp, after which a same-day fold is possible |

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-10-11 | reviewer: claude -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | An amendment is missed at W/A execution | implementation | W and A are executed without reading this roadmap, and the holes the reviews found ship | Both `relates:` notes and Context's read-order paragraph say read-this-first; each step names the exact W/A location | Context |
| 2 | The gate change does not fit the hook bundle | implementation | The turn-end gate ships in a size-capped bundle, and a manifest reader grows it | 2.1 measures the bundle before writing; if it does not fit, the step stops and records the measured size rather than raising the cap silently | Phase 2 — Status, gate and goal (W 2.3, 3.1, 3.5, AC-9) |
| 3 | The hand-written parser becomes a second, wrong XML implementation | implementation | A well-formedness parser accepts or rejects files a browser treats otherwise | 3.1's planted rows plus 3.2's real set are parsed by both the parser and Chromium's `DOMParser` in the engine layer; a disagreement is a finding against the parser | Phase 3 — The static witness reads a tree, and is measured on real SVGs |
| 4 | `verified` is still read as success | product | A report saying `verified` is taken as "the graphic is right" | 2.3 puts `goal` beside it and forbids deriving `accepted` from a digest | Phase 2 — Status, gate and goal (W 2.3, 3.1, 3.5, AC-9) |
| 5 | The zoom scenario reads a raster as sharp | implementation | An edge on an embedded image's bounds reads 0 px for a raster too (R-Z4) | 4.1 requires an interior edge, the full contrast inside the window, and a raster control that must fail | Phase 4 — Scenarios and the consumer path |

## Acceptance Criteria

- [ ] AC-1 — A's parser rule names the unescaped `/`, and a clause ending in
      `-> /a\/ b/` keeps `a\/ b` as its regex source.
- [ ] AC-2 — After an `.svg` edit, a turn whose only check is an asset render
      that rendered nothing is refused on both gate paths; a turn with a
      verified, digest-matching asset manifest is accepted.
- [ ] AC-3 — No layer reports `verified` with error findings open or after a
      pass cap was reached with findings, and every asset report carries a
      goal field that no renderer sets to `accepted`.
- [ ] AC-4 — The static witness decides nesting and references from a parse
      tree, finds the three text-pattern-blind rows, and the measured outcome
      is reported on the planted set and the real held-out set separately.
- [ ] AC-5 — W 6.3 runs on a 512 × 512 surface, passes for the vector and
      fails for the raster control.
- [ ] AC-6 — A recorded owner run without a renderer reports `static-only`
      and contains no browser-opening step.
