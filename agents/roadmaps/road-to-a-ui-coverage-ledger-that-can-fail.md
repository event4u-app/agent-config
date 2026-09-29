---
complexity: lightweight
status: ready
execution:
  mode: phase-checkpoints
estate_growth_exempt: "active_roadmaps 2 to 24 (+22, all 22 offset-exempt) — measured by check_estate_count on this diff, not predicted. This claim authorises the whole inbox-2026-09-ab round; the per-file justification follows. The growth IS the deliverable and nothing in the tree covers it: verified 2026-09-29 at HEAD, `src/agent-src/templates/scripts/work_engine/directives/ui/apply.ts` matches a declared inventory item against a coverage bucket with `entries.some(e => e.includes(needle))` at line 190, returns `Outcome.SUCCESS` at line 129 when every item sits in `flagged`, and scans `envelope['rendered']` rather than the written files at line 268. Three gates that cannot fail on the cases they exist for are not a backlog item; they are a ledger reporting coverage the tree does not have."
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

- [x] **1.1 Build a port fixture with four planted losses** under
      `tests/design-artifacts/fixtures/ui-port-losses/`: `S-a` a declared item whose only
      "coverage" is a short-name substring collision (`nav` covered by `canvas`), `S-b` every
      declared item placed in `flagged`, `S-c` a lorem string in a written file that
      `envelope.rendered` does not repeat, plus one faithful arm that must raise nothing.
      Content entirely invented — no project or company material.
      verify: a test asserts each of the four arms exists and that each planted loss carries the
      marker comment naming it.
      Done 2026-09-29. Four arms + `_artifact.json` + `written/` + `probe.ts` + `README.md`
      under `tests/design-artifacts/fixtures/ui-port-losses/`; registered as `daf-port-losses`
      in `eval-fixtures.md` (`lint_eval_fixture_citations` → `40 fixture id(s), all cited.`).
      Test `tests/scripts/work_engine/ui_port_losses.test.ts`, 4 tests green: each arm carries a
      `_planted` marker (the JSON form of the marker comment), the S-c written file carries the
      comment `PLANTED LOSS S-c` at the planted line, and the faithful arm's marker reads
      `NOTHING IS PLANTED`. **Sensitivity proven:** `_planted` deleted from `S-a` and its
      collision entry shortened to `sort order — honoured` → exactly the two expected tests
      failed (`has no _planted marker`; `expected false to be true` on the collision
      assertion), 2 failed / 2 passed; restored from `/tmp` copy, 4/4 green again.
      · **FINDING — the step's own illustration does not reproduce.** `"canvas".includes("nav")`
      is **false**: `canvas` yields `can`, `anv`, `nva`, `vas`, and no `nav`. Written as
      specified, `S-a` would have been an ordinary uncovered item that today's containment
      matching already catches, so the arm would have measured nothing. Measurement unit
      published before the substitute: a collision is a pair `(item, entry)` where
      `entry.toLowerCase().includes(item.toLowerCase())` is true and
      `entry.toLowerCase() === item.toLowerCase()` is false. Substitute used: `tab` inside
      `table sort order`. Both limbs are asserted in the test rather than described in prose,
      and the roadmap's own pair is pinned there as `expect('canvas'.includes('nav')).toBe(false)`
      so the finding cannot quietly decay. No figure from the original illustration is carried
      forward.
- [x] **1.2 Record what today's gates catch, before changing any of them.**
      verify: the fixture README records `caught N of 3` with the exact command that produced it,
      committed in this phase's change so the first-add ancestry is checkable.
      Done 2026-09-29. `README.md` § Pre-registered catch count carries the command and its
      verbatim output, and the test asserts both strings are present so the number cannot be
      edited out of the README without a red.

      ```
      $ npx tsx tests/design-artifacts/fixtures/ui-port-losses/probe.ts
      S-a  MISS   outcome=success
      S-b  MISS   outcome=success
      S-c  MISS   outcome=success
      caught 0 of 3
      faithful arm: 0 false red(s), outcome=success
      ```

      **caught 0 of 3** — not a weak signal but no signal: all three arms return `success`.
      Recorded in the same commit that first adds the directory, checkable with
      `git log --diff-filter=A -- tests/design-artifacts/fixtures/ui-port-losses/`. The probe's
      catch predicates are deliberately phrased over what reached the operator (outcome plus
      emitted text) rather than over a code path, so the identical command is runnable before
      and after and the two numbers are comparable.

## Phase 2 — An id, not a substring

- [x] **2.1 Replace containment with exact matching** in `coverage_gaps`
      (`…/work_engine/directives/ui/apply.ts:190`, today
      `entries.some((entry) => entry.includes(needle))`). A declared item is accounted for when a
      bucket entry equals it, not when some entry contains it.
      verify: arm `S-a` halts with `apply_coverage_missing` after the change and passes before it —
      both asserted in the same test, so the arm is proven red-first.
      Done 2026-09-29. `coverage_gaps` is now the halting half of a new `coverage_report`, which
      returns `{gaps, fallbacks}`; the wrapper keeps the old name and signature so the existing
      port tests and the CLI pinning test are untouched. Matching is `entry === needle`.
      **Both limbs in one test** (`2.1 — an id, not a substring`): the pre-change rule is
      reproduced in the test as `legacyContainmentGaps` and asserted to return `[]` for `S-a`,
      so the "passed before" half stays checkable at every future commit instead of only at the
      branch point; the post-change half asserts `blocked` plus `` `tab` appears in no coverage
      bucket `` and asserts the four accounted-for items are NOT reported. Table case pins
      `tab`/`tab` and `tab`/`TAB` as accounted, `tab`/`table sort order` and `tab`/`the stab
      wound` as gaps. Red first: all 5 Phase-2 tests failed before the edit, the S-a one with
      `expected 'success' to be 'blocked'`. **Sensitivity proven:** `entry === needle` reverted
      to `entry.includes(needle)` → exactly those 5 failed, Phase 1's 4 stayed green; restored
      from `/tmp` copy, 9/9.
- [x] **2.2 Keep containment as a warned fallback for one release**, so an existing consumer
      envelope written against the old matching does not halt without warning.
      verify: an envelope that only matches by containment emits the fallback warning and does not
      halt; the same envelope halts once the fallback is removed.
      Done 2026-09-29. `coverage_report(provided, coverage, allow_annotated_fallback = true)`.
      A non-exact entry that *mentions* the item is a `fallbacks` entry, not a gap, and the
      warning reaches the operator in `StepResult.message` on an otherwise-successful port.
      Removal is a one-line default flip, and the third argument is what makes the second limb
      of the verify a direct assertion rather than an edit: the same envelope yields
      `fallbacks: 1, gaps: 0` with the fallback on and `gaps: 1` with it off.
      · **FINDING — 2.1's verify and 2.2's verify are jointly unsatisfiable as written.** Under
      *plain* containment as the fallback, `S-a` matches (`"table sort order".includes("tab")`)
      and therefore warns instead of halting, contradicting 2.1's "halts with
      `apply_coverage_missing`". One of the two had to be narrowed, so the narrowing was taken
      from the code's own stated reason for containment — the docstring at `apply.ts:152-154`
      says it exists so "an entry may carry its own explanation". Measurement unit published
      before the rule: an entry **mentions** an item when the item occurs in it delimited on
      both sides by a non-`[a-z0-9]` character or a string edge. `subscribe submit — dropped`
      mentions `subscribe submit`; `table sort order` does not mention `tab`. That is strictly
      narrower than the containment it replaces and strictly wider than equality, it preserves
      every case containment was documented as buying, and it drops exactly the case this
      roadmap exists to catch. Both verifies then hold, and the two existing envelope shapes in
      `provided_artifact_port.test.ts` (`subscribe submit — translated to a form action`,
      `rule-draw — keyframe dropped, …`) keep passing — now as warnings rather than silence,
      which is what "does not halt without warning" asks for.

## Phase 3 — Handing work back is not success

- [x] **3.1 An all-`flagged` port stops returning `Outcome.SUCCESS`.** `run` returns
      `Outcome.SUCCESS` at `apply.ts:129` whenever `coverage_gaps` is empty, and an envelope that
      puts every declared item in `flagged` produces exactly that. Report the outcome in shadow
      first — the step result carries the enumerated unflagged-nothing case in its message without
      changing the outcome value.
      verify: arm `S-b` produces the shadow line; the faithful arm does not.
      Done 2026-09-29. `CoverageReport` now carries `declared` and `handed_back`, and
      `carried_nothing(report)` is true only when there is a declared inventory and **every**
      item in it is accounted for solely by `flagged`. `run` appends the line to
      `StepResult.message`; the outcome stays `SUCCESS`, asserted explicitly so the shadow
      release is a recorded state rather than an intention. Narrowness is the design point and
      is tested: a port that flags three of five is NOT the carried-nothing case. Probe after
      this step: **`caught 2 of 3`** — and `S-b` reads `CATCH outcome=success`, which is the
      shadow working. **Red first:** the S-b assertion failed with `expected '' to contain
      'carried nothing'` before the edit. **Sensitivity proven twice**, because two of the four
      assertions are absence-assertions that would otherwise pass vacuously: (A) condition
      disabled → only the S-b test failed; (B) `carried_nothing` widened from
      `handed_back.length === declared.length` to `> 0` → exactly the two absence-assertions
      failed (faithful arm, and flagged-some-but-not-all), 2 failed / 35 passed. Restored from
      `/tmp` copy after each, 37/37.
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

| ID | ownership | resolved by | decision | evidence | revisit if |
|---|---|---|---|---|---|
| D1 | reversible-technical | evidence | Fix the three matching/outcome/scan defects and leave the inventory source alone, rather than deriving the inventory from the artefact in the same roadmap | The derived denominator needs a browser capture path and an unresolved row-source decision; the three defects need neither, and each is a few lines at `apply.ts:129,190,268` | The row-source owner decision lands and a derived inventory makes exact id matching moot |
| D2 | reversible-technical | evidence | Shadow-then-flip the outcome change rather than flipping directly | An engine outcome is a surface existing callers branch on, so the flip is only safe once the shadow shows who reads it | No caller is found to branch on `SUCCESS` from this directive |
