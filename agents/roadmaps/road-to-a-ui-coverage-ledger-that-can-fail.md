---
complexity: lightweight
status: ready
execution:
  mode: phase-checkpoints
estate_growth_exempt: >-
  Roadmap count 0 to 1. The growth IS the deliverable and nothing in the tree covers it:
  verified 2026-09-29 at HEAD, `src/agent-src/templates/scripts/work_engine/directives/ui/apply.ts`
  matches a declared inventory item against a coverage bucket with `entries.some(e => e.includes(needle))`
  at line 190, returns `Outcome.SUCCESS` at line 129 when every item sits in `flagged`, and scans
  `envelope['rendered']` rather than the written files at line 268. Three gates that cannot fail on
  the cases they exist for are not a backlog item; they are a ledger reporting coverage the tree
  does not have.
estate_offset_exempt: >-
  No offset exists. `agents/roadmaps/archive/road-to-behaviour-evidence-over-pixels.md` and
  `agents/roadmaps/archive/road-to-a-declared-component-contract.md` are already archived, so there
  is nothing to retire; `agents/roadmaps/stubs/road-to-executable-specification-adapter.md` is held
  by a measured refusal this roadmap does not lift and retiring it would dispose of a recorded
  decision; merging into `agents/roadmaps/road-to-a-ledger-that-closes-the-loop.md` would put a
  three-line defect fix in `apply.ts` inside a structural roadmap about turn-end obligation reading,
  whose own scope note says it reads whether evidence arrived rather than producing it.
relates:
  - slug: road-to-a-ledger-that-closes-the-loop
    relation: disjoint
  - slug: road-to-behaviour-evidence-over-pixels
    relation: disjoint
---
# Road to a UI coverage ledger that can fail

> **Source:** `agents/tmp.old/inbox-2026-09-ab/t10/` — an external completion-discipline
> analysis delivered as a transcript plus two successive plan revisions.
> Claim verification at HEAD 2026-09-29: the plan's twelve file-anchored defect claims are
> **still-true at the cited lines**, none overtaken. Two figures it quotes are
> `corrected-from-reproduction` below.

## Goal

Three gates inside the UI apply directive today accept the case they exist to catch: a declared
item is "accounted for" by substring containment against any bucket entry, a port that carried
nothing over still returns `SUCCESS`, and the placeholder scan reads the porter's own report
instead of the files it wrote. After this roadmap each of the three fails on a planted instance
of its own failure case, proven by a fixture arm that is red before the fix and green after —
and by a pre-registered count of what today's gates catch, recorded before any gate changes.

## Non-goals

- No derived inventory. What `COVERED_INVENTORIES` contains stays the porter's list; whether it
  should be machine-derived from the artefact is an owner decision this roadmap does not take.
- No pixel comparison, no fidelity score, no new skill, rule, command verb or hook.
- No change to `COVERAGE_BUCKETS`. The CLI/engine pinning test at `src/cli/commands/uiAudit.ts`
  and its test already hold that vocabulary; nothing here moves it.

## Phase 1 — A fixture at the scale where ports lose things, and today's catch count first

- [ ] **1.1 Build a port fixture with four planted losses** under
      `tests/design-artifacts/fixtures/ui-port-losses/`: `S-a` a declared item whose only
      "coverage" is a short-name substring collision (`nav` covered by `canvas`), `S-b` every
      declared item placed in `flagged`, `S-c` a lorem string in a written file that
      `envelope.rendered` does not repeat, plus one faithful arm that must raise nothing.
      Content entirely invented — no project or company material.
      verify: a test asserts each of the four arms exists and that each planted loss carries the
      marker comment naming it.
- [ ] **1.2 Record what today's gates catch, before changing any of them.**
      verify: the fixture README records `caught N of 3` with the exact command that produced it,
      committed in this phase's change so the first-add ancestry is checkable.

## Phase 2 — An id, not a substring

- [ ] **2.1 Replace containment with exact matching** in `coverage_gaps`
      (`…/work_engine/directives/ui/apply.ts:190`, today
      `entries.some((entry) => entry.includes(needle))`). A declared item is accounted for when a
      bucket entry equals it, not when some entry contains it.
      verify: arm `S-a` halts with `apply_coverage_missing` after the change and passes before it —
      both asserted in the same test, so the arm is proven red-first.
- [ ] **2.2 Keep containment as a warned fallback for one release**, so an existing consumer
      envelope written against the old matching does not halt without warning.
      verify: an envelope that only matches by containment emits the fallback warning and does not
      halt; the same envelope halts once the fallback is removed.

## Phase 3 — Handing work back is not success

- [ ] **3.1 An all-`flagged` port stops returning `Outcome.SUCCESS`.** `run` returns
      `Outcome.SUCCESS` at `apply.ts:129` whenever `coverage_gaps` is empty, and an envelope that
      puts every declared item in `flagged` produces exactly that. Report the outcome in shadow
      first — the step result carries the enumerated unflagged-nothing case in its message without
      changing the outcome value.
      verify: arm `S-b` produces the shadow line; the faithful arm does not.
- [ ] **3.2 Flip the shadow to a non-SUCCESS outcome**, with the affected item ids enumerated in
      the message.
      verify: arm `S-b` is not `SUCCESS` after the flip; the faithful arm still is. The flip lands
      in its own change, after 3.1 has shipped one release.

## Phase 4 — The placeholder scan reads the files

- [ ] **4.1 Scan the changed written files for placeholder patterns** in addition to
      `envelope['rendered']` (`apply.ts:268`, today `placeholder_paths(envelope['rendered'])`).
      Changed set only — never a tree sweep.
      verify: arm `S-c` halts with `apply_placeholders_in_output`; removing the file-side scan makes
      the same arm pass, asserted as the sensitivity control.

## Phase 5 — Say what changed, against the pre-registered number

- [ ] **5.1 Re-run 1.2's command and record `caught N of 3` after the three fixes**, beside the
      before-number in the same README.
      verify: the two numbers sit in one table with the command that produced each; the faithful
      arm's false-red count is recorded and is zero.
- [ ] **5.2 A null is an outcome.** If the faithful arm raises a red that the before-run did not,
      that is the finding and Phase 3.2 does not flip.
      verify: the README states the verdict either way, naming the arm.

## Acceptance criteria

- AC-1 Today's catch count over the three planted losses was recorded before any gate changed.
- AC-2 Each planted loss is caught by a named halt or outcome, and each was proven red before its
  fix in the same test.
- AC-3 The faithful arm raises zero findings after all three changes.
- AC-4 `COVERAGE_BUCKETS` is unchanged and the existing CLI/engine pinning test is still green.
- AC-5 No skill, rule, command verb, hook or ledger format was added.

## Risk Register

<!-- risk-review: v1 | reviewed: 2026-09-29 | reviewer: agent -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|---|---|---|---|---|---|
| 1 | Exact matching halts consumer envelopes that passed only by containment | implementation | An existing envelope whose bucket entries merely contain the declared item stops matching the moment containment is removed, so a port that ran green yesterday halts today with no warning | 2.2 keeps containment as a warned fallback for one release before removal | Phase 2 |
| 2 | The outcome flip changes an engine result existing callers branch on | implementation | `run` returns `Outcome.SUCCESS` today for an all-`flagged` port; a caller reading that value gets a different answer after the flip with nothing in between | 3.1 ships the shadow line one release ahead and 3.2 lands as its own change | Phase 3 |
| 3 | The fixture is small enough that all three gates look adequate on it | product | A fixture built to demonstrate three known defects will demonstrate them; it says nothing about whether the gates hold at real port scale, which is where shrinkage happens | 1.2 pre-registers the before-count, so an unchanged number after the fixes is itself the finding rather than a silent pass | Phase 1 |
| 4 | Scanning written files makes apply slower or noisier on large ports | implementation | A placeholder scan over output files adds reads the directive did not previously make, and a false hit halts a port that was correct | 4.1 is scoped to the changed set, never a tree sweep, and the faithful arm is the false-positive meter | Phase 4 |

## Decisions

| Decision | Alternatives | Reason | Revisit-if |
|---|---|---|---|
| Fix the three matching/outcome/scan defects, leave the inventory source alone | derive the inventory from the artefact in the same roadmap | The derived denominator needs a browser capture path and an unresolved row-source decision; the three defects here need neither and each is a few lines | The row-source owner decision lands and a derived inventory makes exact id matching moot |
| Shadow-then-flip for the outcome change | flip directly | An engine outcome is a surface existing callers branch on | No caller is found to branch on `SUCCESS` from this directive |
