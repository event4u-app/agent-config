---
complexity: lightweight
status: ready
estate_offset_exempt: "Un-parking counts as an ADDITION under one-in-one-out (later/X -> X is classified an addition by classifyDiff), and no archive move is available in this change: it closes a slot-cap blocker rather than finishing a roadmap. The offsetting event already happened in an earlier change -- the two predecessors this file queued behind, road-to-skill-ecosystem-gate-integrity and road-to-skill-ecosystem-authoring-discipline, both sit in archive/, which is why lint_roadmap_family_cap measures 0/2 slots used and why this file's own blocker instructs the move."
estate_growth_exempt: "Measured on this change: active_roadmaps 0 -> 11 and open_blockers 28 -> 36. No roadmap file was created. All sixteen files involved already existed at origin/main; fourteen sat at the active TOP LEVEL carrying status: draft, which excludes them from collect() and made the estate report 0 active while fourteen files of planned work sat in the active tree. The growth is therefore a correction of a bookkeeping state, and the direction it corrects is the one this ratchet exists to make visible: draft-at-top-level was functioning as a second parking lot that no count could see. Every one of the 65 later/ roadmaps was probed against its own stated resume condition on 2026-08-25 and 63 stay parked, each for a named external reason (a real consumer repo, a paid bench arm, host access this tree lacks, an owner-reserved decision, or an empty measurement corpus such as gate-metrics.jsonl at 0 of 10 required events). The two un-parked hold queue positions 3 and 4 of the verification track and had the family slot cap as their only blocker: lint_roadmap_family_cap reports 0/2 slots used with both predecessors in archive/, and eval-integrity own blocker verification-slot instructs the move in as many words. Position 5 stays parked because 3 and 4 fill the cap. Of the fourteen drafts, four stay draft because an owner-reserved blocker gates their Phase 1 (canonical-terms, capability-native-execution, merge-surface-zero, web-launch-readiness) and one stays draft because it carries no canonical Phase heading and check_roadmap_trackable would rightly call it invisible (ten-across-the-board). The +8 open_blockers are pre-existing entries in files that were already in the active tree: this change created no blocker and RESOLVED one, verification-slot, on its stated condition."
---

# Road to eval integrity — gate the measurement inputs, and score direction not magnitude

> **RESUMED 2026-08-25 — queue position 4 reached.** This roadmap was parked
> on one condition only: the 2026-08-05 council capped concurrently-open
> verification roadmaps at two. Both predecessors it queued behind —
> `road-to-skill-ecosystem-gate-integrity` and
> `road-to-skill-ecosystem-authoring-discipline` — now sit in
> `agents/roadmaps/archive/`, and `lint_roadmap_family_cap` measures **0/2 slots
> used**. That is the file's own stated resume test, so it is unparked and open.
> Position 5 (`road-to-skill-ecosystem-security-and-conformance`) stays parked:
> positions 3 and 4 fill the cap.

> Put a gate on this package's own measurement inputs, and fix a named scoring
> defect: a magnitude-weighted verdict punishes a decisively-winning artifact,
> and the permissive direction of that error was verified exhaustively by the
> source that found it.

## Context

Source + verdicts:
[`skill-ecosystem-sweep-2026-08`](../settings/contexts/skill-ecosystem-sweep-2026-08.md).

**Why this is verification infrastructure rather than capability.** Every item
below hardens the machinery that decides whether a change helped. None adds a
user-facing surface. The strongest single finding is a defect, not a feature: one
source proved by exhaustive comparison that weighting a confidence interval by
per-trial magnitude disagrees with the exact test on twelve records up to ten
trials and is the **permissive** side in every one of them, which is why an
artifact that won every trial still failed five consecutive runs.

**The second finding is a gate this package does not have at all.** Ten structural
checks over the eval specifications themselves, every one of which can only fire
on a malformed input rather than on well-written prose. The observed defects it
catches are exactly the class this package's own recorded traps predict: a fixture
referenced but not tracked; a fixture stating the same number twice in
disagreement, so a judge preferred the declared value over the recomputed one and
scored a −40% loss against a correct response; a grader whose configuration is
absent, which parses cleanly and enforces nothing; and a duplicate mapping key,
where the parser silently keeps the last and one case becomes a byte-identical
clone of another with the intended fixture never loaded.

**A third finding removes a self-inflicted floor.** One source derives its minimum
trial count from the test it actually applies rather than choosing a number, then
warns when a specification lands exactly on the floor because a single tie makes a
pass arithmetically unreachable — evidenced by a run where five specifications
raised to exactly the floor all failed, four of them decided before the run
started.

## Gap table

| Item from the sweep | Verdict | Where it lands |
|---|---|---|
| Structural gate over eval specifications | KEEP | Phase 1 |
| Duplicate-key-refusing configuration loader | KEEP | Phase 1 |
| Fixture must be tracked, resolved from the index alone | KEEP | Phase 1 |
| Internal consistency of a fixture that declares a number it also implies | KEEP | Phase 1 |
| Grader configuration completeness | KEEP | Phase 1 |
| Self-test sibling for the new gate | KEEP | Phase 1 |
| Verdict on direction, decided by an exact test | KEEP | Phase 2 |
| Magnitude retained for triage, deciding nothing | KEEP | Phase 2 |
| Trial floor derived from the applied test | KEEP | Phase 2 |
| Warning when a specification lands exactly on the floor | KEEP | Phase 2 |
| Underpowered as a distinct verdict, never a pass or a regression | KEEP | Phase 2 |
| Blind pairwise comparison with a swapped-order repeat | KEEP | Phase 3 |
| A flipped verdict defaults to a tie flagged inconsistent | KEEP | Phase 3 |
| Overfitting classification of the rubric, advisory only | KEEP | Phase 3 |
| Non-discriminating assertion detection | KEEP | Phase 3 |
| Prune every assertion that passes in both arms | KEEP | Phase 3 |
| Frozen predecessor snapshot as the comparison arm | KEEP | Phase 4 |
| Fixture item recoverable only via the prescribed behaviour | KEEP | Phase 4 |
| Missed planted item counts as an implicit zero | KEEP | Phase 4 |
| Transcript leak scan against denied paths | KEEP | Phase 4 |
| Composite identity key including the evaluation criteria | KEEP | Phase 4 |
| Attempt-one-only accounting | KEEP | Phase 5 |
| Completeness precondition before a result may be published | KEEP | Phase 5 |
| Allow-listed failure reasons so an aborted run is recorded | KEEP | Phase 5 |
| Evaluate against the packaged surface, not the source tree | KEEP | Phase 5 |
| Required non-inference section on a measurement artifact | KEEP | Phase 5 |
| Scored register of known unaddressed weaknesses | KEEP | Phase 5 |
| Coverage arithmetic excludes artifacts that cannot self-activate | KEEP | Phase 5 |
| Forbidden-event array in the case shape | KEEP | Phase 1 |
| Declared indeterminate branch on a pre-registered threshold | KEEP | Phase 5 |
| Mutation kill-rate per gate family | FOLD | Deferred to the gate-hardening successor roadmap, which already owns reach measurement |
| Held-out slice | CUT | The authored corpus is the population |
| Score-based regression ratchet across artifacts | CUT | Our own recorded traps say the hard part is a trustworthy score, not the ratchet; the both-files-only exemption rule is kept as an authoring note instead |

## Prerequisites

- [ ] **Step 1:** Inventory the eval and golden-fixture surfaces under `tests/` and `internal/` so Phase 1 gates a real corpus.

## Phase 1: A gate on the measurement inputs

- [ ] **Step 1:** Add `src/scripts/lint_eval_specs.ts` with a duplicate-key-refusing loader that reports both line numbers on a collision.
- [ ] **Step 2:** Assert every referenced fixture is tracked, resolving from the git index alone. A plausible-looking alternative query counts a staged-for-removal file back as tracked and produces a false negative for exactly this bug class.
- [ ] **Step 3:** Assert internal consistency wherever a fixture declares a number it also implies, and fail on disagreement rather than letting a judge pick.
- [ ] **Step 4:** Assert grader completeness: a grader whose configuration is absent or missing a required key parses cleanly and enforces nothing.
- [ ] **Step 5:** Add a forbidden-event array to the case shape alongside the expected-event array, so a skipped gate or a wrong tool call is checkable rather than narrated.
- [ ] **Step 6:** Add a self-test sibling with an assertion-count floor, per the gate-integrity roadmap's second-order guard.
- [ ] **Step 7:** Land advisory, classify every hit on the real corpus, then promote to error.
- [ ] **Step 8:** Drain the `check_trigger_eval_presence` ratchet, which is red
      today and is red on `origin/main` — **18 violations, in two classes that
      need different work**, so they are counted separately rather than as one
      number.

      **Found 2026-08-25** by the `road-to-channel-contract-and-profile-drift`
      run, which touched `src/skills/brand-asset-generation/SKILL.md` and had
      the gate fire. Recorded here rather than fixed there: the diff adds **zero**
      new violations (the failure set is byte-identical on a clean `main`
      checkout), and an 18-row ratchet cleanup does not belong in a
      channel-contract change.

      | class | count | the work |
      |---|---:|---|
      | in the grandfather allowlist **and** now shipping `evals/triggers.json` | 14 | delete the allowlist entry — the ratchet is shrink-only, so removal is the direction it wants; mechanical |
      | missing `evals/triggers.json` and **not** grandfathered | 4 | author a real trigger-eval set each: `judge-spec-compliance`, `overbuild-review-lens`, `playbook-authoring`, `ui-apply-generic` |

      The two classes are not one task. The 14 are bookkeeping the gate can
      verify immediately. The 4 need should-trigger / should-not-trigger
      fixtures written to `artifact-drafting-protocol` Phase C, and a
      should-not-trigger list that is only near-misses of the four skills' own
      surfaces — a set of unrelated prompts would pass while measuring nothing.

      **The gate is Taskfile-only.** `Taskfile.yml:155` runs it under `task ci`;
      no `.github/workflows/` file references it, so this red does not block a
      PR today and has been able to accumulate unobserved. Whether it should be
      wired into CI is part of this step, not assumed by it — wiring an 18-row
      red into CI before draining it would red every PR in the repository.
      verify: `./scripts-run src/scripts/check_trigger_eval_presence` exits 0,
      the allowlist has 14 fewer entries, and each of the four named skills has
      an `evals/triggers.json` that `check_trigger_evals` accepts as fresh and
      valid.

## Phase 2: Score direction, not magnitude

- [ ] **Step 1:** Audit every scored gate and eval path in this package for a magnitude-weighted interval and record the list.
- [ ] **Step 2:** Replace the verdict computation with an exact one-sided test over discordant trials only.
- [ ] **Step 3:** Retain the magnitude-weighted mean in the report for triage and state in the report that it decides nothing.
- [ ] **Step 4:** Derive the minimum trial count from the applied test rather than choosing it, and record the derivation beside the constant.
- [ ] **Step 5:** Add a warning when a specification sits exactly on the derived floor, because one tie then makes a pass arithmetically unreachable.
- [ ] **Step 6:** Add an underpowered verdict distinct from both pass and regression, and exclude it from any pass-rate denominator.

## Phase 3: Judge hygiene

- [ ] **Step 1:** Blind every version-comparison judge dispatch: the judge sees both outputs without knowing which arm produced which.
- [ ] **Step 2:** Repeat each comparison with the order swapped, and default a flipped result to a tie flagged inconsistent rather than to a winner.
- [ ] **Step 3:** Add an advisory overfitting classification of each rubric item and assertion as outcome-shaped, technique-shaped, or vocabulary-shaped, running in parallel with execution and gating nothing.
- [ ] **Step 4:** Add non-discriminating assertion detection: an assertion that passes in both arms inflates the treatment pass rate without reflecting value.
- [ ] **Step 5:** Make the pruning rule explicit in the analysis step — remove or replace an assertion that always passes in both arms, investigate one that always fails in both, and study the ones that pass in treatment and fail in control, because that is where the value is.
- [ ] **Step 6:** Require concrete evidence for a pass verdict. A section carrying the expected label and one vague sentence is a fail; the label being present is not the substance being present.

## Phase 4: Comparison arms that can discriminate

- [ ] **Step 1:** Add a frozen-snapshot convention: the comparison arm is a committed predecessor snapshot that must not drift with live edits, with a documented re-baselining ritual that commits separately and records what shifted.
- [ ] **Step 2:** Require at least one fixture item recoverable **only** via the behaviour the artifact under test prescribes. Without one, the control arm can score the same and the eval cannot adjudicate.
- [ ] **Step 3:** Count a missed planted item as an implicit zero in the rubric, so under-reporting cannot buy a higher ratio.
- [ ] **Step 4:** Add a transcript leak scan: deny read access to the ground truth, the generator, the scorers, and prior trials, then walk the run transcript afterwards for any tool input matching a denied path and surface a per-trial leak count.
- [ ] **Step 5:** Key any cached baseline on a composite identity hash that includes the evaluation criteria — the rubric, the assertions, the tool expectations, and the turn and token limits — not only the prompt and the fixtures. The criteria half is the one most likely to be omitted.

## Phase 5: Honest publication

- [ ] **Step 1:** Add attempt-one-only accounting to the benchmark report. A later correction may be retained for diagnosis and never replaces the first attempt.
- [ ] **Step 2:** Add a completeness precondition: a result may be published only when every configuration has exactly one first-attempt receipt for every case.
- [ ] **Step 3:** Add an allow-listed failure-reason set so an aborted run becomes a truthful receipt with its gates marked not-run, rather than a dropped run or a fabricated artifact.
- [ ] **Step 4:** Evaluate against the installed projection rather than the source tree. This package's own recorded trap is that a release-gated path is an untested path.
- [ ] **Step 5:** Add a required non-inference section to every measurement artifact, enumerating the inferences its data does not license, and a matching field on the claims ledger rows.
- [ ] **Step 6:** Add a scored register of known unaddressed weaknesses — validity and current-status scores per entry with links to whatever addressed it. This is the inverse of the claims ledger and prevents relitigating a known-open gap as if it were new.
- [ ] **Step 7:** Exclude artifacts that cannot self-activate from any coverage denominator and report them as dependency-level coverage. An arm that loads only a non-activatable artifact runs treatment equals control by construction, and its score is judge noise.
- [ ] **Step 8:** Add a declared indeterminate branch to every pre-registered threshold, plus an interpretation limit on a null. Given this package's honest-null history, naming the indeterminate outcome before the run is the highest-leverage addition here.

## Acceptance Criteria

- [ ] `src/scripts/lint_eval_specs.ts` rejects a duplicate key, an untracked fixture, an internally inconsistent fixture, and an incomplete grader, each proven by a fixture.
- [ ] No scored gate in this package decides a verdict from a magnitude-weighted interval, proven by the recorded audit list reaching zero.
- [ ] The trial floor is derived from the applied test and the derivation is recorded beside the constant.
- [ ] An underpowered verdict exists and appears in no pass-rate denominator.
- [ ] Every version-comparison judge dispatch is blinded and order-swapped, with a flip defaulting to a flagged tie.
- [ ] An assertion passing in both arms is reported as non-discriminating.
- [ ] A benchmark result is publishable only when the completeness precondition holds.
- [ ] Every measurement artifact carries a non-inference section.
- [ ] Quality gates delegated to remote CI on the pull request.

## Blockers

### blocker: verification-slot
- **Status:** resolved
- **Owner:** maintainer
- **Blocks:** Phase 1 — A gate on the measurement inputs
- **What to do:**
  1. This roadmap holds queue position 4 of the verification track under the 2026-08-05 successor constraint (maximum two concurrently open).
  2. When a predecessor archives, move this file to `agents/roadmaps/` and drop `status: later`.
- **Resolved when:** fewer than two `road-to-skill-ecosystem-*` roadmaps sit outside `archive/` and `later/`, checked by `./agent-config roadmap:progress`.
- **Resolved 2026-08-25:** `lint_roadmap_family_cap` reports `0/2 slot(s) used`; both predecessors (`road-to-skill-ecosystem-gate-integrity`, `road-to-skill-ecosystem-authoring-discipline`) are in `agents/roadmaps/archive/`. This file moved to `agents/roadmaps/` and dropped `status: later`, exactly as step 2 above directs.

## Risk Register

<!-- risk-review: v1 | reviewed: 2026-08-05 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | Switching the verdict computation invalidates recorded results | implementation | Replacing a magnitude-weighted interval with an exact test changes historical verdicts, and some of this package's locked conclusions rest on them. | Phase 2 Step 1 records the audit list before changing anything, so every affected prior result is named; a verdict that flips is a finding to record, not a result to quietly restate. | Phase 2: Score direction, not magnitude |
| 2 | The eval-spec gate lands as an unfixable blocker | implementation | A structural gate over an existing fixture corpus will produce hits, and this package has recorded a gate that could only block. | Phase 1 Step 7 lands advisory and classifies every hit before promotion. | Phase 1: A gate on the measurement inputs |
| 3 | The frozen-snapshot convention rots | product | A committed comparison arm that is never re-baselined silently measures against an increasingly irrelevant predecessor. | The convention ships with a documented re-baselining ritual that commits separately and records what shifted, so drift is visible in history. | Phase 4: Comparison arms that can discriminate |
| 4 | The weaknesses register becomes a backlog nobody reads | product | A scored list of known gaps can accumulate without ever driving work, which is the failure the register is supposed to prevent for others. | Entries carry a current-status score with a link to whatever addressed them, so a stale entry is visibly stale rather than merely long-lived. | Phase 5: Honest publication |

## Provenance

- Source: one first-party vendor eval platform for the specification gate, the
  exact-test verdict, and the derived trial floor; one optimization research
  package for the frozen snapshot, the planted-discriminating fixture, and the
  leak scan; one diagram renderer for the attempt-one accounting and the
  non-inference section. Anonymized per `source-confidentiality`; per-source links
  in the sweep record's § Provenance.
- Council: see the sweep record § Council.
