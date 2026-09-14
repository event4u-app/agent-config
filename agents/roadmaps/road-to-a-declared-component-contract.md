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

- [x] **1.1 Write the fixture the archived granularity roadmap specified and never shipped.** Its
      own risk register predicted this exact re-arrival — that a three-tier vocabulary would be
      read as a first step and the next contributor would complete it — and its mitigation was a
      fixture that fails if a five-level name appears in the emitted vocabulary. The fixture does
      not exist.
      verify: the fixture is red against a planted five-level name and green without one, and both
      readings are recorded.

      **DONE, and the premise was verified before it was acted on.** The archived roadmap records
      its 0.3 first half as DONE, claiming *"no five-level name can enter the emitted vocabulary
      without turning that test red"*. Measured 2026-09-13 at `origin/main`: the claim is **false**.
      The test it rests on (`tests/cli/uiAudit_design_system.test.ts` § *the audit kind enum has ONE
      definition*) compares `AUDIT_KINDS` to the skill's `kind:` line and forbids exactly two dead
      values, `partial` and `layout`. Planting `organism` into **both** surfaces — which is what
      "completing" a taxonomy looks like — left all 36 tests **green**. So this roadmap's premise
      stands: the guard does not exist, and the archived DONE note over-claims what its test covers.

      Landed as a fourth `describe` block in the same file, asserting the archived step's own named
      set — `atom`, `molecule`, `organism`, `template` — against `AUDIT_KINDS` and against the
      skill's declared list **independently**, so a coordinated edit turns both red. `page` is
      deliberately excluded from the forbidden set: it is Frost's fifth level and a value this
      repository emits on its own Blade/Next evidence, predating the harvest.

      **Both readings, recorded:**
      - RED with `organism` planted in `src/cli/commands/uiAudit.ts` and
        `src/skills/existing-ui-audit/SKILL.md`: `2 failed | 37 passed (39)` — one failure per
        surface.
      - GREEN with the plant removed: `39 passed (39)`.
      - Control reading, same plant against the pre-existing tests only: `36 passed (36)`.
- [x] **1.2 Do this before the reversal, not after.** A guard written after the decision it guards
      has been reversed records nothing.
      verify: the fixture lands in its own commit, ahead of Phase 2.

      **MET.** The fixture lands in its own commit and Phase 2 has not run — it is held by
      `taxonomy-reversal-is-a-second-arrival`, which is owner-reserved. The ordering the step asks
      for is therefore satisfied by construction rather than by sequencing.

## Phase 2 — Record the reversal, or stop here

> **Every step in Phases 2 through 6 now carries the inline `blocked-by:` marker, and that is a
> fix rather than a formality.** `scanOpenSteps` in
> `src/scripts/hooks/run_continuation_hook.ts` reads blockedness from the marker and from nothing
> else — it never parses `## Blockers` — so a step declared blocked only in prose still counts as
> open work to the stop-slot concern, which re-engaged an autonomous run into these owner
> decisions on every fire. Measured on this file before the markers: `{ open: 13, blocked: 0 }`,
> with `next` pointing at 2.1; after: `{ open: 0, blocked: 13, next: null }`. At 13 steps this was
> the largest such exposure in the estate. No checkbox moved: the boxes stay `[ ]`, both blockers
> stay open, the acceptance criteria stay unmet and the roadmap stays unarchivable. Only the
> concern's read of them changes.
>
> **Phase 4 is gated twice and its marker names one blocker.** The grammar carries a single id, so
> 4.1 through 4.3 point at `the-detector-is-a-consumer-template`, the blocker whose § Blocks names
> exactly those steps. `taxonomy-reversal-is-a-second-arrival` gates them as well, per its own
> § Blocks — clearing the detector blocker alone does not release Phase 4, and a reader stripping
> one marker on that basis would re-open an owner decision that is still open.


- [ ] <!-- blocked-by: taxonomy-reversal-is-a-second-arrival | asked: no — non-interactive process-full run, which reports once at the end and cannot put a question --> **2.1 Write one decision record** superseding three things at once: the no-prescribed-order
      statement, the five-level-name prohibition the Phase 1 fixture now enforces, and a
      lane-scoped amendment to the abstraction thresholds so a single-use component inside a
      declared lane is not a threshold violation.
      verify: the decision index is regenerated, and the abstraction-threshold gate stays green on
      non-lane fixtures while not firing on a one-use component inside a lane fixture.
- [ ] <!-- blocked-by: taxonomy-reversal-is-a-second-arrival | asked: no — non-interactive process-full run, which reports once at the end and cannot put a question --> **2.2 Amend the Phase 1 fixture under the new record** so the reversal is visible in the
      guard rather than in the guard's absence.
      verify: the fixture is red against an undeclared five-level name and green against a declared
      one, and the amendment cites the record.
- [ ] <!-- blocked-by: taxonomy-reversal-is-a-second-arrival | asked: no — non-interactive process-full run, which reports once at the end and cannot put a question --> **2.3 Make no quality claim.** This is a convention, not a measured improvement.
      verify: `docs/CLAIMS.md` is unchanged by this roadmap and the claims gate is green.

## Phase 3 — Declared level, never inferred

- [ ] <!-- blocked-by: taxonomy-reversal-is-a-second-arrival | asked: no — non-interactive process-full run, which reports once at the end and cannot put a question --> **3.1 Carry the level as a title prefix and a metadata field**, from a taxonomy the project
      configures, and add a level column to the owned-component list.
      verify: a lint checks that title, metadata and directory agree, and it never derives a level
      from props, depth, path or file length — the measurement that the level is not computable is
      cited in the lint's own docstring rather than re-argued.
- [ ] <!-- blocked-by: taxonomy-reversal-is-a-second-arrival | asked: no — non-interactive process-full run, which reports once at the end and cannot put a question --> **3.2 An undeclared component has no level.** Absent is absent, never guessed.
      verify: the lint reports an undeclared component as undeclared and does not assign it a tier.

## Phase 4 — Two axes on the stack detector, in the right file

- [ ] <!-- blocked-by: the-detector-is-a-consumer-template | asked: no — non-interactive process-full run, which reports once at the end and cannot put a question --> **4.1 Add a workshop axis and a verification axis** to the stack-detection axis table and to
      the documented stack seam, filling the workshop capabilities as booleans.
      verify: the library fixture resolves a workshop value; a project with no marker resolves none
      and its fallback path runs without error.
- [ ] <!-- blocked-by: the-detector-is-a-consumer-template | asked: no — non-interactive process-full run, which reports once at the end and cannot put a question --> **4.2 Treat this as a consumer-template change, not an engine change.**
      `corrected-from-reproduction` — every revision in the source set cites the detector as
      `work_engine/stack/detect.ts`. The real path is under
      `src/agent-src/templates/scripts/work_engine/`, a template shipped into every consumer
      project, so adding an axis changes a file installed in other people's repositories. No
      revision noticed.
      verify: the blast radius across installed consumers is stated in the evidence tree, and the
      migration path for a project already carrying the template is named.
- [ ] <!-- blocked-by: the-detector-is-a-consumer-template | asked: no — non-interactive process-full run, which reports once at the end and cannot put a question --> **4.3 No provider registry file.** The axes carry what the lane needs; a registry is a second
      source of truth for twelve adapters that do not exist.
      verify: no new configuration file is added by this phase.

## Phase 5 — Contract before consumption, lane-gated and shadow-only

- [ ] <!-- blocked-by: taxonomy-reversal-is-a-second-arrival | asked: no — non-interactive process-full run, which reports once at the end and cannot put a question --> **5.1 Add one rule**, gated on a resolved workshop lane, enforced in shadow.
      verify: the framework-neutrality gate is green — the rule names no framework, or carries a
      declared exemption.
- [ ] <!-- blocked-by: taxonomy-reversal-is-a-second-arrival | asked: no — non-interactive process-full run, which reports once at the end and cannot put a question --> **5.2 Keep the local-inline escape.** A component used once, in one place, under the stated
      conditions, stays legal.
      verify: the rule names the conditions verbatim, and a fixture exercising each one passes.
- [ ] <!-- blocked-by: taxonomy-reversal-is-a-second-arrival | asked: no — non-interactive process-full run, which reports once at the end and cannot put a question --> **5.3 It is a dependency rule, not a commit-order rule.** The contract must exist before the
      import resolves, not in an earlier commit.
      verify: a fixture landing both in one commit passes.

## Phase 6 — Exactly one lane beyond the reference

- [ ] <!-- blocked-by: taxonomy-reversal-is-a-second-arrival | asked: no — non-interactive process-full run, which reports once at the end and cannot put a question --> **6.1 Add one non-reference workshop lane**, chosen by what a real consumer project actually
      uses, with a minimal fixture.
      verify: the lane emits a conformance artefact whose unavailable dimensions carry
      not-applicable rows with reasons.
- [ ] <!-- blocked-by: taxonomy-reversal-is-a-second-arrival | asked: no — non-interactive process-full run, which reports once at the end and cannot put a question --> **6.2 One, not twelve.** The documented stack seam already says to defer a stack until more
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
- **STILL OPEN, and deliberately.** Reversing a recorded rejection on its second arrival is
  owner-reserved under [`decision-revisit-gate`](../../src/rules/decision-revisit-gate.md)
  § owner-reserved set; an agent manufacturing that decision is the failure this blocker exists
  to prevent. Phase 1 landed without it, as the blocker's own § Blocks permits.
- **New evidence for whoever decides, gathered 2026-09-13 while landing Phase 1.** It changes
  the reading of the record, not the decision:
  - **The archived roadmap's guard claim was an over-claim.** Its step 0.3 records the
    first half as DONE and states that *"no five-level name can enter the emitted vocabulary
    without turning that test red"*. Measured: planting `organism` into **both**
    `AUDIT_KINDS` and the skill's `kind:` line left all 36 tests green. The identity test it
    rested on compares the two surfaces **to each other** and forbids exactly two dead values,
    `partial` and `layout` — neither of which is a five-level name. A contributor "completing"
    the taxonomy updates both surfaces and passes.
  - **So this is the third outcome in [`recurring-criticism`](../../src/rules/recurring-criticism.md),
    not the first.** The disposition was right, it was recorded, and the carrier that was
    supposed to make it reachable did not carry it. That is a system failure and not evidence
    that the rejection was wrong — the measurement it rests on (the level is not computable from
    props, depth, path or file length) has not been re-measured by this round or the last one.
  - **The guard now exists**, so the next arrival meets a failing test rather than a sentence,
    which is the state the archived risk register wanted before the question was reopened. The
    decision is therefore no longer urgent: option (c), reversing only the ordering statement,
    costs nothing and is unaffected by any of this.

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
- **STILL OPEN.** The blast-radius assessment is the owner's, and (b) refuse-and-drop-Phase-4 is
  one of the two readings, so this is not a measurement an agent closes.
- **One factual check done 2026-09-13, so the decision is not taken on a wrong pointer.** The
  path the step's `corrected-from-reproduction` tag asserts is **correct**:
  `src/agent-src/templates/scripts/work_engine/stack/detect.ts` exists (39 KB), and a tree-wide
  `find` for `detect.ts` outside `dist/` returns exactly three files — that one,
  `src/install/detect.ts` and `src/scripts/code_graph/detect.ts`. There is **no**
  `work_engine/stack/detect.ts` anywhere outside the template tree, so the source set's
  `work_engine/stack/detect.ts` citation resolves to a shipped consumer template and to nothing
  else. The correction stands; the radius is still unassessed.

### blocker: workshop-tool-names-are-unverified
- **Status:** resolved
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
- **Resolution (2026-09-13) — option (a), re-derived from a throwaway installation.** Not from
  the inbox file and not from the source's replacements, neither of which was adopted. Three
  `npm install` runs into a scratch directory, and the names read off the registration site in
  the installed code:

  | Installed | Docs tool names | Where they come from |
  |---|---|---|
  | `@storybook/addon-mcp@0.7.0` + `@storybook/mcp@0.8.0` | `list-all-documentation`, `get-documentation`, `get-documentation-for-story` | string literals, `@storybook/mcp/dist/index.js:891,1045,963` |
  | `@storybook/addon-mcp@10.6.0` + `storybook@10.6.0` (current `latest`) | `docs-list`, `docs-show`, `docs-show-story` | `createDocsToolset` method ids `docs.list` / `docs.show` / `docs.showStory`, rendered by `toMcpToolName` from `storybook/open-service` |

  So the staleness claim is **confirmed**, and the mechanism is a rename of the registration
  path rather than of a literal: at 10.6.0 the old names survive only as the tools'
  human-readable titles (`List All Documentation`, `Get Documentation`) and in the addon's
  CHANGELOG. `toMcpToolName` was executed against the installed module rather than
  reimplemented — `docs.list -> docs-list`, `docs.show -> docs-show`,
  `docs.showStory -> docs-show-story`.

  **Version boundary, which the source did not carry:** `@storybook/addon-mcp` has no 10.5.x
  release at all — `npm view` lists `… 0.6.0, 0.7.0, 10.6.0-alpha.4 … 10.6.0`. The
  `tests/fixtures/stack/storybook-current/` scaffold pins the addon at `latest`, so a project on
  the current scaffold resolves 10.6.0 and gets the `docs-*` names. There is no supported
  version in between for the skills to straddle.

  **Landed:** three occurrences corrected across `src/skills/existing-ui-audit/SKILL.md` and
  `src/skills/storybook-workshop/SKILL.md`, with the derivation, its date and the version
  boundary recorded at the audit skill's § 4b and cross-referenced rather than duplicated. The
  paragraph states that a live `tools/list` wins over it, so the next reader re-derives instead
  of trusting a date.

  **What this does NOT resolve:** the React-only-in-preview statement and the `docs 10.5` FAQ
  citation next to it were not re-derived and are untouched. They are a separate claim about the
  same external system; correcting the tool names does not license adopting them.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-09-13 | reviewer: claude/host -->

**Re-reviewed 2026-09-13, after Phase 1 landed.** All six rows stand as written; two have had
their mitigation move from planned to real, and one row's premise was strengthened by a
measurement rather than weakened.

- **Rows 1 and 6 are now partly discharged.** Their shared mitigation — the fixture — exists and
  was observed red against a planted five-level name. Row 1's second half (2.2 amends the fixture
  under the record) is untouched and stays a live risk, because the record does not exist.
- **Row 6's premise got sharper, not softer.** It reads *"a rejection recorded in prose was
  already missed once by a round that re-argued it from scratch"*. Measured while landing 1.1:
  the rejection was ALSO carried by a test that did not actually carry it — the archived
  over-claim — so the subject survived both a sentence and a guard-shaped claim about a guard.
  That raises the row's likelihood rather than lowering it, and the fixture is what answers it.
- **Rows 2 through 5 are unchanged and unexercised.** Their phases did not run.
- **No row was added.** Nothing in this pass surfaced a risk the six do not already name.

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | The reversal happens without its guard | product | The earlier decision predicted this arrival and specified a fixture that was never written, so a reversal now would repeat the failure at a level the tree cannot see | Phase 1 lands the guard first, in its own commit, and Phase 2.2 amends it under the record so the reversal lives in the guard rather than in its absence | Phase 1 — Land the guard the earlier decision promised |
| 2 | An installed template changes under consumers | implementation | The stack detector ships into every consumer project and no revision in the source noticed, so the blast radius of a new axis has never been assessed | Phase 4.2 makes the assessment an acceptance criterion and the blocker holds the phase until it exists | Phase 4 — Two axes on the stack detector, in the right file |
| 3 | Contract-before-consumption drives over-componentisation | product | A rule that every reusable component needs a contract makes the cheap path be to inline everything, or to componentise everything | Phase 5.2 keeps the local-inline escape with its conditions named verbatim and fixture-tested; the rule counts dispositions rather than gating on them | Phase 5 — Contract before consumption, lane-gated and shadow-only |
| 4 | The lane set outgrows its fixtures | product | A workshop adapter matrix invites a row per tool and each row needs a fixture nobody maintains | Phase 6 ships exactly one lane and records why it was chosen; the documented seam's defer-until-a-second-consumer-asks rule governs, not the matrix | Phase 6 — Exactly one lane beyond the reference |
| 5 | The reversal reads as a quality claim | implementation | A decision record adopting a taxonomy invites a claim that the tree got better, which nothing here measures | Phase 2.3 asserts the claims file is untouched, and the claims gate proves it | Phase 2 — Record the reversal, or stop here |
| 6 | The subject arrives a third time | product | A rejection recorded in prose was already missed once by a round that re-argued it from scratch | Phase 1's fixture makes the guard the carrier of the decision, so the next round meets a failing test rather than a sentence | Phase 1 — Land the guard the earlier decision promised |

## Acceptance Criteria

- [x] AC-1 — The fixture the archived granularity roadmap specified exists, was observed red
      against a planted five-level name, and landed before any reversal.
      **Met** — readings recorded under step 1.1. Landed before any reversal because no reversal
      has been decided: Phase 2 is held by an owner-reserved blocker.
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
