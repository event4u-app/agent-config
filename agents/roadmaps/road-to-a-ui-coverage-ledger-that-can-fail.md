---
complexity: lightweight
status: ready
execution:
  mode: phase-checkpoints
estate_growth_exempt: "open_blockers 40 to 41 (+1) — measured by check_estate_count on this diff, not predicted, and superseding this roadmap's earlier active_roadmaps claim for the inbox-2026-09-ab round, which authorised that diff and not this one. The one new entry is `shadow-release-window`, and it is a promotion rather than an addition: the gate it records already existed in step 3.2's own verify line as the prose clause `after 3.1 has shipped one release`, and the condition is factually unmet — `git tag --contains 2b6a0f551` printed nothing on 2026-09-30, the newest tag 16.1.0 dating 2026-09-28 against 3.1's 2026-09-29. What changes is only whether a machine can see it. The continuation ladder and the stop-slot concern read the inline `blocked-by:` marker and never the prose, so before this diff every fresh autonomous run was handed 3.2 as its next executable step and could not do it; after it, the same run reads the step as held and moves on. The counter-move — leaving the gate unrecorded to keep the number flat — is what the ratchet exists to prevent in the other direction: it would hide a real hold rather than retire one. Offsetting is not available either, because the other three open steps closed in this same diff (4.1, 5.1, 5.2) and closing them is what left this single genuine hold standing."
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
- [ ] <!-- blocked-by: shadow-release-window | asked: no — autonomous process-full run, which reports once at the end and cannot put a question; the gate is an elapsed release tag, not a decision --> **3.2 Flip the shadow to a non-SUCCESS outcome**, with the affected item ids enumerated in
      the message.
      verify: arm `S-b` is not `SUCCESS` after the flip; the faithful arm still is. The flip lands
      in its own change, after 3.1 has shipped one release.
      **Held on `shadow-release-window`, promoted from prose to a structured blocker 2026-09-30.**
      The release condition was recorded only in this step's own verify line, and the continuation
      ladder reads the inline marker and nothing else — so every fresh run was being handed 3.2 as
      its next executable step. The gate is unmet as a matter of fact:
      `git tag --contains 2b6a0f551` prints nothing, and the newest tag `16.1.0` dates 2026-09-28
      against 3.1's 2026-09-29, so no release carries the shadow.
      · **D2's `revisit if` was probed this run and does NOT fire.** It reads "no caller is found
      to branch on `SUCCESS` from this directive" — one is found. `dispatcher.ts` branches on the
      value three ways: it skips a step already marked `SUCCESS` (`:140`), halts the run on
      `BLOCKED` (`:181`), and returns `SUCCESS` as the run's own outcome (`:194`). The flip is
      therefore the surface change D2 anticipated, and the shadow release stays load-bearing.
      · **Two things the flip must carry, found while probing and recorded so the next run does not
      rediscover them.** `dispatcher.ts:264` raises when a step returns `BLOCKED` or `PARTIAL`
      with no questions, so the flip has to surface a numbered option, not just change a value —
      it is a design change, not a one-line edit. And Phase 5's clearance criterion is already
      met: 5.2's verdict is no null, so nothing but the release window holds this step.
      · **The marker's effect is measured, not assumed.** Parsed with the real reader
      (`src/scripts/_lib/blocked_by_marker.ts`, `parseBlockedByMarker`) over this file:
      `{done: 8, open: 0, blocked: 1}`, `id=shadow-release-window`, `asked=false`. Before this
      diff the same read was `{done: 5, open: 4, blocked: 0}` — four boxes the ladder considered
      executable, one of which nobody could execute. The dashboard is unmoved either way, which
      is the point: the box stays `[ ]`, the roadmap stays unarchivable, and only the machine's
      read of it changes.

## Phase 4 — The placeholder scan reads the files

- [x] **4.1 Scan the changed written files for placeholder patterns** in addition to
      `envelope['rendered']` (`apply.ts:268`, today `placeholder_paths(envelope['rendered'])`).
      Changed set only — never a tree sweep.
      verify: arm `S-c` halts with `apply_placeholders_in_output`; removing the file-side scan makes
      the same arm pass, asserted as the sensitivity control.
      Done 2026-09-29, box flipped 2026-09-30 after re-verifying the clause live rather than
      trusting the code's presence. `written_file_placeholders(envelope, root)` reads
      `envelope['files']` — the declared changed set, never a tree sweep — and
      `_placeholder_violations_in_output` unions it with the existing `rendered` scan, so the two
      sides of the pair are one halt. Landed in `2b6a0f551` (`git log -S written_file_placeholders`),
      which is why the box was left unflipped: the code shipped inside 3.1's commit and the
      checkbox was not carried with it.
      **Verified live at this branch point, not read off the diff:** `npx vitest run
      tests/scripts/work_engine/ui_port_losses.test.ts` → 18 passed at HEAD, and the probe reports
      `S-c  CATCH  outcome=blocked`. Both limbs of the verify are permanent assertions rather than
      a one-time demonstration — `S-c halts naming the written file` asserts `blocked` plus the
      path `written/S-c/panel.html`, and the sensitivity control asserts the other side directly
      (`placeholder_paths(env['rendered'])` is `[]` while
      `written_file_placeholders(env, REPO).length` is `1`), so "removing the file-side scan makes
      the same arm pass" stays checkable at every future commit instead of only at this one.
      Risk 4's false-positive guard is asserted beside it: an absent or unreadable path is skipped,
      not reported, and an envelope naming no files reads nothing.

## Phase 5 — Say what changed, against the pre-registered number

- [x] **5.1 Re-run 1.2's command and record `caught N of 3` after the three fixes**, beside the
      before-number in the same README.
      verify: the two numbers sit in one table with the command that produced each; the faithful
      arm's false-red count is recorded and is zero.
      Done 2026-09-30. README § *After the three fixes* carries both rows in one table —
      `caught 0 of 3` (registered 2026-09-29) and `caught 3 of 3` (measured 2026-09-30) — each
      against the identical command, plus the verbatim after-run block. **0 → 3 of 3, zero false
      reds.** The probe was not re-specified for the after-run: Phase 1 wrote its predicates over
      what reached the operator rather than over a code path precisely so the same command is
      runnable on both sides, and that is what makes the two numbers comparable rather than
      merely adjacent. Asserted, not eyeballed — four tests in `ui_port_losses.test.ts` pin both
      numbers, the command's presence in all three places, the `0 false red(s)` string, and the
      live arm behaviour behind the after-row. **Sensitivity proven:** `Verdict: no null` →
      `Verdict: inconclusive` and `caught 3 of 3` → `caught 9 of 3` failed exactly the two
      expected tests; removing the `0 false red(s), outcome=success` string failed exactly three.
      Restored, 22/22 green.
      · **The after-number is measured at the shadow state and is invariant under the pending
      3.2 flip — measured, not argued.** The flip was simulated locally (`_handed_back_line`
      non-null returning `Outcome.PARTIAL` with a question) and the identical command re-run:
      `caught 3 of 3`, `0 false red(s)`, with the sole difference anywhere in the output being
      S-b's outcome column reading `partial` instead of `success`. So closing 5.1 ahead of 3.2 is
      not a number taken early — the probe scores whether the loss reached the operator, and the
      flip moves the column, not the score. The simulation was reverted and the tree re-verified
      before any commit.
- [x] **5.2 A null is an outcome.** If the faithful arm raises a red that the before-run did not,
      that is the finding and Phase 3.2 does not flip.
      verify: the README states the verdict either way, naming the arm.
      Done 2026-09-30. README § *The faithful arm's verdict* states it by name: **no null — the
      `faithful` arm raises zero findings after all three changes**, `0 false red(s),
      outcome=success`, identical to the before-run and identical again under the simulated 3.2
      flip. Three measurements, no red that the before-run did not already have. A test asserts
      the README says `Verdict: no null` and names the arm, so the verdict cannot be quietly
      softened, and the negative half is asserted against the live gates too — the faithful arm
      is the one file of the four for which `reached()` must be `false`.
      · This step is a **gate on 3.2**, which is why it closes ahead of it in execution order
      despite sitting later in the file: 3.2 was conditional on this arm staying clean, and it
      did. 3.2 is therefore clear on its evidence criterion and held only by
      `shadow-release-window`.
      · Recorded so the result is not read as stronger than it is: this is one faithful arm, not
      a false-positive rate. Risk 4's residual — a file-side scan halting a correct port at a
      scale this fixture does not reach — is untouched by it, and the README says so.

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

## Blockers

### blocker: shadow-release-window
- **Status:** open
- **Owner:** maintainer
- **Class:** 3 — human-only
- **Blocks:** Phase 3 — step 3.2, and **AC-2 with it**. Phases 1, 2, 4 and 5 are closed and
  this blocker does not reach them; the roadmap's measurement half is complete and recorded.
  AC-2 asks that each planted loss be caught *by a named halt or outcome*, and S-b is caught
  today by a message on a `SUCCESS` outcome — which is what the shadow release is, and which
  is short of what AC-2 asks for. AC-1, AC-3, AC-4 and AC-5 are met and were re-verified on
  2026-09-30: the before-count was registered in the directory's first-add commit; the
  faithful arm raises zero findings; `apply.ts` is byte-unchanged on this branch and
  `src/cli/commands/uiAudit.test.ts` is green at 17 tests, so `COVERAGE_BUCKETS` and its
  pinning test are untouched; and `git diff --name-status origin/main...HEAD` lists three
  files, none of them a skill, rule, command verb, hook or ledger format.
- **Question:** none. Nothing is being decided — the gate is an elapsed release, and the
  decision it depends on was already taken as D2.
- **Recommendation:** clear it by doing nothing special. The next routine release carries 3.1
  automatically, and cutting one early buys a three-line outcome flip no schedule is waiting on.
- **If you do nothing:** 3.2 stays open and the all-`flagged` port keeps reporting `SUCCESS`
  with a shadow line beside it. That is the designed intermediate state, not a degradation:
  the loss already reaches the operator in words (the probe scores `S-b CATCH` today), so what
  is deferred is the outcome *value*, not the signal. The standing cost is that a caller
  branching on `SUCCESS` still sees success for a port that carried nothing.
- **What to do:**
  1. Probe the gate first — it is one command and it is the whole condition:
     `git tag --contains 2b6a0f551`. Empty output means no release carries 3.1 and 3.2 stays
     held; any tag means the window is open.
  2. Once a tag prints, 3.2 is ordinary implementer work and needs no further clearance:
     make `_handed_back_line`'s non-null branch return a non-success outcome from
     `src/agent-src/templates/scripts/work_engine/directives/ui/apply.ts`, enumerating
     `report.handed_back` in the message.
  3. Carry a numbered option with it. `dispatcher.ts:264` raises when a step returns `BLOCKED`
     or `PARTIAL` with no questions, so a bare value change fails at runtime.
  4. Re-verify with `npx vitest run tests/scripts/work_engine/ui_port_losses.test.ts` and
     `npx tsx tests/design-artifacts/fixtures/ui-port-losses/probe.ts`. Expected: S-b's outcome
     column moves off `success`, `caught 3 of 3` and `0 false red(s)` both unchanged — measured
     under simulation on 2026-09-30, so a different result is the finding. The
     `3.1 deliberately does not change the outcome value` test is superseded by the flip and is
     replaced, not deleted.
- **Resolved when:** `git tag --contains 2b6a0f551` prints at least one tag. Probed
  2026-09-30: empty — the newest tag `16.1.0` dates 2026-09-28 and 3.1 landed 2026-09-29.

> **Why class 3, with the capability test applied rather than assumed.** The agent can write
> every line of 3.2 — the blocker is not the edit. It is the release, and a release cut is a
> tag push onto the production trunk, which sits on the Hard Floor's excluded list
> ([`non-destructive-by-default`](../../src/rules/non-destructive-by-default.md)). Cutting one
> to unblock a roadmap step would also be the roadmap deciding when work ships, which template
> rule 13 forbids outright. So this is the narrow legitimate case: a wait that is factually
> mandatory, whose condition is nonetheless machine-verifiable — which is why `Resolved when`
> leads with the command instead of asking anyone to judge.

## Decisions

| ID | ownership | resolved by | decision | evidence | revisit if |
|---|---|---|---|---|---|
| D1 | reversible-technical | evidence | Fix the three matching/outcome/scan defects and leave the inventory source alone, rather than deriving the inventory from the artefact in the same roadmap | The derived denominator needs a browser capture path and an unresolved row-source decision; the three defects need neither, and each is a few lines at `apply.ts:129,190,268` | The row-source owner decision lands and a derived inventory makes exact id matching moot |
| D2 | reversible-technical | evidence | Shadow-then-flip the outcome change rather than flipping directly | An engine outcome is a surface existing callers branch on, so the flip is only safe once the shadow shows who reads it | No caller is found to branch on `SUCCESS` from this directive |
