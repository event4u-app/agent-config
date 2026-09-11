---
complexity: structural
status: ready
execution:
  mode: phase-checkpoints
owner: maintainer
relates:
  - slug: road-to-behaviour-evidence-over-pixels
    relation: disjoint
    note: >
      Same source set. That roadmap needs no declared contract and no lane; this
      one needs no runtime probe. Every phase here is gated on an owner decision
      that one does not need.
estate_growth_exempt: >-
  Receiver for the half of the source set that is gated on a recorded decision rather than on
  missing evidence, so it needs a home where the decision can be posed rather than being lost with
  the inbox round. Verified 2026-09-11: the component-architecture skill states in as many words
  that no ordering is prescribed among stories, component and page, and that a claimed order is a
  preference rather than its instruction; a five-level component taxonomy has exactly one mention
  across `src/` and `docs/` and that mention rejects it. Both are deliberate, and both are what
  this roadmap proposes to reverse. Also grows open_blockers by three.
estate_offset_exempt: >-
  The offset this would naturally take is `agents/roadmaps/stubs/road-to-frontend-power-default-flip.md`,
  which is itself held on an owner-reserved default flip and has been for 19 days — retiring it
  would dispose of the decision this roadmap needs answered. No active roadmap covers component
  contracts or the workshop lane, and the sibling frontend roadmap deliberately excludes both so
  that it can ship without this one.
---
# Road to a declared component contract

> **Source:** `agents/tmp.old/inbox-2026-09-y/t4-ui-contract-frontend/` — three plan revisions, a
> two-member revision set and the originating transcript, analysed 2026-09-11. This roadmap
> carries the half of that set whose every phase is gated on reversing a recorded decision. The
> sibling `road-to-behaviour-evidence-over-pixels` carries the half that is not. One step is
> tagged `corrected-from-reproduction`: the file the source proposes to extend for stack detection
> is a consumer template, not package engine code, and no revision in the set noticed.

## Goal

A managed UI component carries a declared level and an executable contract that exists before a
consumer imports it — recorded as a deliberate reversal of three locks, with the guard that the
earlier decision promised and never shipped landing first.

The reversal is the whole subject. This tree rejected a five-level component taxonomy on a
measurement — that the level is not computable from props, depth, path or file length — and it
states, as a positive instruction rather than an omission, that no ordering is prescribed among
stories, component and page. Both rejections are correct on their own evidence. Adopting the
source's proposal means overturning them, and overturning them silently is what this roadmap
exists to prevent.

## Phase 1 — Land the guard the earlier decision promised

- [ ] **1.1 Write the fixture the archived granularity roadmap specified and never shipped.** Its
      own risk register predicted this exact re-arrival — that a three-tier vocabulary would be
      read as a first step and the next contributor would complete it — and its mitigation was a
      fixture that fails if a five-level name appears in the emitted vocabulary. The fixture does
      not exist.
      verify: the fixture is red against a planted five-level name and green without one, and both
      readings are recorded.
- [ ] **1.2 Do this before the reversal, not after.** A guard written after the decision it guards
      has been reversed records nothing.
      verify: the fixture lands in its own commit, ahead of Phase 2.

## Phase 2 — Record the reversal, or stop here

- [ ] **2.1 Write one decision record** superseding three things at once: the no-prescribed-order
      statement, the five-level-name prohibition the Phase 1 fixture now enforces, and a
      lane-scoped amendment to the abstraction thresholds so a single-use component inside a
      declared lane is not a threshold violation.
      verify: the decision index is regenerated, and the abstraction-threshold gate stays green on
      non-lane fixtures while not firing on a one-use component inside a lane fixture.
- [ ] **2.2 Amend the Phase 1 fixture under the new record** so the reversal is visible in the
      guard rather than in the guard's absence.
      verify: the fixture is red against an undeclared five-level name and green against a declared
      one, and the amendment cites the record.
- [ ] **2.3 Make no quality claim.** This is a convention, not a measured improvement.
      verify: `docs/CLAIMS.md` is unchanged by this roadmap and the claims gate is green.

## Phase 3 — Declared level, never inferred

- [ ] **3.1 Carry the level as a title prefix and a metadata field**, from a taxonomy the project
      configures, and add a level column to the owned-component list.
      verify: a lint checks that title, metadata and directory agree, and it never derives a level
      from props, depth, path or file length — the measurement that the level is not computable is
      cited in the lint's own docstring rather than re-argued.
- [ ] **3.2 An undeclared component has no level.** Absent is absent, never guessed.
      verify: the lint reports an undeclared component as undeclared and does not assign it a tier.

## Phase 4 — Two axes on the stack detector, in the right file

- [ ] **4.1 Add a workshop axis and a verification axis** to the stack-detection axis table and to
      the documented stack seam, filling the workshop capabilities as booleans.
      verify: the library fixture resolves a workshop value; a project with no marker resolves none
      and its fallback path runs without error.
- [ ] **4.2 Treat this as a consumer-template change, not an engine change.**
      `corrected-from-reproduction` — every revision in the source set cites the detector as
      `work_engine/stack/detect.ts`. The real path is under
      `src/agent-src/templates/scripts/work_engine/`, a template shipped into every consumer
      project, so adding an axis changes a file installed in other people's repositories. No
      revision noticed.
      verify: the blast radius across installed consumers is stated in the evidence tree, and the
      migration path for a project already carrying the template is named.
- [ ] **4.3 No provider registry file.** The axes carry what the lane needs; a registry is a second
      source of truth for twelve adapters that do not exist.
      verify: no new configuration file is added by this phase.

## Phase 5 — Contract before consumption, lane-gated and shadow-only

- [ ] **5.1 Add one rule**, gated on a resolved workshop lane, enforced in shadow.
      verify: the framework-neutrality gate is green — the rule names no framework, or carries a
      declared exemption.
- [ ] **5.2 Keep the local-inline escape.** A component used once, in one place, under the stated
      conditions, stays legal.
      verify: the rule names the conditions verbatim, and a fixture exercising each one passes.
- [ ] **5.3 It is a dependency rule, not a commit-order rule.** The contract must exist before the
      import resolves, not in an earlier commit.
      verify: a fixture landing both in one commit passes.

## Phase 6 — Exactly one lane beyond the reference

- [ ] **6.1 Add one non-reference workshop lane**, chosen by what a real consumer project actually
      uses, with a minimal fixture.
      verify: the lane emits a conformance artefact whose unavailable dimensions carry
      not-applicable rows with reasons.
- [ ] **6.2 One, not twelve.** The documented stack seam already says to defer a stack until more
      than one consumer asks.
      verify: exactly one lane is added, and the reason it was the one chosen is recorded.

## Blockers

### blocker: taxonomy-reversal-is-a-second-arrival
- **Status:** open
- **Owner:** maintainer
- **Class:** 3 — human-only
- **Blocks:** Phases 2 through 6. Phase 1 proceeds without it — the guard is owed regardless of
  which way the decision goes.
- **What to do:** decide whether to reverse the five-level-taxonomy rejection. This is its second
  arrival: the archived granularity roadmap rejected it deliberately, on a measurement that levels
  are not computable, and its own risk register predicted this re-arrival and specified the guard
  Phase 1 now lands. Read
  `agents/roadmaps/archive/road-to-component-granularity-vocabulary.md` — its rejection paragraph
  and its risk row 1 — plus
  `grep -n 'no order is prescribed' src/skills/ui-component-architect/SKILL.md`. Three options:
  (a) reverse both the ordering statement and the vocabulary; (b) uphold both and record the
  second arrival on the archived file; (c) reverse only the ordering statement, which is a process
  preference costing nothing, and leave the vocabulary rejected on evidence that has not moved.
- **Recommendation:** reverse only the ordering statement. The vocabulary was rejected on a
  measurement, and nothing in this round re-measures it; the ordering was rejected as a preference,
  and a preference is what the source is asking to change.
- **If you do nothing:** Phase 1 lands the missing guard and the roadmap stops there, which closes
  the gap the earlier decision left open and is a complete outcome on its own.
- **Resolved when:** the decision record exists with one of the three readings, or this roadmap
  records the refusal and the archived roadmap carries the arrival.

### blocker: the-detector-is-a-consumer-template
- **Status:** open
- **Owner:** maintainer
- **Class:** 3 — human-only
- **Blocks:** Phase 4 only.
- **What to do:** decide whether the stack detector may grow two axes given that it ships into
  every consumer project. Read
  `src/agent-src/templates/scripts/work_engine/stack/detect.ts` — the real path, under the
  agent-source template tree rather than the package engine — and state what an already-installed
  consumer sees when the axis table changes under it. Two options: (a) assess the blast radius and
  proceed; (b) refuse the axis change and drop Phase 4. No revision in the source set noticed the
  file was a template, so the radius has never been assessed.
- **Recommendation:** assess it before Phase 4 starts. The change may well be additive and safe;
  what is missing is that nobody has looked, and an axis added to an installed template is not a
  change this repository can roll back on a consumer's behalf.
- **If you do nothing:** Phase 4 does not run and Phases 5 and 6 lose their lane resolution, which
  reduces this roadmap to the decision record and the guard.
- **Resolved when:** the blast radius is stated in the evidence tree and the migration path is
  named, or the axis change is refused.

### blocker: workshop-tool-names-are-unverified
- **Status:** open
- **Owner:** maintainer
- **Class:** 3 — human-only
- **Blocks:** the "immediately mergeable" tool-name correction the source proposes, wherever it
  would land. Nothing else.
- **What to do:** re-derive the current tool names from a throwaway installation rather than from
  the inbox file. The two skills carrying them are `src/skills/storybook-workshop/SKILL.md` and
  `src/skills/existing-ui-audit/SKILL.md`; `grep -rn 'list-all-documentation\|get-documentation' src/`
  lists every occurrence — three across those two files. Two options: (a) confirm the names against
  a real installation and correct them; (b) mark them unverified as of a date. The source asserts
  the names are stale and supplies replacements, but both halves are claims about an external
  system and neither is verifiable offline, so its replacements cannot be adopted on this evidence.
- **Recommendation:** re-derive them. The staleness claim is plausible and the correction is small,
  but adopting a third party's version numbers from a document is the failure mode this tree has
  a precedent against.
- **If you do nothing:** the two skills keep naming tools that may not exist, which is the status
  quo and is visible rather than silently wrong.
- **Resolved when:** the names are confirmed against a real installation, or the skills say the
  names are unverified as of a date.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-09-11 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | The reversal happens without its guard | product | The earlier decision predicted this arrival and specified a fixture that was never written, so a reversal now would repeat the failure at a level the tree cannot see | Phase 1 lands the guard first, in its own commit, and Phase 2.2 amends it under the record so the reversal lives in the guard rather than in its absence | Phase 1 — Land the guard the earlier decision promised |
| 2 | An installed template changes under consumers | implementation | The stack detector ships into every consumer project and no revision in the source noticed, so the blast radius of a new axis has never been assessed | Phase 4.2 makes the assessment an acceptance criterion and the blocker holds the phase until it exists | Phase 4 — Two axes on the stack detector, in the right file |
| 3 | Contract-before-consumption drives over-componentisation | product | A rule that every reusable component needs a contract makes the cheap path be to inline everything, or to componentise everything | Phase 5.2 keeps the local-inline escape with its conditions named verbatim and fixture-tested; the rule counts dispositions rather than gating on them | Phase 5 — Contract before consumption, lane-gated and shadow-only |
| 4 | The lane set outgrows its fixtures | product | A workshop adapter matrix invites a row per tool and each row needs a fixture nobody maintains | Phase 6 ships exactly one lane and records why it was chosen; the documented seam's defer-until-a-second-consumer-asks rule governs, not the matrix | Phase 6 — Exactly one lane beyond the reference |
| 5 | The reversal reads as a quality claim | implementation | A decision record adopting a taxonomy invites a claim that the tree got better, which nothing here measures | Phase 2.3 asserts the claims file is untouched, and the claims gate proves it | Phase 2 — Record the reversal, or stop here |
| 6 | The subject arrives a third time | product | A rejection recorded in prose was already missed once by a round that re-argued it from scratch | Phase 1's fixture makes the guard the carrier of the decision, so the next round meets a failing test rather than a sentence | Phase 1 — Land the guard the earlier decision promised |

## Acceptance Criteria

- [ ] AC-1 — The fixture the archived granularity roadmap specified exists, was observed red
      against a planted five-level name, and landed before any reversal.
- [ ] AC-2 — A decision record exists naming which of the three readings was taken, or this
      roadmap records the refusal and the archived roadmap carries the arrival count.
- [ ] AC-3 — No component level is ever derived from props, depth, path or file length, and an
      undeclared component is reported undeclared rather than assigned a tier.
- [ ] AC-4 — The stack detector's blast radius across installed consumers is stated before its
      axis table changes, or the change is refused.
- [ ] AC-5 — No new configuration file carries a provider or workshop registry.
- [ ] AC-6 — The contract rule is lane-gated, shadow-enforced, framework-neutral, and passes a
      fixture that lands contract and consumer in one commit.
- [ ] AC-7 — Exactly one non-reference lane exists, and the reason it was chosen is recorded.
- [ ] AC-8 — The claims file is unchanged by this roadmap.
