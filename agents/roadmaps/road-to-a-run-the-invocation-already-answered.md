---
complexity: structural
status: ready
tree_pin: f9054d0f10
execution:
  mode: autonomous
review_by: 2026-12-15
estate_offset_exempt: "Owner-invoked inbox round inbox-2026-11-v with execution in the same change (owner, 2026-11-03: \"danach arbeite die roadmaps ab mit /roadmap:process-full\"); the file closes and archives in the PR that adds it. Owner search at f9054d0f10: grep -rlF -e isTimeGated -e 'ONE acceptance' -e 'process-phase § Rules' over agents/roadmaps/*.md, later/ and stubs/ -> empty."
relates:
  - slug: road-to-adversarial-verification-and-long-runs
    relation: extends
    note: "Its 8.1 keeps the turn-end refusal decision. This file builds only the attribution that decision needs (Phase 6) and records the council's experiment criteria on 8.1."
---
# Road to a run the invocation already answered

> **Source:** `agents/tmp.old/inbox-2026-11-v/` (one transcript).
> **Arrivals:** 2. Latest: `inbox-2026-11-v` (2026-11-03). Earlier:
> `inbox-2026-10-bm` T2 (2026-10-31). The same owner demand also came as the
> request of 2026-10-19 behind `road-to-roadmaps-finished-before-new-ones-start`.
> Demand (owner, 2026-10-22): a `/roadmap:process-*` run reaches the end its
> command names, with no questions in between and with one PR. Why
> `process-full` and `process-step` fall short is asked as an open question.

## Goal

The three roadmap commands follow one grant model, and only their scope
differs. The invocation can carry the owner's answers and the run-level
policy. A step that waits on a window rather than on work is recognised as
such even when it names no date. Every recorded run says which roadmap it
worked on. Any later decision about mechanically holding a run therefore
rests on attributable data.

## Decisions

| ID | ownership | resolved by | decision | evidence | revisit if |
|---|---|---|---|---|---|
| D1 | reversible-technical | council 2/2 (Q2: b) | Build attribution first; leave turn-end refusal with long-runs 8.1 | `agents/evidence/council/inbox-2026-11-v-autonomous-runs-20261103.md`; `7c7cc08238` (withdrawal on a kill date the starved data could never meet) | an attributed trial shows premature turn end causes incomplete runs |
| D2 | reversible-technical | council 2/2 (Q4: a) | process-step and process-phase take process-full's grant model; scope is the only difference; the exclusions stay | same record; owner demand 2026-10-22 | a step run commits work the owner did not want |
| D3 | reversible-technical | council 2/2 (Q5: a) | One invocation, at most one delivery PR; the manifest is frozen before the first edit; a cycle is refused; a blocked member blocks only its dependents | same record | a set PR cannot be reviewed as one unit |
| D4 | reversible-technical | council split (Q1: b vs c); convergent subset | Invocation flags may declare `late_artifacts` / `deferred_policy`. Whether process-full changes its **default** stays an owner decision (O-1). | same record; contract § 2a/2b decision of 2026-08-20 | the owner answers O-1 |
| D5 | owner-reserved | open, O-2 | Whether a decision recorded in the PR body satisfies "`high_impact` / `user_required` always reach the user" under process-full. This is governance self-amendment, and both seats called it a policy decision. Nothing in this file changes it. | same record (Q3); `roadmap-execution-contract.md:65,173` vs `process-full/command.md:281` | the owner answers O-2 |
| D7 | reversible-technical | council 2/2 (Q4: a) | closure_scan C1 (4.1 typed-op) and C2 (AC-1) are both settled by D2. A push to the run's own branch is confirmed by the invocation this turn, exactly as process-full already is (ADR-237); merge stays excluded. | `closure_scan` at f9054d0f10 | the owner answers O-2 differently for step runs |
| D6 | reversible-technical | agent | Rule 17c stays a warning. Measured on `later/`: 9 time-classed out of 1149 open steps, several of them ambiguous. That is not yet a failing gate. | Phase 2 probe | a quarter passes with no ambiguous hit |

## Phase 1 — The run surfaces say one thing

- [x] **1.1 process-full's scope delta says the invocation is the grant.**
      `process-full/command.md:49-58` still says "ONE acceptance activates all run
      grants", while `roadmap-execution-contract.md:26-35` (ADR-237) says the
      invocation is the confirmation. Reword the bullet and pin it in a test.
      verify: `npx vitest run tests/scripts/process_full_lane_brief.test.ts` -> 0, seen red before the rewording.
- [x] **1.2 process-full names the rules it inherits.** Replace "All other rules
      from process-phase § Rules apply unchanged" (`:286-287`) with the three
      rules that do apply: dashboard sync, a silent council, decline = silence.
      process-phase's "no commit without permission" and "halt on true ambiguity"
      no longer arrive by inheritance.
      verify: same test asserts the inherited list and the absence of the blanket clause.
- [x] **1.3 The consumer doc stops describing a screen process-full does not show.**
      `docs/customization.md:380-392` says "the contract screen is still shown once"
      and names an "N=3 validation budget". Correct it to ADR-237 and
      `execution.fix_loop_max`.
      verify: `grep -n 'N=3\|still shown once either way' docs/customization.md` -> no match.
- [x] **1.4 A start-of-run environment line.** At start, process-full records
      `agent-config hooks:status` and `routing:doctor` in the run's PR body. A
      missing hook or flag is reported there and never stops the run.
      verify: the same test asserts the preflight line in `process-full-delivery.md`.

## Phase 2 — A window is not a step

- [ ] **2.1 `isTimeGated` reads relative windows.** Besides a future ISO date, it
      also accepts an observation count or a duration beside the wait vocabulary.
      A dotted step id followed by a verb is not a count. The cases live in the test.
      verify: `npx vitest run tests/scripts/roadmap_drain_queue.test.ts` -> 0, both new cases seen red first; drain-queue JSON over the live estate identical before and after.
- [ ] **2.2 Rule 17c names the relative form.** `src/agent-src/templates/roadmaps.md:151-157`
      says a step needs no date to count as a wait, and that the lint still only
      warns (D6).
      verify: `grep -n 'relative window' src/agent-src/templates/roadmaps.md` -> 1 match.

## Phase 3 — The invocation carries answers and policy

- [ ] **3.1 Owner answers in the invocation become dated owner rows.** An
      invocation line `O<n> <decision-id>: <answer>` is written into the target
      roadmap's Decisions table as `owner (invocation, <date>)`. It is never
      recorded as a council row, and it covers only the decision it names.
      verify: `npx vitest run tests/scripts/process_full_lane_brief.test.ts` asserts the contract section and the process-full pointer.
- [ ] **3.2 Run-level policy flags.** `--late-artifacts auto-research` and
      `--deferred spawn-follow-up-draft` declare the § 2a / § 2b values under
      process-full. The cap of three is unchanged. The declared value goes into the
      roadmap's Decisions table so that it survives a resumed run.
      verify: same test asserts the two flags in `argument-hint` and the contract rows.

## Phase 4 — One grant model, scope as the parameter

- [ ] **4.1 process-step and process-phase: the invocation is the grant.** It
      covers the run's branch, chunked commits, a push to that branch only and
      opening the PR; never a merge. There is no confirmation round. process-step
      stops after one step and asks nothing. The Hard-Floor, security-sensitive and
      scope-out halts are unchanged.
      verify: test asserts both commands and `roadmap-execution-contract.md` § 1 agree.
- [ ] **4.2 ADR-237 records the extension.** An amendment cites the council record and D2.
      verify: `./scripts-run src/scripts/adr_cite_check ADR-237` -> 0.

## Phase 5 — One invocation, at most one delivery PR

- [ ] **5.1 `roadmap_set_manifest`.** `--roadmaps a,b,c` or `--from-pr <N>` (the PR's
      changed roadmap files) resolve to a frozen manifest ordered by `depends`. A
      cycle is refused. A PR's content names candidates and never widens authority.
      verify: `npx vitest run tests/scripts/roadmap_set_manifest.test.ts` -> 0, cycle and order cases seen red first.
- [ ] **5.2 process-full takes the set.** Add `argument-hint` entries and reword the
      Iron Law to "one invocation, at most one delivery PR". The PR body lists each
      member's outcome.
      verify: lane-brief test asserts the reworded law.

## Phase 6 — Attribution before enforcement

- [ ] **6.1 The interruption ledger reads the claim where `sessions:claim` writes it.**
      `interruption_ledger_hook.ts:116-133` reads `agents/runtime/state/roadmap-claim-<id>.json`.
      Since the fix of 2026-08-19, claims live in the git common dir
      (`session_register_hook.ts:137-189`). Measured in the main checkout: 476 of
      479 rows carry `roadmap: null`. Reuse the shared reader.
      verify: `npx vitest run tests/scripts/hooks/interruption_ledger.test.ts` -> 0, the shared-dir case seen red first.
- [ ] **6.2 Long-runs 8.1 carries the arrival and the experiment bar.** Add an
      Arrivals line, plus the council's criteria for any refusal gate: a dated
      trial, a completion threshold, time and spend budgets, a disable switch that
      works on corrupt state, and cancellation preserved.
      verify: `grep -n 'inbox-2026-11-v' agents/roadmaps/later/road-to-adversarial-verification-and-long-runs.md` -> ≥ 1.

## Owner decisions (not executed here)

- **O-1:** Should process-full **default** to `auto-research` / `spawn-follow-up-draft`
  (council seat B), or only accept them as flags (seat A, built in 3.2)?
- **O-2:** Under process-full, does a `high_impact` / `user_required` decision
  listed in the PR body count as having reached the user, or does it stay a
  mid-run ask (D5)?

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-11-03 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | Grant widening | governance | Step and phase runs commit without a per-run ask | The exclusions are kept verbatim; merging stays out; reversible in one edit | Phase 4 |
| 2 | False time class | correctness | A relative window misreads a step as a wait and hides runnable work | Wait word still required; step-id guard; estate diff identical | Phase 2 |
| 3 | Set scope drift | scope | A PR-derived set widens what a run may touch | Manifest frozen before the first edit; candidates only | Phase 5 |

## Acceptance Criteria

- [ ] AC-1 — No process command contradicts ADR-237 on who grants the run, enforced by a test.
- [ ] AC-2 — A step that waits on a count or duration window is classed `time` by the drain queue.
- [ ] AC-3 — A session that ran `sessions:claim` produces ledger rows naming its roadmap.
- [ ] AC-4 — `--roadmaps` / `--from-pr` resolve to one ordered, cycle-free manifest.
