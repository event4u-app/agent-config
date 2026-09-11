---
complexity: structural
status: ready
execution:
  mode: phase-checkpoints
owner: maintainer
relates:
  - slug: road-to-wired-instruments
    relation: extends
    note: >
      Archived. It closed four instances of this class by hand and left four
      grep-shaped acceptance criteria behind instead of a detector, so the two
      instances found this round were never findable.
estate_growth_exempt: >-
  Receiver for a defect class this tree has closed once by hand and cannot detect. Verified
  2026-09-11: `grep -rn rejectedTacticRepeat src/` returns exactly one line — its own declaration
  at `src/scripts/_lib/loop_guards.ts:274` — with consumers only under `tests/`; and
  `compareTriggers` / `earlierArm` in `src/scripts/_lib/capsule_trigger.ts` have zero production
  importers while `src/scripts/orchestration_record.ts:177-179` already accepts three CLI flags
  for values nothing computes. Both are the shape `archive/road-to-wired-instruments.md` named
  and neither was caught. Also grows open_blockers by two.
estate_offset_exempt: >-
  The nearest offset candidate is `agents/roadmaps/later/road-to-run-continuation-observation.md`,
  parked 23 days with a resume trigger that has never fired — retiring it would dispose of the
  observation this roadmap's own blocker is waiting on. No active roadmap touches loop-instrument
  reachability: the active set is host delivery, grant persistence, decision closure,
  adversarial verification and settings-writer debt.
---
# Road to reachable loop instruments

> **Source:** `agents/tmp.old/inbox-2026-09-y/t2-loop-convergence/` — four plan revisions plus
> the originating transcript, analysed 2026-09-11. Claim verification at HEAD: 28 of 32 claims
> still true, 1 overtaken, 3 never true at drafting. Two of the three never-true claims would
> have produced real work against a tree that already had the thing: one phase was planned
> against five existing prefix-stability tests, another against a shadow comparison that does
> not run. Three steps below are tagged `corrected-from-reproduction`.

## Goal

No convergence instrument in this repository counts as built while nothing calls it. The class
that `archive/road-to-wired-instruments.md` closed instance by instance gets the detector that
finds the next instance, and the two instances open today are either wired, declared
deliberately inactive with an expiry, or removed.

The distinction matters because the previous round's answer was correct and unreachable. That
roadmap's goal reads *"Four instruments that this repository built, tested and then connected to
nothing"*; it wired four of them and shipped five hand-written `grep` acceptance criteria rather
than a gate. `rejectedTacticRepeat` was not among the four, `compareTriggers` was not either, and
nothing since has been able to notice.

## Phase 0 — Inventory, with no behaviour change

- [ ] **0.1 Write a new loop-surface inventory** — a `loop-surfaces.yaml` under `src/config/`,
      which does not exist yet — listing the five verified loop surfaces —
      `run_continuation_hook`, `_self_fix`, `verify-repair-loop`, `experiment-loop`,
      `roadmap-process-loop` — each with `cap`, `no_progress`, `success_stop`, `checker`,
      `human_gate`, `terminal_vocabulary` and `production_consumers[]`. `cap` and `no_progress`
      point at `file:symbol`, never at prose.
      verify: every one of the five carries every field, and each `cap` / `no_progress` value
      resolves to a symbol that exists — `grep -n "<symbol>" <file>` returns a definition line.
- [ ] **0.2 Mark which entries are instruments.** An entry is an `instrument` when it is an
      exported helper meant to be called by a surface rather than a surface itself.
      verify: the file distinguishes the two, and the instrument list contains at least
      `rejectedTacticRepeat` and `compareTriggers`, the two open instances.

## Phase 1 — One new axis in the reachability family, not a new gate

- [ ] **1.1 Extend `src/scripts/check_gate_reachability.ts` with a `_lib-export-reach` axis.**
      Every export named as an `instrument` in `loop-surfaces.yaml` needs at least one non-test
      importer.
      verify: the axis reads `loop-surfaces.yaml` and scopes itself to the instrument list — it
      does not walk every `_lib` export, because that is the noise the next step measures.
- [ ] **1.2 Count a declaration's own file as a caller.** `corrected-from-reproduction` — a naive
      axis over `src/scripts/_lib/loop_guards.ts` reports nine hits of which four are false
      positives: `matchesWholeLine`, `detectUnavailableDependency`, `DEPENDENCY_SCAN_BYTES` and
      `StallSignal` all have file-internal callers and are reachable. The criterion is: an export
      is dead when it appears in `src/` exactly once **including its own file**.
      verify: the axis reports the `rejectedTacticRepeat` cluster as dead and reports the four
      file-internal exports as live, on the same run.
- [ ] **1.3 An exception carries an expiry.** `status: experimental` in the inventory exempts an
      instrument; a missing or past `expires:` reds the gate.
      verify: `--selftest` plants a surface with no `cap`, an instrument with no consumer, and an
      expired exception, and the gate reds on all three.
- [ ] **1.4 Prove the axis is sensitive.** Neutralise it, watch AC-2 and AC-3 go green, restore it.
      verify: the commit records the red and green readings per case. A test never seen red has
      unknown sensitivity.

## Phase 2 — Dispose of the two open instances

- [ ] **2.1 `rejectedTacticRepeat` gets a consumer, an expiry-bearing exception, or a deletion
      proposal.** It sits at `src/scripts/_lib/loop_guards.ts:274` with test-only callers.
      verify: `grep -c rejectedTacticRepeat src/scripts` is greater than 1, or the inventory
      entry carries `status: experimental` with a future `expires:`.
- [ ] **2.2 `compareTriggers` / `earlierArm` likewise.** `corrected-from-reproduction` — the
      source's own step said to *evaluate* this shadow comparison, and the newest plan revision
      cites it as evidence that a measurement is already running. It is not running: there is no
      production importer, and the only mention in `src/` is a prose comment in
      `src/scripts/hooks/subagent_ledger_hook.ts`. Wire it before evaluating it, or declare it.
      verify: the three flags `--watermark-step`, `--saturation-step` and `--trigger-arm-earlier`
      in `src/scripts/orchestration_record.ts:177-179` either have a caller that computes their
      values, or are removed.
- [ ] **2.3 Correct the step status that claims otherwise.**
      `agents/roadmaps/later/road-to-worker-generation-recycling.md` marks its trigger-comparison
      step `[x]` while the comparison has no consumer.
      verify: that step reads its true state and carries a dated correction line naming what was
      found on 2026-09-11.

## Phase 3 — Give the terminal vocabulary its consumers

- [ ] **3.1 `_self_fix` writes a `run_terminal` value beside `PARTIAL`.** The vocabulary already
      exists at `src/scripts/_lib/outcome_vocabularies.ts:104-127` and carries the states this
      needs.
      verify: `grep -n "RunTerminalState\|run_terminal"` finds a write in
      `src/agent-src/templates/scripts/work_engine/directives/backend/_self_fix.ts`.
- [ ] **3.2 `verify-repair-loop` and `experiment-loop` write a terminal state at loop end.**
      verify: both skills name the field and its value set; `grep -n RunTerminalState` finds them.
- [ ] **3.3 Do not touch `RUN_TERMINAL_STATES` itself.** The value set is complete for this work.
      verify: `git diff src/scripts/_lib/outcome_vocabularies.ts` is empty across the whole
      roadmap.

## Blockers

### blocker: loop-surface-inventory-owner
- **Status:** open
- **Owner:** maintainer
- **Class:** 3 — human-only
- **Blocks:** Phase 0, and everything after it. Phase 1's axis reads the file Phase 0 writes.
- **What to do:** decide whether the inventory is its own new `loop-surfaces.yaml` under
  `src/config/` or a
  section inside `src/scripts/hook_manifest.yaml`. The evidence for a separate file: two of the
  five surfaces are skills, not hooks, so the manifest has no row shape for them. The evidence
  against: a new config file pulls a schema, a gate-coverage row and a projection entry behind it.
  Run `./scripts-run src/scripts/check_gate_reachability --json` to see what the family already
  reads before adding a second source to it.
- **Recommendation:** a separate file. The manifest is keyed on hook slots and two of the five
  surfaces have none, so folding them in would mean inventing a row shape for a thing the manifest
  does not model.
- **If you do nothing:** Phase 0 cannot be written, and Phase 1's axis has nothing to scope
  itself to — which is exactly the over-broad axis Phase 1.2 exists to prevent.
- **Resolved when:** the inventory exists at exactly one path and
  `./scripts-run src/scripts/check_gate_reachability` reads it.

### blocker: dead-instrument-disposition
- **Status:** open
- **Owner:** maintainer
- **Class:** 3 — human-only
- **Blocks:** Phase 2.1 only. Phases 0, 1 and 3 proceed without it.
- **What to do:** decide whether `rejectedTacticRepeat` is wired, declared experimental with an
  expiry, or removed. Read `sed -n '232,299p' src/scripts/_lib/loop_guards.ts` against
  `src/scripts/_lib/continuation_ladder.ts:111`. The two newest source revisions contradict each
  other here — one says wire it before observing, the other says choose the carrier first — so
  the source does not settle it.
- **Recommendation:** declare it experimental with an expiry. Wiring it makes the continuation
  hook more blocking before that hook has demonstrably engaged even once, which reverses the
  order the evidence supports.
- **If you do nothing:** the instrument stays in the tree looking built, and the detector this
  roadmap ships will red on it forever without anyone deciding anything.
- **Resolved when:** AC-4 is satisfied on any one of the three paths.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-09-11 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | The reach axis produces noise | implementation | An axis over every `_lib` export reports four false positives in one file alone, and a gate whose signal is a minority of its output drives broad allowlisting | Phase 1.1 scopes the axis to the declared instrument list; Phase 1.2 counts file-internal callers, measured against the nine hits that produced the correction | Phase 1 — One new axis in the reachability family, not a new gate |
| 2 | Wiring makes a hook more blocking before it is proven | implementation | The continuation hook has engaged once in its lifetime; adding a repeat-suppression consumer raises its refusal surface on no evidence | A new consumer lands as an event that does not block; the existing false-positive bar governs any blocking rung | Phase 2 — Dispose of the two open instances |
| 3 | The inventory file becomes a loop engine | product | A config file listing loop surfaces invites a schema, then a runner, then the engine the recorded decision forbids | Stated non-goal in Phase 0.1: the file is reader input only. It adds no behaviour to any surface and nothing executes from it | Phase 0 — Inventory, with no behaviour change |
| 4 | An experimental exception becomes permanent | implementation | A declared-inactive instrument with no deadline is the same dead code with a label | `expires:` is a required field of the exception and the gate reds on a past date | Phase 1 — One new axis in the reachability family, not a new gate |
| 5 | The detector finds instances nobody disposes of | product | A gate that reds on a backlog gets suppressed rather than answered | Phase 2 disposes of both instances known today before the gate becomes blocking, so it ships against an empty backlog | Phase 2 — Dispose of the two open instances |

## Acceptance Criteria

- [ ] AC-1 — A reachability axis exists that reds when a declared loop instrument has no
      production consumer, and it lives inside the existing gate family rather than as a new gate.
- [ ] AC-2 — The axis was observed red with the `rejectedTacticRepeat` cluster unconsumed and
      green after its disposition, and the red reading is recorded.
- [ ] AC-3 — The axis reports the four file-internal exports in `loop_guards.ts` as live, proving
      it does not over-fire.
- [ ] AC-4 — `rejectedTacticRepeat` is wired, declared experimental with a future expiry, or gone.
- [ ] AC-5 — Either something computes the three `orchestration_record` trigger-comparison flags,
      or those flags no longer exist.
- [ ] AC-6 — `road-to-worker-generation-recycling`'s trigger-comparison step reads its true state
      and carries a dated correction.
- [ ] AC-7 — All three loop consumers write a run-terminal value, and
      `src/scripts/_lib/outcome_vocabularies.ts` is unchanged by this roadmap.
