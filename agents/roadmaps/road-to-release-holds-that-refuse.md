---
complexity: structural
status: ready
execution:
  mode: phase-checkpoints
owner: maintainer
relates: []
estate_growth_exempt: >-
  Receiver for the one survivor of inbox round `inbox-2026-09-w` batch 2 that no artefact in the
  tree owns: the repository models four roadmap step states and no fifth state for "valid to
  develop, must not publish". Verified 2026-09-11 — `grep -rliE 'release.hold|release_safety|
  release-safety' src/ docs/ .github/` returns zero hits, and `grep -ln 'templates/roadmaps.md|
  release.ts|release-gate-locality|release-validation' agents/roadmaps/*.md` returns empty, so
  no active roadmap owns the template or the release path. Also grows open_blockers by two,
  both of which close inside Phase 1 and Phase 0 respectively.
estate_offset_exempt: >-
  Nothing in the active estate can be offset against this. The active roadmaps are host-delivery,
  grant-persistence, decision-closure, adversarial-verification and settings-writer debt; none
  touches the release path, so archiving one to buy the slot would dispose of somebody else's
  open work to record a decision about this one. The nearest offset candidate,
  `agents/roadmaps/stubs/road-to-release-placeholder-guard.md`, has been held on this same
  estate wall for 21 days and is itself blocked — it cannot be the trade.
---
# Road to release holds that refuse

> **Source:** `agents/tmp.old/inbox-2026-09-w/roadmap-release-blocker/` — a deferred inbox batch
> (four plan revisions plus the originating transcript), analysed 2026-09-11. The governing
> constraint is one sentence the owner wrote once in that transcript: *mid-roadmap releases must
> stay possible, and a broken intermediate state must not ship by accident.* Claim verification
> at HEAD: 24 of 31 claims still true, 2 overtaken by work that shipped since, 3 never true at
> drafting, 2 unverifiable. The three corrected steps below are tagged
> `corrected-from-reproduction`.

## Goal

A roadmap declares, in a form one evaluator reads, exactly which of its intermediate tree states
must not be published — bound to the checkboxes that open and clear that state — and all four
release boundaries refuse to publish while such a state is open **or cannot be evaluated**. An
unfinished roadmap never blocks a release, and normal CI never reddens for a valid open window.

The two halves are equally load-bearing. Today the release path is roadmap-blind
(`src/scripts/release.ts` is 1,826 lines with exactly one occurrence of the word `roadmap`, at
`:320`, inside a comment), and the template forbids a roadmap from saying anything about shipping
at all (rule 13). So the state exists in the tree — four of seven active roadmaps were mid-flight
when 15.0.0 shipped — and nothing can express it, let alone refuse on it.

## Phase 0 — Measure first, and record the honest null up front

- [ ] **0.1 Count release-coupling prose across all four roadmap folders.** Write the count, the
      search terms and the per-file hits to `agents/evidence/analysis/`.
      verify: the file records that the **active** corpus holds zero release-coupling sentences
      at HEAD, and that the last known instance closed in
      `agents/roadmaps/archive/road-to-a-graph-that-is-shipped.md:960-961`, where its two coupling
      risks read MITIGATED (`:973`) and DISCHARGED (`:978`). Zero is the recorded finding, not a
      failure of the sweep. `corrected-from-reproduction` — the source step pointed at
      `:569-570` of an active file; the file is archived and the line numbers moved.
- [ ] **0.2 Record the HEAD exposure row.** For each active roadmap, the count of `[x]` and `[ ]`
      steps; a file with both is mid-flight and is what this mechanism is for.
      verify: the row is in the same evidence file and names four of the seven active roadmaps as
      mid-flight, with their counts. `corrected-from-reproduction` — the source asked for a
      30-tag historical sweep; that needs 30 `_lib/base_tree` materialisations, so cost it before
      scheduling and state the HEAD row separately, since it is the only row a reader can act on.
- [ ] **0.3 Enumerate the four release entry points against their consumer.** `release.ts`
      pre-flight, `src/config/release-gate-locality.yml`, `release-validation.yml` / `ci-strict`,
      `release-guard.yml` on the pushed tag.
      verify: the table has four rows and each names the file and line its refusal would be
      wired into.
- [ ] **0.4 Pre-register the claim as unbacked, with its falsifier and denominator.**
      `release-hold-refuses-declared-state` in `docs/CLAIMS.md`: *after 30 tags past Phase 4, at
      least one refusal logged OR at least one gated draft re-sequenced to continuous at
      authoring time — else honest null.*
      verify: `./scripts-run src/scripts/check_claims` passes and the row carries the denominator.

## Phase 1 — The contract, before any file carries a marker

- [ ] **1.1 Split template rule 13.** The version/tag/date prohibition stays byte-identical. The
      new second half says roadmaps do not decide when or in which version work ships, and MUST
      declare any intentionally unreleasable intermediate state together with its machine-verified
      clearance.
      verify: `git diff` shows the prohibition sentences unchanged character for character, and
      `./scripts-run src/scripts/lint_roadmap_complexity` is green on every active roadmap.
- [ ] **1.2 Add template rule 27** — marker grammar, entry shape, the state table, the channel
      vocabulary, per-folder lifecycle, and the authoring order `re-sequence → guard → hold` with
      a mandatory `Why not a guard:` field. Rule 27 states as its own non-goal that roadmap
      *incompleteness* is never a release condition.
      verify: the template's numbered rules run 1–27 (`grep -cE '^[0-9]+\. \*\*'` reads 27, up
      from 26) and rule 27 carries the non-goal sentence verbatim.
- [ ] **1.3 Rule 20 gains one sentence** distinguishing the two mechanisms: a blocker stops
      execution, a hold stops publication.
      verify: `./scripts-run src/scripts/lint_roadmap_blockers` stays green on every active
      roadmap — the pre-change baseline was measured green on 2026-09-11.
- [ ] **1.4 `new_roadmap.ts` emits the `## Release holds` block as a comment**, and the authoring
      self-check lands in `roadmap-writing/SKILL.md` and `/roadmap:create`, logging every
      `gated → re-sequenced` outcome so Phase 6 has a numerator.
      verify: `./scripts-run src/scripts/new_roadmap probe --stdout` shows the commented block,
      and `evals/triggers.json` gains one positive case whose expected output is a re-sequenced
      phase rather than a hold.

## Phase 2 — The evaluator, and the glob nobody has paid for yet

- [ ] **2.1 Write `src/scripts/_lib/release_holds.ts`** — parse and evaluate. Reuse
      `check_roadmap_trackable`'s checkbox and fence parser and `lint_roadmap_blockers`' marker
      grammar. No third parser.
      verify: neither helper is copied — `grep -n 'from .*roadmap_trackable\|from .*roadmap_blockers'`
      in the new lib resolves, and the two existing gates stay green.
- [ ] **2.2 Write `src/scripts/check_release_holds.ts`** with `--lint`, `--status`,
      `--require-safe [--channel latest|all]` and `--selftest`.
      verify: `--selftest` covers every state-table row **including the not-evaluable row**, where
      a fixture the evaluator cannot read yields a refusal and never a pass.
- [ ] **2.3 Measure the wider glob before wiring it.** `corrected-from-reproduction` — the source
      claimed `check_roadmap_trackable` already scans every folder and that the precedent exists.
      It does not: `check_roadmap_trackable.ts:71` sets
      `EXCLUDE_DIRS = new Set(['archive','skipped','stubs','later'])` and the unfiltered walk at
      `:274` exists only for `assertScanned`'s dead-scope count. Scanning 85 `later/` files and
      710 archived ones for content is new work on the release hot path.
      verify: the measured p95 runtime over the real corpus is recorded in the Phase 0 evidence
      file and sits under the budget derived there; no index is built in v1.

## Phase 3 — Lifecycle integrity

- [ ] **3.1 The archival and skip paths refuse to move a file with an open window**, and a
      `later/` move requires the window named in `entry_condition.what`.
      verify: a fixture move to `archive/` or `skipped/` with an open window is refused naming
      the hold id; a move to `later/` succeeds, `--status` still lists it, and a release is still
      refused.
- [ ] **3.2 Record deletion as a residual, not a mitigation.** Deleting a file removes its window
      and no gate sees it; template rule 12 already forbids the delete.
      verify: the residual is a Risk Register row in this file, and no acceptance criterion claims
      it is solved.

## Phase 4 — Wire all four boundaries to one refusal

- [ ] **4.1 `release.ts` pre-flight before step 1.** The refusal names the roadmap, the hold, its
      opener, its closer and the closer's `verify:` command, plus the three ways out: finish the
      clearer, cut `-next.N`, or use a release line per `docs/contracts/release-trunk-sync.md`.
      verify: a fixture tree with an open `latest` hold refuses at the pre-flight with all five
      fields in the message.
- [ ] **4.2 One row in `src/config/release-gate-locality.yml`** (`verify: true`, `network: false`),
      plus the `release-validation.yml` job, `ci-strict`, and `release-guard.yml` on the
      checked-out tag.
      verify: `./scripts-run src/scripts/release_verify --list` shows the new row — the registry
      was reproduced live on 2026-09-11 with 8 jobs, 4 carrying local commands — and
      `./scripts-run src/scripts/check_ci_strict_superset` stays green.
- [ ] **4.3 An evaluator error, timeout, or unreadable file refuses the cut.** There is no path
      on which "could not evaluate" reads as safe.
      verify: `release_drill` gains three scenarios — open `latest`, open `all`, evaluator error —
      and the error scenario exits non-zero.
- [ ] **4.4 No override, and no silent channel redirect.** A plain `X.Y.Z` cut is never
      auto-converted to `-next.N`; the hint is offered and the decision stays the operator's.
      verify: `grep -rn 'force\|override\|accept-risk' src/scripts/check_release_holds.ts` returns
      no flag, label or trailer that bypasses a refusal, and `Channel: all` is the parsed default.

## Phase 5 — Adversarial proof, each case with a known-red arm

- [ ] **5.1 Write the sabotage set**, one assertion per case, no case shared: delete a clear
      marker after opening · flip a clear `[x]` back to `[~]` · `[x] → [-]` with and without a
      `Closed by:` field · duplicate hold id · move to `later/`, `archive/`, `skipped/` · a marker
      that is not on a checkbox · a clear with no `verify:` · a fenced documentation example · a
      hand-made release PR · a hand-pushed tag · the evaluator killed mid-run.
      verify: the test file lists all eleven cases and each asserts its own exact refusal message.
- [ ] **5.2 Prove sensitivity — neutralise the guard, watch each case fail, restore it.** A test
      never seen red has unknown sensitivity.
      verify: the commit message or the test file records the red reading per case, taken with the
      guard neutralised.
- [ ] **5.3 Prove it does not over-fire.** A valid unfinished `continuous` roadmap and an
      unopened window both pass.
      verify: both negative cases are in the same test file and are green.

## Phase 6 — Evaluate the claim after 30 tags, and accept the null if it comes

- [ ] **6.1 Read the refusal log, the re-sequence log and a re-taken Phase 0 prose count**, then
      flip `release-hold-refuses-declared-state` to `backed` or `honest-null`.
      verify: the claim row carries both numbers and the tag range it was measured over.
- [ ] **6.2 On an honest null, keep the primitive and strike only the free parts** — the boundary
      screen line and the runbook bullet — and record the disposition on rule 27 with the tag
      range. Deleting the primitive is not the null disposition: the owner's constraint is that a
      broken state must not ship, and a mechanism whose value stayed latent is not one that failed.
      verify: the disposition sentence is in the template beside rule 27, naming the tag range.

## Blockers

### blocker: rule-13-amendment
- **Status:** open
- **Owner:** maintainer
- **Class:** 3 — human-only
- **Blocks:** Phases 2 through 6. Template rule 13 is contract layer, and until it is split a
  hold marker in any roadmap is a rule-13 violation by the letter of the rule.
- **What to do:** approve the split in Phase 1.1 — the prohibition half stays byte-identical and
  the new half is additive. Read `src/agent-src/templates/roadmaps.md:62-66`, which is the exact
  text that must survive unchanged.
- **Recommendation:** approve. The prohibition the rule exists for (versions, tags, dates in
  roadmaps) is untouched; what is added is the obligation to declare a state the tree already has
  and currently cannot name.
- **If you do nothing:** Phase 1 stops at 1.1 and no later phase can start, because every one of
  them writes or reads a marker the template forbids.
- **Resolved when:** `src/agent-src/templates/roadmaps.md` carries rule 27 and rule 13's
  prohibition sentences are byte-identical to `git show HEAD:src/agent-src/templates/roadmaps.md`
  at the commit this roadmap landed.

### blocker: zero-live-subjects
- **Status:** open
- **Owner:** maintainer
- **Class:** 3 — human-only
- **Blocks:** the migration value of Phase 4, not Phase 4 itself. The one migration candidate the
  source named is archived and both its coupling risks are discharged, and the active corpus
  carries zero release-coupling prose at HEAD.
- **What to do:** decide whether the mechanism ships against a latent need. Run
  `grep -rniE 'same release|release condition|ship together|must land in the same' agents/roadmaps/*.md`
  — it returns nothing today. Then read the exposure row from Phase 0.2: four of seven active
  roadmaps were mid-flight when 15.0.0 shipped, which is the population this would have protected.
- **Recommendation:** ship it, and say so in the Phase 0.4 falsifier rather than discovering it at
  Phase 6. A constraint the owner stated once is not weakened by the absence of a current
  violation, but a claim that pretends there was one is.
- **If you do nothing:** Phase 4 lands a mechanism with no exercised path, and Phase 6 reads as a
  surprise instead of as the outcome the claim already predicted.
- **Resolved when:** either a live subject is named with a `file:line` in the Phase 0 evidence
  file, or that file records the honest-null branch as the accepted plan.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-09-11 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | Zero live subjects at HEAD | product | The proposal's own migration target is archived and the active corpus is clean, so the mechanism may ship having never been exercised against a real case | Phase 0.1 records the zero as the finding rather than hiding it; Phase 0.4 pre-registers the falsifier with a denominator; Phase 6.2 keeps only the free parts on a null | Phase 0 — Measure first, and record the honest null up front |
| 2 | Holds become the default answer | product | A hold is easier to write than a re-sequenced phase, so trunk ends up held most of the time and the mechanism inverts into the blocker it replaced | Rule 27 mandates `re-sequence → guard → hold` with a `Why not a guard:` field; the Phase 1.4 re-sequence log is Phase 6's numerator | Phase 1 — The contract, before any file carries a marker |
| 3 | The marker lies in the safe direction | implementation | A marker is only as honest as the checkbox flip, and the `verify:` flip-guard is prose in the process loop, not a deterministic gate | Both opener and closer carry `verify:`; the Phase 5 sabotage set targets exactly the dishonest flip; the guard's instruction-only status is stated rather than implied to be enforcement | Phase 5 — Adversarial proof, each case with a known-red arm |
| 4 | The wider glob costs more than assumed | implementation | No gate scans `later/` or `archive/` for content today, so 85 plus 710 files enter the release hot path with no precedent to inherit a budget from | Phase 2.3 measures p95 over the real corpus before anything is wired; active corpus first and `later/` as backstop only; no index in v1 | Phase 2 — The evaluator, and the glob nobody has paid for yet |
| 5 | A file with an open window is deleted | implementation | Deletion removes the window and bypasses the lifecycle guard entirely | Template rule 12 already forbids the delete; recorded as a residual in Phase 3.2 and not claimed as solved | Phase 3 — Lifecycle integrity |
| 6 | A refusal lands mid-emergency | implementation | A live hold discovered at cut time costs a day if the clearing step is heavy | Boundary screen at phase entry; `release:verify` before the push; the release-line path is named inside the refusal text itself | Phase 4 — Wire all four boundaries to one refusal |
| 7 | The rule 13 amendment reads as a licence | product | "Target release" creeps back into roadmaps once the rule is touched at all | The prohibition stays byte-identical; rule 27 forbids versions and dates inside hold entries; the existing version regexes are unchanged and were measured green | Phase 1 — The contract, before any file carries a marker |

## Acceptance Criteria

- [ ] AC-1 — A roadmap can name an unreleasable intermediate state, and that state is bound to
      the checkbox that opens it and the checkbox that clears it. Today no vocabulary for this
      exists anywhere in `src/`, `docs/` or `.github/`.
- [ ] AC-2 — All four release boundaries refuse to publish while such a state is open, with one
      script and one message naming roadmap, hold, opener, closer and the closer's `verify:`.
- [ ] AC-3 — An evaluator error, timeout or unreadable file refuses the cut. No path exists on
      which "could not evaluate" is treated as safe.
- [ ] AC-4 — An unfinished roadmap with no declared window never blocks a release, and normal CI
      on a tree carrying a valid open window is green.
- [ ] AC-5 — A malformed or ambiguous hold declaration reddens normal CI, so a broken declaration
      cannot fail open.
- [ ] AC-6 — Moving a roadmap to `later/`, `archive/` or `skipped/` cannot make an open window
      disappear from `--status` or from the release refusal.
- [ ] AC-7 — No override flag, label or commit trailer bypasses a refusal, and a plain `X.Y.Z`
      cut is never silently converted to a prerelease channel.
- [ ] AC-8 — Every sabotage case has been observed red with the guard neutralised and green with
      it restored, and both non-over-firing cases pass.
- [ ] AC-9 — `release-hold-refuses-declared-state` carries a verdict measured over a named tag
      range, and an honest null is recorded as a disposition rather than as a deletion.
