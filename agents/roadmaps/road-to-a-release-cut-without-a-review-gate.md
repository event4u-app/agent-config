---
complexity: lightweight
status: ready
review_by: 2026-12-21
tree_pin: 811cea61d6
estate_growth_exempt: "Created on 2026-11-21 on the owner's instruction to plan the measures of that day's session retrospective as roadmaps and work them off (measure 20, P2). No open, later or stub roadmap owns the worktree-capable tag step, the release-PR review skip or the measured determinism of evaluator metrics."
estate_offset_exempt: "road-to-a-release-cut-without-a-review-gate is added on the owner's order of 2026-11-21 to plan every measure of that day's session retro as its own roadmap. No active roadmap is finished, so none was archived to offset it, and folding it into a parked later/ roadmap would hold asked-for work behind that roadmap's entry condition. Owner record: agents/evidence/owner-directives/2026-11-21-session-retro-roadmaps.md."
execution:
  mode: autonomous
relates:
  - slug: road-to-release-notes-that-match-the-span
    relation: disjoint
    note: "It owns what the release notes say and adds a span check before the release PR. This file owns where the cut may run, the release-PR review job and evaluator determinism; 2.3's backstop does not match its span check."
  - slug: road-to-a-release-record-that-says-what-it-reviewed-carried
    relation: disjoint
    note: "later/. Its 2.2 (post-cut delta, owner blocker review-ceiling-is-spend) and A.1-A.3 (self-review coverage, clustering, commit pins) stay its own. 2.2 here only skips the live review on release/* heads of the same workflow and decides nothing about the post-cut delta."
  - slug: road-to-a-release-record-that-says-what-it-reviewed
    relation: disjoint
    note: "archive/. Closed; it shaped the findings ledger that the owner removed as a release gate on 2026-10-22. Nothing here reopens the ledger."
  - slug: road-to-done-claims-with-read-exit-codes
    relation: disjoint
    note: "Sibling from the same retro. The 18.0.0 cut's background job reported exit 0 through a pipe; that exit-code class is owned there, not here."
  - slug: road-to-optimized-ci-and-release-gates
    relation: disjoint
    note: "archive/. Closed; it cut release-PR CI wall-clock, not the tag step, the review job or metric determinism."
  - slug: road-to-release-gate-hardening
    relation: disjoint
    note: "archive/. Closed; it added pre-merge gates for 7.5.0 drift classes. This file adds no gate and removes none of those."
  - slug: road-to-release-review-p0
    relation: disjoint
    note: "archive/. Closed; three P0 findings of one release review, none on the cut mechanics."
  - slug: road-to-gate-council-auto-dispatch
    relation: disjoint
    note: "stubs/. Council auto-dispatch on release gates; 3.1 here runs one council round by hand and does not need auto-dispatch."
  - slug: road-to-feedback-9-29
    relation: disjoint
    note: "archive/. Lexical hit on \"release review\"; a closed review-defect sweep for 9.27-9.29."
  - slug: road-to-feedback-9-35
    relation: disjoint
    note: "archive/. Lexical hit on \"release review\"; a closed defect sweep for 9.35."
  - slug: road-to-legal-review-prep
    relation: disjoint
    note: "archive/. Lexical hit on \"gate review\"; the legal pack's review-prep gates."
  - slug: road-to-orchestrator-first-execution
    relation: disjoint
    note: "archive/. Lexical hit on \"cut gate\"; orchestration delegation, not releases."
  - slug: road-to-plan-governance-gates
    relation: disjoint
    note: "archive/. Lexical hit on \"gate review\"; its R2 completion review fires on roadmap completion and PR creation and names no release PR."
---

# Road to a release cut without a review gate

> **Source:** the owner's session retrospective of 2026-11-21 over ~380 Claude
> Code sessions — pattern C, *review, ratification and release loops without
> convergence*, and measure 20 of its prioritised list (*release cut without an
> extra review gate; tolerance for nondeterministic metrics*) — plus the AI
> council round of the same day (members: anthropic, openai), which grouped
> release-review growth with the review loops and asked for the cause of the
> growth before any limit. Drafted against `main@811cea61d6`.

## Goal

`task release` cuts, tags and publishes from any checkout of reviewed `main` —
including a linked worktree — without waiting for, triggering or inviting a
review, and no evaluator metric that varies on identical content can block the
cut. Which metrics vary is measured from the recorded runs, never declared by
hand.

## Context

From the retro (counts from the condensed transcripts, not re-verified in the
tree):

- **17.0.0 (2026-10-22).** The cut stopped at step 7 for a self-review findings
  ledger; the agent then ran a full self-review (32 requests over 1,308 files),
  dispatched seven fix packages that worked 318 findings, and only cut after the
  owner wrote that releases need no owner review because everything on `main`
  is reviewed and merged. The owner then approved removing the release review
  gates.
- **18.0.0, 18.1.0, 18.2.0.** Each cut from a linked worktree failed the branch
  check first (detached HEAD), and 18.0.0's tag and GitHub Release were set by
  hand because step 9 could not check out `main` — it was checked out in the
  main checkout.
- **20.6.0 (2026-11-20).** Two release-PR runs of identical content measured
  `node_modules_mb` as 145 and 144; the drift check blocked every other run.

Verified against the tree at the pin:

- **The ledger gate is gone and guarded.** `src/scripts/release.ts:39-41` and
  `:1028-1029` keep step 7 as `No review gate`; `docs/release-runbook.md:184-191`
  states the owner decision and `:335-337` greps that `settleFindingsLedger` stays
  out; `tests/scripts/release_findings_ingest.test.ts:24-46` pins that the
  workflow commits no ledger. This roadmap does not redo that work.
- **The release PR is still reviewed.** `.github/workflows/self-review-gate.yml:63-64`
  runs `live-advisory` on every `pull_request`, release heads included, although
  `check_release_pr_shape` limits a release PR to the version-bump allowlist
  (`docs/release-runbook.md`, step 4). An advisory review of a version bump
  still spends requests and posts findings an agent reads as work.
- **Step 9 needs a local `main`.** `src/scripts/release.ts:1043-1045` runs
  `git checkout main` before `git pull --ff-only`, which git refuses in a linked
  worktree while the main checkout holds `main`.
  `src/scripts/_lib/release_position.ts` (`preflightPosition`) accepts only
  `main` or `release/<target>` as start branch, so a worktree on detached
  `origin/main` is refused before step 1.
- **`release.ts` is over its size ratchet.** 1,685 lines;
  `src/scripts/_lib/release_position.ts:5-8` records that growing it fails a
  gate, so new logic goes to `src/scripts/_lib/`.
- **Determinism is a hand flag.** `src/config/evaluator-budgets.json:32-34`
  carries `"deterministic": false` for `node_modules_mb`, added by hand in
  commit `6b74c349f9` (#3000); the two timing metrics carry the same flag
  (`:61`, `:69`). `driftFindings` skips flagged metrics
  (`src/scripts/check_evaluator_budgets.ts:150-173`), and on a release head
  every finding blocks, drift included (`:278`, posture `fail`). The nightly
  writes `agents/evidence/metrics/evaluator-measurements.json`
  (`RECORD_REL`, `check_evaluator_budgets.ts:49`), one value per metric.

Owner constraint (2026-11-21): no hand-maintained or owner-written list or
context file. The determinism class of every metric is computed from recorded
measurements; the set of agent-loaded surfaces the review backstop scans is
derived from the sync manifest at test time.

Out of scope: the release notes' content (owned by
`road-to-release-notes-that-match-the-span`), the post-cut delta decision and
self-review coverage (owned by
`later/road-to-a-release-record-that-says-what-it-reviewed-carried`), and
background exit codes swallowed by a pipe (owned by
`road-to-done-claims-with-read-exit-codes`).

## Phase 1 — The cut runs from a linked worktree

- [ ] **1.1 Failing test first.** Add a scenario
      `worktree-with-main-held-elsewhere` to `src/scripts/release_drill.ts`:
      the FakeWorld refuses `git checkout main` with git's
      `already checked out at` message, and the run must still tag the merge
      commit of the release PR and finish step 11. Add a case to
      `tests/scripts/release.test.ts` where `preflightPosition` gets a detached
      HEAD equal to `origin/main` and must proceed. Both fail on the pin.
      verify: `npx vitest run tests/scripts/release_drill.test.ts tests/scripts/release.test.ts` -> 1
- [ ] **1.2 Tag without a local `main`.** Write
      `src/scripts/_lib/release_tag_target.ts`: after step 8 it fetches
      `origin/main`, resolves the release PR's merge commit, and step 9 tags
      that commit and reads the merged CHANGELOG from it with `git show`,
      never by checking out `main`. `release.ts` calls it in place of
      `:1043-1045`; the line count of `release.ts` does not grow.
      verify: `npx vitest run tests/scripts/release_drill.test.ts` -> 0
- [ ] **1.3 Start from detached `origin/main`.** `preflightPosition` accepts a
      detached HEAD whose SHA equals `origin/main` and creates
      `release/<target>` from it in step 1; any other detached HEAD is refused
      with a message naming the SHA it expected.
      verify: `npx vitest run tests/scripts/release.test.ts` -> 0
- [ ] **1.4 The runbook says so.** `docs/release-runbook.md` names the
      worktree start and the merge-commit tag in steps 1 and 9.
      verify: `grep -c 'worktree' docs/release-runbook.md` -> /^[1-9]/

## Phase 2 — Nothing reviews a release PR

- [ ] **2.1 Failing test first.** Extend
      `tests/scripts/release_findings_ingest.test.ts`: the `live-advisory` job
      of `self-review-gate.yml` carries a condition that is false when
      `github.head_ref` starts with `release/`. It fails on the pin.
      verify: `npx vitest run tests/scripts/release_findings_ingest.test.ts` -> 1
- [ ] **2.2 Skip the live review on release heads.** Add
      `!startsWith(github.head_ref, 'release/')` to `live-advisory`'s `if:` and a
      step on release heads that prints
      `release PR: version bump only, reviewed on main — no review run`.
      `gate-dry-run` stays.
      verify: `npx vitest run tests/scripts/release_findings_ingest.test.ts` -> 0
- [ ] **2.3 Backstop against a pre-cut audit instruction.** Add
      `tests/scripts/release_no_review_instruction.test.ts`: it derives the
      agent-loaded surfaces from the sync manifest (`task sync`'s source list:
      `src/rules/`, `src/skills/`, `src/agent-src/commands/`, `src/domains/`,
      `src/agent-src/contexts/`) and fails on any paragraph that pairs a release
      cut with running a review, self-review, audit or findings ledger before
      it. Content checks of the cut itself (span, holds, shape) are not
      matched. Write it, run it, and fix every hit it reports in `src/`.
      verify: `npx vitest run tests/scripts/release_no_review_instruction.test.ts` -> 0

## Phase 3 — Determinism is measured, not declared

- [ ] **3.1 Pick the mechanism.** First action: run the council
      (`agent-config council:status`, then a council round) on how a metric's
      determinism class is computed — (a) the nightly measures each
      non-timing metric twice on the same packed tarball and records both,
      (b) the record keeps the last N nightly values with their package
      content hash and a metric whose value moved while the hash did not is
      nondeterministic, or (c) both — and on whether drift alone may block a
      release head or only budget and regression findings may. Input: commit
      `6b74c349f9`, `check_evaluator_budgets.ts:150-173` and `:278`. Record the
      verdict as row D1 under `## Decisions`.
      verify: `grep -q '^| D1 ' agents/roadmaps/road-to-a-release-cut-without-a-review-gate.md` -> 0
- [ ] **3.2 Failing test first.** Extend
      `tests/scripts/check_evaluator_budgets.test.ts`: a record where a metric
      carries two different values for the same content hash classifies it
      nondeterministic with no `deterministic` key in the budgets file, its
      drift produces no finding, and its absolute `max` still blocks. Add the
      release-head drift case D1 decided. It fails on the pin.
      verify: `npx vitest run tests/scripts/check_evaluator_budgets.test.ts` -> 1
- [ ] **3.3 Record the evidence.** `src/scripts/record_evaluator_measurements.mjs`
      and `src/scripts/evaluator_umbrella.sh` write what D1 chose (repeat
      values, content hash, or both) into `evaluator-measurements.json`.
      verify: `npx vitest run tests/scripts/evaluator_umbrella_paths_cover_inputs.test.ts tests/scripts/check_evaluator_budgets.test.ts` -> 0
- [ ] **3.4 Read the class from the record.** `driftFindings` derives each
      metric's class from the record and stops reading `deterministic` from
      `src/config/evaluator-budgets.json`; remove the three hand flags and
      `deterministic_note` there, and update every reader
      `grep -rn '"deterministic"\|\.deterministic' src/ tests/` finds.
      verify: `grep -c '"deterministic"' src/config/evaluator-budgets.json` -> 0
- [ ] **3.5 Replay 20.6.0.** Run `check_evaluator_budgets` with
      `--posture fail` against a record that holds both 20.6.0 values (145 and
      144) for one content hash; it passes on drift and still fails when the
      measurement is set above `max`.
      verify: `npx vitest run tests/scripts/check_evaluator_budgets.test.ts` -> 0

## Decisions

No decision is recorded yet. Step 3.1 appends row D1 (ownership
`contested-technical`, resolved by `council:<record>`) from the council round it
runs; until then the table stays empty rather than carry an unresolved row.

| ID | ownership | resolved by | decision | evidence | revisit if |
|---|---|---|---|---|---|

<!-- Release holds — none. resequenced: every phase keeps the cut working at
     each step; Phase 1 replaces the checkout with a tag on the merge commit in
     one change, Phase 2 only skips a review job, and Phase 3 removes the hand
     flags in the same change that derives the class, so no intermediate tree
     state needs to stay unpublished. -->

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-11-21 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | Tagging the wrong commit | implementation | A tag set from a fetched ref instead of a local `main` could land on a commit other than the release PR's merge commit | 1.2 resolves the merge commit from the PR and the drill scenario asserts the tagged SHA; a mismatch refuses before the push | Phase 1 — The cut runs from a linked worktree |
| 2 | A real size regression hidden as noise | product | Classing a metric nondeterministic removes it from the drift check and could hide a real growth | Only a value change with an unchanged content hash classes a metric; the absolute `max` and the regression check stay binding, and 3.5 asserts `max` still fails | Phase 3 — Determinism is measured, not declared |
| 3 | The backstop matches legitimate cut checks | implementation | 2.3 could flag the span, hold or shape checks and turn into noise that gets waived | The test matches only review, self-review, audit and ledger wording and names the paragraph it found, so a false hit is fixed in the matcher, not waived | Phase 2 — Nothing reviews a release PR |
| 4 | Skipping review lets a non-bump change through | product | A release PR carrying more than the bump would no longer be reviewed | `check_release_pr_shape` already refuses anything outside the version-bump allowlist on the release PR | Phase 2 — Nothing reviews a release PR |

## Acceptance Criteria

- [ ] AC-1 — The release drill finishes a cut, tag included, in a scenario
      where `main` is checked out in another worktree, with no hand-set tag.
- [ ] AC-2 — A release PR triggers no live review job, and no agent-loaded
      surface tells the agent to review or audit before a cut.
- [ ] AC-3 — Replayed with the 20.6.0 values, the evaluator check passes on
      drift and still fails above `max`, and
      `src/config/evaluator-budgets.json` carries no `deterministic` key.
- [ ] AC-4 — `npx vitest run tests/scripts/release_drill.test.ts tests/scripts/release.test.ts tests/scripts/release_findings_ingest.test.ts tests/scripts/check_evaluator_budgets.test.ts` exits 0.
