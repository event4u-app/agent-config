---
complexity: lightweight
status: ready
execution:
  mode: phase-checkpoints
relates:
  - stubs/road-to-runtime-orchestration-substrate
  - later/road-to-experience-loop-owner-decisions
  - archive/road-to-delivered-cost-truth
estate_growth_exempt: This diff adds six roadmaps and the seven blockers they carry, taking active_roadmaps 1 to 7 and open_blockers 29 to 36. The growth is the point of the change: the 2026-09-a inbox round produced six survivors that each needed a decision recorded as a blocker rather than an assumption made silently. Claimed once, for this change only.
estate_offset_exempt: Added by the 2026-09-a inbox round on the maintainer's instruction to carry its survivors into ready roadmaps. No archive move was available as a named one-in-one-out counterpart, so this is a self-issued claim and not an offset -- the distinction the owner-reserved question in agents/roadmaps/stubs/road-to-owner-authority-decisions.md records as undecided. Stated rather than smoothed over.
---
# Road to wired instruments

> **Source:** `agents/tmp.old/inbox-2026-09-a/s09/` and `.../s11/`, two
> independently drafted reviews that converged on a finding neither of them
> names. Every claim below was re-verified against `c6b4f6407` by the run that
> wrote this file, not carried over from the drafts.

## Goal

Four instruments that this repository built, tested and then connected to
nothing are reachable from the surface that was supposed to consume them, and
the one completed roadmap that records a wiring which never happened carries a
correction. When this is finished, no instrument in the set below can be
described as landed while nothing calls it.

## Context

The two source units disagree about almost everything else and agree on this:
the dominant defect class here is no longer a missing mechanism, it is a built
mechanism wired to nothing. That is a different failure from an unbuilt one,
and it is more expensive — the design cost is already paid, the test suite is
green, and a completed roadmap may record it as delivered.

The four instances, each verified by this run:

| Instrument | Built | Consumed by | Verified how |
|---|---|---|---|
| `src/scripts/hook_effect_doctor.ts` + `_lib/hook_effect_probe.ts` | yes, with a five-state verdict vocabulary | **nothing** | `grep -rn 'hook_effect_doctor\|hook_effect_probe' src Taskfile.yml .github` returns only the two files themselves |
| `_lib/experiment_freeze.ts` | yes, `ExperimentSpec` + `ExperimentDriftError` | **its own test only** | the single hit outside the module is `tests/contracts/experiment_freeze.test.ts:16` |
| `context_fingerprint` (written by `run_checkpoint.ts`) | yes | **not** the continuation ladder | `grep -c context_fingerprint src/scripts/hooks/run_continuation_hook.ts` → `0` |
| `check_artefact_count_messaging.ts` | yes, and its regex matches the defect | `src/rules/**` is absent from `SURFACES` | the list at `:44-67` names 16 doc paths and no rule path |

The fourth one has a shipped consequence: `src/rules/missing-skill-recovery.md`
tells the reader this package projects **297** skills and
`src/rules/token-budget-discipline.md` says **~290**, while
`ls -d src/skills/*/` counts **299**. The gate that exists to stop a hand-typed
count going stale would catch both — its `KIND_PATTERNS` regex matches each
phrasing — and it never looks at the directory where they live.

Worse, for the first instrument: `agents/roadmaps/archive/road-to-delivered-cost-truth.md:258`
records the probe as *"Landed at `src/scripts/_lib/hook_effect_probe.ts:38` and
`src/scripts/hooks_doctor.ts:88`"*. The first half is true. The second names a
file that contains **zero** references to the probe, at a line which is the
closing brace of a filesystem helper. A closed roadmap asserts a wiring that
does not exist.

## Phase 1 — Make the hook-liveness instrument reachable

- [ ] **1.1 Give `hook_effect_doctor` a CLI entry.** Register it in
      `src/cli/registry.ts` beside the existing `hooks:doctor` row (`:89`), which
      answers a different question — manifest scope, not whether a bound concern
      actually fires on this host.
      verify: `./agent-config <the new verb> --help` exits 0 and prints the
      probe's own verdict vocabulary; `grep -c '<the new verb>' src/cli/registry.ts` ≥ 1.
- [ ] **1.2 Correct the archived landing record.** Append a dated correction to
      `agents/roadmaps/archive/road-to-delivered-cost-truth.md` stating that the
      `hooks_doctor.ts:88` half of its landing claim is false, and where the
      wiring actually landed once 1.1 is done. Do not rewrite the original line —
      the record of the wrong claim is the evidence.
      verify: `grep -c 'hook_effect' src/scripts/hooks_doctor.ts` is still `0`
      **and** the archived file carries a correction paragraph naming that fact.
- [ ] **1.3 Decide whether the verb runs anywhere automatically.** It is a
      diagnostic, and a diagnostic nothing invokes is the defect this roadmap is
      about. Pick a caller or state in one line why on-demand is the right shape.
      verify: either a Taskfile target or a workflow step invokes it, or the
      roadmap carries the one-line reason and the step is `[~]`.

## Phase 2 — Connect the drift detector to the decision it should change

- [ ] **2.1 Read `context_fingerprint` in the continuation ladder.** The
      fingerprint is built by `roadmap_context.ts` from `origin/main` plus open
      PR heads and stored by `run_checkpoint.ts`; `verifyCheckpoint` already
      returns per-field agreement. The ladder in
      `src/scripts/hooks/run_continuation_hook.ts:487` never consults it.
      verify: `grep -c context_fingerprint src/scripts/hooks/run_continuation_hook.ts` > 0,
      and a unit test drives `ladder()` with a disagreeing fingerprint.
- [ ] **2.2 Place the rung before the iteration cap.** A run whose plan premise
      moved should terminate under its own word, not as `exhausted` — the two
      are different findings and the current vocabulary cannot tell them apart.
      verify: the test from 2.1 asserts the new terminal state, not `exhausted`.
- [ ] **2.3 Add the terminal state to the closed vocabulary.**
      `RUN_TERMINAL_STATES` in `src/scripts/_lib/outcome_vocabularies.ts` holds
      six values and is re-exported as `TerminalState` through
      `outcome_envelope.ts`, which `runtime_journal.test.ts` pins with an
      anti-fork assertion. Extend the one declaration; never add a second.
      verify: `task test` green, including `runtime_journal.test.ts`.

## Phase 3 — Give the freeze primitive its first consumer

- [ ] **3.1 Bind `ExperimentSpec` where the corpus is already pinned.**
      `evolution_lab.ts` fails closed on holdout leak and `corpus_manifest.ts`
      pins the corpus, but the two mechanisms are independent; `ExperimentSpec`
      exists to join evaluator, corpus, task, baseline and fixtures into one
      hash. Wire it as the binding, not as a second pinning scheme.
      verify: `grep -rn experiment_freeze src` names at least one non-test
      importer, and a drift fixture makes `ExperimentDriftError` throw in a test
      that fails when the binding is removed.
- [ ] **3.2 Prove the sensitivity, not just the pass.** Neutralise the binding,
      watch the test go red, restore it. A test never seen red has unknown
      sensitivity.
      verify: the roadmap records the observed red output verbatim.

## Phase 4 — Close the count-messaging scope gap

- [ ] **4.1 Add `src/rules/**` to `SURFACES` in
      `src/scripts/check_artefact_count_messaging.ts`.** The list at `:44-67`
      carries a written rationale per entry; add one for this class too — rules
      are the most-delivered surface this package has, and a wrong self-count
      there reaches every consumer session.
      verify: running the gate before the fix reports the two known hits; after
      4.2 it reports zero.
- [ ] **4.2 Fix the two stale counts.** `src/rules/missing-skill-recovery.md`
      (297) and `src/rules/token-budget-discipline.md` (~290) against the actual
      299. Both edits are line-scoped; a whole-file sweep is a drive-by change.
      verify: `./scripts-run src/scripts/check_artefact_count_messaging` exits 0.

## Blockers

### blocker: continuation-terminal-state-arity
- **Status:** open
- **Owner:** maintainer
- **Blocks:** 2.3, and therefore 2.1 and 2.2
- **What to do:** pick exactly one — (a) extend `RUN_TERMINAL_STATES` with a
  seventh value for an invalidated plan premise, accepting that every consumer
  of `TerminalState` gains a case; or (b) reuse `blocked` with a distinguishing
  reason field, keeping the arity at six and losing the ability to count
  premise-invalidation separately.
- **Resolved when:** the choice is recorded in this file with one sentence of
  reasoning, or an ADR amends the vocabulary contract.
- **Recommendation:** (a). The whole point of the rung is that a stale-plan halt
  is a different finding from an exhausted one, and (b) reintroduces the
  conflation the rung exists to remove.
- **If you do nothing:** Phase 2 cannot land. Phases 1, 3 and 4 are unaffected
  and can ship without this decision.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-09-03 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | The new rung fires on ordinary base movement | implementation | `origin/main` moves constantly; a fingerprint that disagrees on every push would halt every long run and be switched off within a day | Assert the rung against a fixture where the *claimed roadmap* changed, not merely the base ref; ship 2.1 with the negative case as well as the positive one | Phase 2 — Connect the drift detector to the decision it should change |
| 2 | The diagnostic verb lands and nothing invokes it | implementation | Exactly the defect this roadmap treats, reproduced one layer up: a reachable verb is not a consumed one | 1.3 forces the choice explicitly and permits an on-demand answer only with a written reason | Phase 1 — Make the hook-liveness instrument reachable |
| 3 | Widening the count gate's scope reds unrelated rule prose | implementation | 120 rule files enter a gate that has only ever read 16 curated docs; a phrasing the regex was never tuned against could fail the build | Run the widened gate before committing the scope change and fix or narrow on what it actually reports, never on what it might report | Phase 4 — Close the count-messaging scope gap |
| 4 | The archived correction reads as rewriting history | product | Editing a closed roadmap can look like tidying away a failure rather than recording one | 1.2 forbids touching the original claim and requires the correction to sit beside it, dated | Phase 1 — Make the hook-liveness instrument reachable |

## Acceptance Criteria

- [ ] AC-1 — `grep -rn 'hook_effect_doctor\|hook_effect_probe' src Taskfile.yml .github`
      names at least one caller that is not the two modules themselves.
- [ ] AC-2 — `grep -rn experiment_freeze src` names at least one non-test importer.
- [ ] AC-3 — `grep -c context_fingerprint src/scripts/hooks/run_continuation_hook.ts` > 0,
      or Phase 2 stands `[~]` with the blocker unresolved and said so.
- [ ] AC-4 — `./scripts-run src/scripts/check_artefact_count_messaging` exits 0
      with `src/rules/**` inside its scanned set.
- [ ] AC-5 — the archived `road-to-delivered-cost-truth.md` no longer asserts an
      unqualified landing at `hooks_doctor.ts:88`.
