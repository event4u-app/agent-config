---
complexity: lightweight
status: ready
execution:
  mode: phase-checkpoints
capability_gap: svg-rules-unreachable-from-the-design-pass
relates:
  - slug: road-to-svg-with-a-witness
    relation: supersedes
    note: "In part only. Archived. Its step 1.4 and AC-5 are carried here, with the measurement and the council verdict that withdrew them. Everything else that roadmap built — the planted corpus, the static witness, the engine witness, the owner skill, the routing split, the measured outcome and the five end-to-end runs — landed and is not reopened."
estate_offset_exempt: "Adds one active roadmap while the change that adds it archives two, so the active count moves from 19 to 18. It cannot fold into an existing roadmap: the parent is archived and complete apart from the carried step, and no other active roadmap owns a hook-packaging surface."
---

# Road to SVG rules in the dispatch path

> **Source:** step 1.4 and AC-5 of `road-to-svg-with-a-witness`, implemented,
> measured, independently reviewed and withdrawn inside the change that built
> the rest of that roadmap. The measurement and the verdict are below; nothing
> here is a plan written against an unexamined idea.

## Goal

An `.svg` write reaches the SVG rules through the design pass — inside or
outside a UI tree — without the single bundle every hook event loads growing by
the whole rule set. Either a loading strategy that charges the bytes only to the
events that use them, or a budget change an independent party ratified on
corrected numbers and runtime evidence. Not the goal: changing what the rules
say, widening `UI_EXTENSIONS`, or re-deciding anything else the parent settled.

## Context — what was measured, and what was refused

The rules exist and work: `src/scripts/_lib/svg_rules.ts` is shipped, exercised
by a planted-defect corpus, and reachable today through `lint_svg_asset`. What
is missing is only the hook routing.

| Reading, taken on `feat/svg-with-a-witness-20261011` | Bytes |
|---|---|
| `dist/hooks/dispatch.js` with no SVG import | 1,530,905 |
| With the whole `lint_svg_asset` module imported | 1,571,574 |
| After splitting the rules out of the CLI, still statically imported | 1,562,931 |
| Ceiling | 1,550,000 |

So the rule set costs **30,924 bytes** statically imported — not the 12,931 the
first proposal claimed, which was the ceiling overage rather than the cost. Two
independent reviewers caught that error before it landed.

**The verdict.** An AI council of two providers reviewed a proposed raise to
1,575,000 on 2026-10-11, two rounds, peer review, blind chairman, 2/2 present,
subscription transport, nothing billed. Both seats converged: authority
`confirmed-non-expanding`, engineering **refused**. Both named the same
sequencing — extract the rules, settle the loading strategy with a prototype and
runtime measurements, ratify any budget change on corrected numbers, and enable
the routing last. The step was withdrawn rather than pushed through; this
roadmap is the rest of that sequence.

Both seats also rejected the alternative as it had been dismissed. The proposal
refused dynamic loading on the grounds that a consumer install has no TypeScript
source — which is true and is not the question. The question is whether a
compiled chunk can be emitted beside `dist/hooks/dispatch.js` and imported only
when the written path ends in `.svg`. That has not been tried.

## Phase 0 — Make the alternative decidable

- [x] **0.1 Prototype a conditional chunk.** Emit the rule set as a second
      esbuild output beside the dispatch bundle and import it from the design
      pass only when the target path ends in `.svg`. Record what breaks rather
      than whether it feels right: the current build uses `--outfile`, which
      cannot code-split, so this is a second invocation plus a shipped file, and
      the failure modes to capture are a missing chunk in a consumer install,
      path resolution from a bundle whose own location is resolved through a
      banner, and the four bundle gates that read the output.
      verify: `./scripts-run src/scripts/check_hook_bundle_composition` -> 0
- [x] **0.2 Measure both strategies at runtime, not in bytes.** Cold-start and
      steady-state dispatch for a non-`.svg` event and for an `.svg` event,
      under static inclusion and under the chunk, from the same tree. Bytes were
      the only axis the refused proposal carried, and both reviewers said so.
      verify: the readings land in `agents/evidence/analysis/` with the command
      that produced each one.
- [x] **0.3 Prove a rule failure cannot reach an unrelated event.** An import
      that throws, a top-level side effect, or a rule that loops must not break
      a hook event that never touched an `.svg`.
      verify: `npx vitest run tests/scripts/design_pass_svg.test.ts --reporter=verbose` -> /✓.*rule-failure-does-not-reach-an-unrelated-event/ <!-- ref-ignore -->

## Phase 1 — Choose, and record the choice

- [x] **1.1 Pick the loading strategy on the readings.** If the chunk is
      reliable and its first-use cost is small against a dispatch, take it and
      no budget changes. If it is not, the static import needs a ratified raise
      carrying the 30,924-byte attribution from an esbuild metafile, the
      prototype's failure, the runtime readings, and a headroom figure derived
      from a supported build matrix rather than from a round number.
      verify: the decision is recorded in this roadmap's Decisions table with
      the reading that settled it.
- [x] **1.2 Enable the routing.** An `.svg` write receives `lint_svg_asset`
      findings from the design pass, inside or outside a UI tree. `isUiWrite`
      stays unchanged for `.svg` paths in both directions — the predicate is not
      the mechanism, and widening it would nudge UI routing on every asset
      write.
      verify: `npx vitest run tests/scripts/design_pass_svg.test.ts --reporter=verbose` -> /✓.*svg-write-gets-svg-rules-and-no-new-nudge/ <!-- ref-ignore -->
- [x] **1.3 Define the rollback before it is needed.** What reading reverts
      this — dispatch latency, a failure rate, a false-positive report — and the
      mechanism that reverts it. A statically bundled rule set is not switched
      off by a config flag, which is the gap the review named.
      verify: the triggers and the mechanism are stated in this roadmap and in
      the design pass's own header.

## Rollback — the triggers, and the mechanism (1.3)

Written down before it is needed, because the review that withdrew the first
attempt named exactly this gap: a statically bundled rule set has no off
switch. The chunk does, and that is half of why it won.

**Revert when any of these is read:**

- the composition gate exceeds its ceiling attributable to this routing
  (`./scripts-run src/scripts/check_hook_bundle_composition`; 2,128 B
  attributable on 2026-10-11, 16,910 B of headroom left);
- a non-`.svg` hook event is observed failing with a stack through the chunk —
  `design_pass_svg.test.ts > rule-failure-does-not-reach-an-unrelated-event`
  exists to make that impossible, so one observation is enough;
- an operator reports SVG false positives on files they accept, at a rate that
  would make them switch the carrier off. This is Risk 1 of the parent roadmap
  and the failure the whole concern is shaped around.

**The mechanism, in increasing order of blast radius:**

1. Delete `dist/hooks/svg_rules.chunk.cjs`. The loader returns `null`, the pass
   reports `verification: degraded` naming the missing file, and no other
   finding family is affected. Per-install, no rebuild, no code change.
2. Drop `isSvgAsset` from `isUiSurface` in `design_pass_hook.ts`. An `.svg`
   outside a UI tree stops reaching the pass; one inside it reads as it did
   before this step.
3. `hooks.design_pass.enabled: false`, which is already the default.

The same three are stated in `design_pass_hook.ts`'s own header, so an operator
reading the code reaches them without finding this file.

## Blockers

### Blocker: the loading strategy is unresolved

- **Status:** resolved
- **Resolved:** 2026-10-11 — branch (a), the conditional chunk, on the Phase 0
  readings. Both limbs of the condition below hold: 1.1 is `[x]`, and
  `check_hook_bundle_composition` exits 0 at 1,533,090 B / 1,550,000 B on the
  tree that carries the chunk, with
  `grep -c 'svg-structure-dangling-reference' dist/hooks/dispatch.js` = 0 and
  the same grep against `dist/hooks/svg_rules.chunk.cjs` = 2 — so the gate's
  green describes a tree where the rules are routed and are not in the shared
  bundle, which is what the earlier wording could not distinguish. No budget
  change was taken, so (b) was never reached and AC-4 is vacuous by
  construction.
- **Owner:** whoever executes Phase 0
- **Blocks:** 1.2, 1.3. Narrowed from `1.1, 1.2, 1.3` on 2026-10-11 by
  `/roadmap:resolve-blockers`: 1.1 **is** the choice this entry records, so
  blocking it made the entry unclosable by construction. Phase 0 was never
  blocked and is the work this entry waits on.
- **What to do:** pick exactly one — (a) prototype the conditional chunk per
  0.1, measure per 0.2, and choose on the readings; or (b) declare the chunk out
  of scope with the reason recorded, and take the static import to an
  independent ratification carrying the corrected 30,924-byte attribution and
  the runtime readings. **(b) is not reachable today**: D1's own reopening
  condition names a prototype and runtime readings, so 0.1 and 0.2 are owed
  under either branch, and (b) becomes a live option only once 0.1 records a
  failure that is itself the reason to carry it (D4).
- **Resolved when:** both limbs hold —
  `grep -c '^- \[x\] \*\*1.1 Pick the loading strategy' agents/roadmaps/road-to-svg-rules-in-the-dispatch-path.md`
  returns 1, and `./scripts-run src/scripts/check_hook_bundle_composition`
  exits 0 on the tree that carries the chosen strategy. Rewritten 2026-10-11 by
  `/roadmap:resolve-blockers`: the earlier condition was the byte check alone
  qualified by "with the routing enabled", which that command does not measure —
  it reads bytes and module count. Executed on this tree it exits 0 while
  `grep -c 'svgRules' dist/hooks/dispatch.js` returns 0, so the condition read
  `met` with nothing done.
- **Recommendation:** (a). The refused proposal never tried it, both reviewers
  asked for it by name, and it is the only option that charges the bytes to the
  events that use them.
- **If you do nothing:** the rules stay reachable only through
  `lint_svg_asset`, so an agent that writes an `.svg` gets no finding unless it
  runs the linter itself — which is the gap the parent roadmap set out to close.

## Carried review findings

Four findings from the R2 completion review of the parent change are carried
here rather than closed in it, each with the reason the same diff was the wrong
place for it. The other nine were fixed there.

- [ ] **2.1 The icon reference set reads only `d` coordinates.** A reference
      drawn with `<rect>`/`<circle>`/`<line>` yields no finite extent, is
      dropped silently, and the reading then reports that no reference set was
      supplied although one was; the same regex reads relative commands as
      absolute. The reading degrades to `unverified` rather than to a pass, so
      no verdict is wrong today.
      verify: `npx vitest run tests/cli/ui_render_asset_profile.test.ts --reporter=verbose` -> /✓.*primitive-drawn-reference-is-read/ <!-- ref-ignore -->
- [ ] **2.2 Candidate and reference padding are measured by different
      methods.** The candidate's comes from a rendered box that includes half
      the stroke and the caps; the reference's from raw centreline coordinates.
      A candidate matching the reference exactly measures one half-stroke less.
      Latent rather than live: the engine suite is green on the shipped pair.
      verify: `npx vitest run tests/cli/ui_render_asset_profile.test.ts --reporter=verbose` -> /✓.*padding-is-measured-the-same-way-on-both-sides/ <!-- ref-ignore -->
- [ ] **2.3 The content-level rules read commented-out markup.** `parseElements`
      strips comments; the regex rules do not, so a commented `url(#x)` marks a
      `<defs>` entry used and a commented media query suppresses the
      no-reduced-motion rule. Fixing it touches every content-level rule.
      verify: `npx vitest run tests/scripts/lint_svg_asset.test.ts --reporter=verbose` -> /✓.*a-commented-out-reference-is-not-a-reference/ <!-- ref-ignore -->
- [ ] **2.4 `Registration.scale` is parsed and read by nothing.** It is
      validated and recorded in the manifest, so `@2` is a silent no-op while
      `@0` makes the comparison report a missing registration that was in fact
      supplied. Using it changes a measured comparison and owes its own
      re-measurement.
      verify: `npx vitest run tests/cli/ui_render_asset_profile.test.ts --reporter=verbose` -> /✓.*a-declared-scale-changes-the-reading/ <!-- ref-ignore -->

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-10-11 | reviewer: claude -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | A missing chunk fails silently in a consumer install | implementation | The dispatch bundle resolves its own location through a banner; a sibling file that is not packed, or is packed to a different path, would make every `.svg` write fail or silently skip | 0.1 captures the failure mode rather than assuming it; the pack whitelist is part of the prototype, not an afterthought | Phase 0 — Make the alternative decidable |
| 2 | The chunk's first-use cost is worse than the bytes it saves | implementation | A one-time parse paid on the first `.svg` write could exceed the per-dispatch cost of 30,924 bytes if `.svg` writes are frequent | 0.2 measures both, on the same tree, before 1.1 chooses | Phase 0 — Make the alternative decidable |
| 3 | A rule failure reaches an unrelated hook event | implementation | The rules enter the process that handles every hook event; an import-time throw or a loop would break events that never touched an `.svg` | 0.3 proves containment before 1.2 enables anything | Phase 0 — Make the alternative decidable |
| 4 | A second ratification attempt repeats the first one's error | product | The refused proposal misattributed the cost by 138 %; a re-submission that carries the same framing wastes a review round and erodes the gate | 1.1 names the metafile as the source of the attribution, so the number comes from the bundler rather than from arithmetic on two totals | Phase 1 — Choose, and record the choice |
| 5 | The ceiling becomes a precedent for bundling any domain concern | product | Both reviewers named this: approving one domain-specific rule set into universal dispatch makes the next one easier, and five iterations later every hook event pays for concerns it never uses | 1.1 prefers the strategy that does not grow the shared bundle; a raise, if taken, records that it does not authorise the next one | Phase 1 — Choose, and record the choice |
| 6 | A carried review finding is read as closed because it is listed | implementation | Four R2 findings are carried here rather than fixed in the parent change; a reader who sees them in a roadmap can take the listing for a disposition | Each carried step names the reason the same diff was the wrong place for it, and the findings artefact records the same four as `open` with that reason — the two agree or one of them is wrong | Carried review findings |
| 7 | A latent false positive becomes live when the fixture changes | implementation | The padding method mismatch (2.2) does not red today only because the shipped icon pair happens to sit outside the band; a new icon fixture at a different stroke width would make it fire on a clean twin | 2.2 fixes the measurement rather than the threshold, and its verify names a case that pins both sides reading the same way | Carried review findings |

## Decisions

| ID | ownership | resolved by | decision | evidence | revisit if |
|---|---|---|---|---|---|
| D1 | reversible-technical | council:2026-10-11 anthropic+openai 2/2 | The static import does not land on the measurement as first framed | AI council 2/2, 2026-10-11, two rounds, peer review, blind chairman, subscription transport, $0.0000: authority `confirmed-non-expanding`, engineering refused, both seats naming the same sequencing | a prototype and runtime readings answer what the refusal asked for |
| D2 | reversible-technical | evidence | The rule set is split from its CLI regardless of which strategy wins | the split reclaimed 8,643 bytes and one reviewer endorsed it independently of the ceiling question | the CLI and the rules are shown to need each other |
| D3 | reversible-technical | evidence | `UI_EXTENSIONS` is not the mechanism, under either strategy | it also gates `ui_route_nudge_hook`'s `isUiWrite`, so widening it spends tokens on every asset write in the tree | an `.svg` write outside a UI tree is shown to need UI routing |
| D4 | reversible-technical | evidence | The 0.1 prototype is owed under both branches, so (b) is not a choice available before Phase 0 runs | D1's reopening condition reads `a prototype and runtime readings answer what the refusal asked for`; (b) proposes a ratification without the prototype, which is the framing both seats refused on 2026-10-11 | 0.1 records a failure that makes the chunk unbuildable in a consumer install, which is then itself the recorded reason (b) carries |
| D5 | reversible-technical | evidence | **The conditional chunk (a) is the loading strategy.** The rule set ships as `dist/hooks/svg_rules.chunk.cjs`, `require`d only for a path ending in `.svg`; no ceiling change is taken | `agents/evidence/analysis/svg-rules-loading-strategy-2026-10-11.md`. Bundle: 1,533,090 B with the routing against 1,530,962 B without and 1,562,800 B statically — 2,128 B rather than 30,924 B, leaving 16,910 B of headroom. Runtime, n=21 cold starts each: `.svg` event 33.47 ms (chunk) against 33.35 ms (static), bands overlapping; non-`.svg` event 29.55 ms against 30.38 ms, so the chunk is 0.83 ms FASTER on the dispatch that does not use the rules. The chunk's own first `require` is 1.896 ms and is repaid by the 29 KB the static bundle parses first | `.svg` writes come to dominate the event mix AND the first-require cost rises enough to invert the `.svg` row, both measured on the same tree |

## Acceptance Criteria

- [x] AC-1 — An `.svg` write receives `lint_svg_asset` findings from the design
      pass, inside and outside a UI tree, and `isUiWrite` is unchanged for
      `.svg` paths in both directions.
- [x] AC-2 — `check_hook_bundle_composition` exits 0 with the routing enabled,
      and the reading is recorded with the strategy that produced it.
- [x] AC-3 — A rule failure is shown not to reach a hook event that never
      touched an `.svg`.
- [x] AC-4 — If a budget change was taken, its attribution comes from an esbuild
      metafile and an independent party ratified it on that number. Satisfied
      vacuously: D5 took the chunk, no budget change was proposed, and the
      ceiling in `src/config/hook-bundle-budget.json` is byte-identical to
      what it was before this roadmap.
