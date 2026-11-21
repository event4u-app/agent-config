---
complexity: lightweight
status: ready
tree_pin: 811cea61d6
execution:
  mode: autonomous
estate_growth_exempt: "P1 measure 15 of the owner's session retro of 2026-11-21, which the owner ordered planned and executed; no active, parked or stub roadmap owns measure-first visual debugging, zip or Storybook handovers, or a generated UI reference."
estate_offset_exempt: "road-to-ui-fixes-that-measure-first is added on the owner's order of 2026-11-21 to plan every measure of that day's session retro as its own roadmap. No active roadmap is finished, so none was archived to offset it, and folding it into a parked later/ roadmap would hold asked-for work behind that roadmap's entry condition. Owner record: agents/evidence/owner-directives/2026-11-21-session-retro-roadmaps.md."
relates:
  - slug: road-to-repo-knowledge-generated-not-written
    relation: disjoint
    note: "Same-retro sibling (measure 7). This file's `ui_reference.ts` (4.2) is the one scanner for Storybook, UI libraries, handovers and measurement channels; that file's `ui-stack` topic renders from `ui:reference --json` when present rather than scanning a second time. This file writes no knowledge topic file."
  - slug: road-to-a-security-chain-measured
    relation: disjoint
    note: "Stub on a security-audit chain benchmark; shares only the word 'measure'. No UI, design or debugging surface."
  - slug: road-to-ai-employee-borrowings
    relation: disjoint
    note: "Archived; external agent-project borrowings and kernel hardening. 'Measure first' there means telemetry before builds, not visual probing."
  - slug: road-to-conformance-round5
    relation: disjoint
    note: "Archived; post-fix conformance measurement of rounds 1-4. No UI fix path, no design handover."
  - slug: road-to-conformance-round6
    relation: disjoint
    note: "Archived; guard regress and stop-refusal gate. Touches no design-fidelity, debugging-skill or UI-surface file."
  - slug: road-to-inbox-harvest-2026-08-f-code-graph-evidence-refresh
    relation: disjoint
    note: "Archived; code-graph extractor verdict. No UI surface."
  - slug: road-to-orchestrator-first-execution
    relation: disjoint
    note: "Archived; orchestrator-only execution measured from transcripts. No UI surface."
  - slug: road-to-recursive-verification
    relation: disjoint
    note: "Archived honest-null on recursive self-verification. Different mechanism (model recursion), no UI surface."
  - slug: road-to-skill-ecosystem-executable-payloads
    relation: disjoint
    note: "Parked in later/; executable skill payloads. Does not touch systematic-debugging, existing-ui-audit or design-fidelity."
---
# Road to UI fixes that measure first

> **Source:** the owner's session retrospective of 2026-11-21 (~380 Claude Code
> sessions across agent-config, galawork-web, azeroth and others), measure 15
> of its P1 list ("UI: measure first, then fix; the mockup is the spec") and its
> cluster "guessing instead of measuring" (at least 9 chunks). AI council round
> of the same day, members anthropic + openai: anthropic rated measure 15 ready
> for a roadmap; openai raised no objection to it. Incidents cited from the
> retro: a rotation glow fixed twice on an unproven assumption (azeroth); an
> SVG turned black ("look at it yourself", agent-config 10-11); designs from a
> supplied zip ignored (agent-config 10-26); Storybook and the component library
> used only after 4 corrections (galawork-web); "it was more oval earlier" read
> as "make it oval", with invented dimensions (azeroth 11-16). Positive pattern
> from the same retro: probe-first in-game and dev-tracking reports were the
> strongest debug asset in azeroth; smallest exact UI diffs earned the best
> owner reaction.

## Goal

A visual bug is fixed only after a measurement of the rendered state, the
second fix attempt on the same visual symptom is refused without one, a design
handover delivered as a zip or as Storybook stories routes the 1:1 fidelity
floor, a project's UI reference (Storybook, component libraries, handovers,
measurement channels) is produced by a command from the repo instead of a
hand-written context, and a description of an earlier visual state is read as
a regression report rather than as a change request. Every one of these is
pinned by a test that failed before the change.

## Context — what the tree does today (verified at `811cea61d6`)

- `src/rules/design-fidelity.md:7-32` — the trigger set names prototype,
  mockup, Figma, `*design.html`, `*.dc.html` and handover phrasings. **No `zip`
  trigger in any form.** `src/scripts/_lib/ui_surface.ts:105-110`
  (`HANDOVER_SHAPES`) mirrors the four file shapes, again without a zip shape.
  `tests/scripts/design_fidelity_routing.test.ts` (`ROUTING_MATRIX`) carries no
  zip row (grep `zip` → 0 hits).
- `src/skills/existing-ui-audit/references/steps/04b-live-storybook-read.md:3-7`
  reads Storybook **only** through `@storybook/addon-mcp` with a running
  Storybook; otherwise step 4 hand-reads the inventory. A repo with
  `.storybook/` and `*.stories.*` files but no MCP channel gets no
  "stories are the reference" step — the galawork-web case.
- `src/skills/systematic-debugging/SKILL.md:47` — Iron Law "NO FIX WITHOUT ROOT
  CAUSE. NO ROOT CAUSE WITHOUT EVIDENCE". Its `evals/triggers.json` has no
  visual exemplar (grep `glow|render|color|farbe|visual` → 0 hits), and the
  skill names no visual evidence class (computed style, DOM, render at real
  size, in-app probe output).
- `src/agent-src/contexts/communication/rules-auto/think-before-action-mechanics.md:57`
  — the "Frontend/UI" row prescribes Playwright/browser checks **after** a
  change; nothing requires a measurement **before** the first visual fix.
- `src/scripts/_lib/ui_surface.ts:19-31` — `UI_EXTENSIONS` lacks `svg`
  (handled separately by `design_pass_hook.ts` `isSvgAsset`) and has no notion
  of non-web UI trees (a WoW addon's `*.lua`/`*.xml` beside a `*.toc`).
- `src/scripts/hooks/ui_route_nudge_hook.ts:2` — the only pre-write UI
  observer; warn-only, default-OFF, `MAX_NUDGES = 2` (`:54`). It latches skill
  consultation and artifact reads; it observes no measurement event.
- `src/scripts/ui_conformance_probe.ts` exists (Playwright, per-node
  `data-probe-id` comparison) and is the in-tree measurement channel to name.
- `src/rules/question-not-instruction.md` covers question vs instruction; no
  rule covers an **observation of a past state** ("war vorhin mehr oval").
- `.gitignore:219` ignores `/agents/runtime/` — the place a generated cache may
  live without becoming a tracked, hand-maintained file.
- Not in scope, owned elsewhere: done-claims with evidence and live smoke tests
  (retro measure 1, its own roadmap); per-repo context files (retro measure 7;
  the owner's 2026-11-21 constraint forbids hand-written ones, so this roadmap
  generates the UI part by command); the kernel rule `verify-before-complete`
  (immutable; the write guard refused even a grep of it this session).
  Consumer repos (azeroth, galawork-web) are not edited — the package ships the
  mechanism, the consumer's next `agent-config update` receives it.

## Decisions

| ID | ownership | resolved by | decision | evidence | revisit if |
|---|---|---|---|---|---|
| D1 | product-owned | owner | Project UI knowledge is generated by a command from the repo, never authored by a human | owner constraint 2026-11-21 in the retro follow-up | the owner lifts the constraint |
| D2 | deterministic | evidence | No edit to kernel rules; the measure-first obligation lands in skills, auto rules, contexts and hooks | `block-kernel-rule-writes` refused access to `verify-before-complete` on 2026-11-21 | kernel membership changes |
| D3 | reversible-technical | agent | New behaviour checks are warn-only first, never blocking | a false block on clean UI disables the carrier for good (`design_pass_hook.ts` header, Risk 1 of its parent) | the measurement in Phase 5 shows < 5 % false warns over 50 UI sessions |

## Phase 0 — Pin the gaps as failing tests

- [ ] **0.1 Add the zip handover rows to the routing matrix.** In
      `tests/scripts/design_fidelity_routing.test.ts` add to `ROUTING_MATRIX`:
      (a) prompt "Warum hältst Du dich nicht an die Designs aus den Zip Files?"
      → routes `true`; (b) prompt "build the page from designs.zip" → `true`;
      (c) near-miss "zip the build output for the release" → `false`. Rows (a)
      and (b) must fail today, (c) must pass.
      verify: `npx vitest run tests/scripts/design_fidelity_routing.test.ts` -> /failed/
- [ ] **0.2 Add visual exemplars to the debugging trigger evals.** In
      `src/skills/systematic-debugging/evals/triggers.json` add exemplars "der
      Rotation-Glow erscheint nicht, fix das" (de), "why does the SVG icon
      render black?", "the button looks shifted by a few pixels since the last
      change", and the near-miss "make the card corners rounder" (a design
      change, routed to `fe-design`). Update the `description` counts.
      verify: `./scripts-run src/scripts/check_trigger_evals` -> 0
- [ ] **0.3 Build the UI-reference fixtures.** Create
      `tests/fixtures/ui-reference/` with four minimal repos: `storybook-react/`
      (`.storybook/main.ts`, two `*.stories.tsx`, a component-library dependency
      in `package.json`), `wow-addon/` (`Addon.toc`, `Frames.lua`, `Frames.xml`,
      a `dev/Tracking.lua`), `zip-handover/` (`designs/handover.zip` holding an
      `index.html` and a `.png`), `bare/` (no UI signal).
      verify: `test -d tests/fixtures/ui-reference/storybook-react -a -d tests/fixtures/ui-reference/wow-addon -a -d tests/fixtures/ui-reference/zip-handover -a -d tests/fixtures/ui-reference/bare` -> 0

## Phase 1 — Close the contested choices with the council

- [ ] **1.1 Zip trigger shape.** Run `agent-config council:status`; if a
      council is configured, run `agent-config council:run` with the question:
      zip handover as (a) `file_pattern: "*.zip"` on `design-fidelity` plus a
      `HANDOVER_SHAPES` entry, (b) phrase triggers only ("zip" near
      "design"/"Designs"), or (c) a content check that a zip holds
      html/png/svg/fig before it counts. Attach rows 0.1 (a)-(c) and
      `ui_surface.ts:105-110`. Record the verdict as row D4 in `## Decisions`.
      Unreachable council → record `D4 | contested-technical | agent` choosing
      (b), the narrowest, with the reason.
      verify: `grep -n "^| D4 " agents/roadmaps/road-to-ui-fixes-that-measure-first.md` -> 0
- [ ] **1.2 Home of the past-state clause.** Same procedure: does "a
      description of an earlier visual state reports a regression; restore it
      from history, never invent dimensions" belong in (a)
      `src/rules/question-not-instruction.md`, (b) `design-fidelity-mechanics`
      § surgical visual edits, or (c) `think-before-action-mechanics`? Record as
      D5. Fallback without council: (a), because the failure is intent
      misreading, not design.
      verify: `grep -n "^| D5 " agents/roadmaps/road-to-ui-fixes-that-measure-first.md` -> 0
- [ ] **1.3 Measure-first carrier.** Same procedure: extend
      `ui_route_nudge_hook.ts` with a measurement latch, or add a separate
      warn-only concern; and whether it ships default-ON or default-OFF. Attach
      `ui_route_nudge_hook.ts:2-54`, D3 and the retro finding that opt-in
      improvements did not reach consumers. Record as D6. Fallback: separate
      concern, default-OFF.
      verify: `grep -n "^| D6 " agents/roadmaps/road-to-ui-fixes-that-measure-first.md` -> 0

## Phase 2 — Measure before the first visual fix

- [ ] **2.1 Visual evidence classes in systematic-debugging.** Add a
      `## Visual bugs` section to `src/skills/systematic-debugging/SKILL.md`:
      evidence for a visual symptom is one of computed style / DOM read, a
      render at the app's real window size, an in-app probe or dev-tracking
      output, or a `ui_conformance_probe` report. A second fix on the same
      visual symptom without a new measurement artifact is a blind retry. Look
      for a mature reference implementation (vendor sample, existing addon,
      existing component) before inventing one. Rows from 0.2 now route.
      uses: skill-writing
      verify: `./scripts-run src/scripts/check_trigger_evals` -> 0
- [ ] **2.2 Before-the-fix row in the mechanics context.** In
      `think-before-action-mechanics.md:57` split the Frontend/UI row into
      "before a visual fix: measure the rendered state (classes from 2.1)" and
      the existing after-change check. Link `systematic-debugging` § Visual bugs.
      verify: `./scripts-run src/scripts/check_references` -> 0
- [ ] **2.3 Lint the touched skill.** Run the skill linter on the edited skill
      and fix every finding.
      verify: `./scripts-run src/scripts/skill_linter src/skills/systematic-debugging/SKILL.md` -> 0

## Phase 3 — The reference is the spec: zip and Storybook

- [ ] **3.1 Implement D4.** Apply the council's zip shape to
      `src/rules/design-fidelity.md` triggers and, if D4 names a file shape, to
      `HANDOVER_SHAPES` in `src/scripts/_lib/ui_surface.ts`; `design_pass.test.ts`
      pins the two lists in both directions. Rows 0.1 (a)-(c) turn green.
      verify: `npx vitest run tests/scripts/design_fidelity_routing.test.ts tests/hooks/design_pass.test.ts` -> 0
- [ ] **3.2 Storybook without MCP is still the reference.** Add
      `references/steps/04c-storybook-files-read.md` to `existing-ui-audit` and
      its row in `procedure.yaml` and `SKILL.md`: when `.storybook/` or
      `*.stories.*` exist and no MCP channel answers, read the stories of every
      component the change touches before the first write; the stories' args are
      the spec, a prop absent from them is not used. Write the failing procedure
      test first in `tests/scripts/lint_skill_procedures.test.ts`.
      verify: `npx vitest run tests/scripts/lint_skill_procedures.test.ts` -> 0

## Phase 4 — UI reference generated by command, never hand-written

- [ ] **4.1 Failing test for the reference scanner.** Write
      `tests/scripts/ui_reference.test.ts` against the four fixtures of 0.3:
      `storybook-react` → `storybook.present: true`, two stories, the library
      listed; `wow-addon` → `surface_kind: "addon-lua"`, `dev/Tracking.lua`
      listed as a measurement channel; `zip-handover` → the zip listed under
      `handovers`; `bare` → every list empty and `surface_kind: "none"`.
      verify: `npx vitest run tests/scripts/ui_reference.test.ts` -> /failed/
- [ ] **4.2 Implement `src/scripts/ui_reference.ts`.** Pure scan of the repo:
      Storybook config and story count, component libraries from
      `package.json` dependencies that ship stories or match the D4-adjacent
      naming list, handover files (zip / `*design.html` / images under design
      directories), measurement channels (Playwright config,
      `ui_conformance_probe` availability, package/Taskfile/Makefile script
      names matching `probe|track|debug|screenshot|visual|snapshot`, files
      under `dev/` or `debug/` in a non-web UI tree). Output JSON on stdout;
      cache at `agents/runtime/state/ui-reference.json` keyed on `HEAD` SHA.
      verify: `npx vitest run tests/scripts/ui_reference.test.ts` -> 0
- [ ] **4.3 Register `ui:reference`.** Add the case to
      `src/scripts/_dispatch.bash` beside `roadmap:context` (`:1770`) and a help
      line; add a dispatch test case.
      verify: `./agent-config ui:reference --json` -> /"surface_kind"/
- [ ] **4.4 Wire the command into the two skills.** `existing-ui-audit` step
      00 and `systematic-debugging` § Visual bugs run `agent-config
      ui:reference` first and use its `measurement_channels` and `handovers`
      lists; no step asks a human to write a styleguide or context.
      verify: `grep -c "ui:reference" src/skills/existing-ui-audit/references/steps/00-inspect-stack-and-input.md src/skills/systematic-debugging/SKILL.md` -> /:[1-9]/

## Phase 5 — Measure-first nudge, past-state clause, projection

- [ ] **5.1 Failing test for the measure-first nudge.** In the test file D6
      names, assert: a second write to the same UI file in one session with no
      measurement event between (a Bash command matching a channel from
      `ui:reference`, a read of a `*.png`/`*.jpg`, a `ui_conformance_probe`
      run) returns warn; with a measurement event between it returns allow;
      the valve goes silent after `MAX_NUDGES`.
      verify: `npx vitest run tests/scripts/ui_route_nudge.test.ts` -> /failed/
- [ ] **5.2 Implement D6.** Implement the carrier D6 chose, warn-only (D3),
      with its default as D6 recorded. Register it in the hook manifest if it is
      a new concern and run the hook-manifest test.
      verify: `npx vitest run tests/scripts/ui_route_nudge.test.ts tests/hooks/` -> 0
- [ ] **5.3 Failing routing test for the past-state clause.** Write
      `tests/scripts/past_state_observation_triggers.test.ts` with
      `trigger_matches` (`src/scripts/router_telemetry.ts`) on the D5 rule:
      "ich sagte die war vorhin mehr oval" and "it used to be rounder" route;
      "mach sie oval" does not.
      verify: `npx vitest run tests/scripts/past_state_observation_triggers.test.ts` -> /failed/
- [ ] **5.4 Implement D5.** Add the clause and the trigger phrases ("war
      vorhin", "vorher war", "used to be", "was more … earlier") to the file D5
      names: an observation of an earlier state reports a regression; recover
      the earlier value from git history or an earlier render, never invent new
      dimensions; unclear → one question. 5.3 turns green.
      verify: `npx vitest run tests/scripts/past_state_observation_triggers.test.ts` -> 0

- [ ] **5.5 Regenerate the projections.** Run `task sync` and
      `task generate-tools`; then `bash src/scripts/condense.sh --changed` must
      list nothing.
      verify: `bash src/scripts/condense.sh --changed` -> 0
- [ ] **5.6 Targeted suite.** Run every test file this roadmap touched in one
      vitest call; zero failures.
      verify: `npx vitest run tests/scripts/design_fidelity_routing.test.ts tests/scripts/ui_reference.test.ts tests/scripts/ui_route_nudge.test.ts tests/scripts/past_state_observation_triggers.test.ts tests/scripts/lint_skill_procedures.test.ts tests/hooks/design_pass.test.ts` -> 0

## Release outcome

guarded: every phase lands publishable — new behaviour is warn-only (D3), the
nudge ships at the default D6 records, and the scanner is a read-only command;
no intermediate tree state needs a hold.

## Acceptance Criteria

- [ ] AC-1 — A zip design handover routes `design-fidelity`: the zip rows in
      `ROUTING_MATRIX` pass and the release-zip near-miss stays unrouted.
- [ ] AC-2 — A visual-bug prompt in German or English routes
      `systematic-debugging`, whose body names the visual evidence classes and
      calls a second unmeasured fix a blind retry.
- [ ] AC-3 — `agent-config ui:reference` prints Storybook, libraries,
      handovers and measurement channels for each fixture, writes no tracked
      file, and no step in this roadmap asks a human to author context.
- [ ] AC-4 — A repo with Storybook files and no MCP channel gets a
      read-the-stories step before the first UI write.
- [ ] AC-5 — A repeated UI write without a measurement event between earns a
      warn; with one, it is allowed.
- [ ] AC-6 — "war vorhin mehr oval" routes the past-state clause; "mach sie <!-- md-language-check: ignore -->
      oval" does not.
- [ ] AC-7 — `bash src/scripts/condense.sh --changed` lists nothing and the
      targeted suite of 5.6 exits 0.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-11-21 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | Zip trigger over-fires | implementation | A broad `*.zip` shape routes the 1:1 floor on release archives and vendor bundles, adding noise to unrelated sessions | Near-miss row 0.1 (c) is pinned before the choice; council weighs the content-check option | Phase 1 — Close the contested choices with the council |
| 2 | Measure-first nudge is noise | product | A nudge on every second edit of a UI file annoys the owner on intended iterative tweaks | Warn-only (D3), anti-loop valve, measurement events from the generated channel list clear it | Phase 5 — Measure-first nudge, past-state clause, projection |
| 3 | Scanner heuristics miss real channels | implementation | Script-name matching misses a project's probe (an in-game slash command has no script) | Non-web `dev/`/`debug/` tree rule and fixture `wow-addon`; missing channels show as an empty list, never as "none needed" | Phase 4 — UI reference generated by command, never hand-written |
| 4 | Skill text grows without changing behaviour | product | Instruction-only additions repeat the retro finding that `design-fidelity` and `think-before-action` existed and did not bite | Every behaviour step has a failing test first and a hook or routing carrier, not prose alone | Phase 2 — Measure before the first visual fix |
