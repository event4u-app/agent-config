---
complexity: lightweight
status: ready
execution:
  mode: phase-checkpoints
relates:
  - stubs/road-to-runtime-orchestration-substrate
  - later/road-to-experience-loop-owner-decisions
  - archive/road-to-delivered-cost-truth
estate_growth_exempt: This diff adds six roadmaps and the seven blockers they carry, taking active_roadmaps 1 to 7 and open_blockers 29 to 36. The growth is the point of the change: the 2026-09-b inbox round produced six survivors that each needed a decision recorded as a blocker rather than an assumption made silently. Claimed once, for this change only.
estate_offset_exempt: Added by the 2026-09-b inbox round on the maintainer's instruction to carry its survivors into ready roadmaps. No archive move was available as a named one-in-one-out counterpart, so this is a self-issued claim and not an offset -- the distinction the owner-reserved question in agents/roadmaps/stubs/road-to-owner-authority-decisions.md records as undecided. Stated rather than smoothed over.
---
# Road to wired instruments

> **Source:** `agents/tmp.old/inbox-2026-09-b/s09/` and `.../s11/`, two
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

- [x] **1.1 Give `hook_effect_doctor` a CLI entry.** Register it in
      `src/cli/registry.ts` beside the existing `hooks:doctor` row (`:89`), which
      answers a different question — manifest scope, not whether a bound concern
      actually fires on this host.
      verify: `./agent-config <the new verb> --help` exits 0 and prints the
      probe's own verdict vocabulary; `grep -c '<the new verb>' src/cli/registry.ts` ≥ 1.
- [x] **1.2 Correct the archived landing record.** Append a dated correction to
      `agents/roadmaps/archive/road-to-delivered-cost-truth.md` stating that the
      `hooks_doctor.ts:88` half of its landing claim is false, and where the
      wiring actually landed once 1.1 is done. Do not rewrite the original line —
      the record of the wrong claim is the evidence.
      verify: `grep -c 'hook_effect' src/scripts/hooks_doctor.ts` is still `0`
      **and** the archived file carries a correction paragraph naming that fact.
- [x] **1.3 Decide whether the verb runs anywhere automatically.** It is a
      diagnostic, and a diagnostic nothing invokes is the defect this roadmap is
      about. Pick a caller or state in one line why on-demand is the right shape.
      verify: either a Taskfile target or a workflow step invokes it, or the
      roadmap carries the one-line reason and the step is `[~]`.

> **Phase 1 landed 2026-09-03.** The verb is **`agent-config hooks:effect`**
> (`src/cli/registry.ts:90`, dispatched by `cmd_hooks_effect` in
> `src/scripts/_dispatch.bash`, entered at `src/scripts/hook_effect_doctor.ts`
> `main()`). `--help` renders both closed vocabularies from `PROBE_STATES` and
> `HOST_VERDICTS` rather than restating them, so the help cannot describe a
> vocabulary the probe no longer has. Two stale self-references inside the module
> were corrected in the same edit: its usage block and its error prefix both said
> `hooks_doctor`, the very confusion its own header exists to prevent.
>
> **1.3, the one-line reason, recorded rather than implied:** `task
> dev:hooks-effect` is the invocation surface, and the verb is deliberately NOT
> in `task ci` or a workflow — the verdict is a property of the operator's host,
> and a CI runner is nobody's host, so an automatic green there would describe an
> install no consumer has. This is the identical argument
> `dev:standing-rule-delivery` already carries in its own `desc`, and it is why
> the answer is a discoverable target rather than a scheduled run.
>
> Observed on this host at `--limit 4`: `verdict: partial`, 1 `effective`,
> 3 `bound-not-fired`, `inert slot(s): session_start`, exit 0.

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

- [x] **3.1 Bind `ExperimentSpec` where the corpus is already pinned.**
      `evolution_lab.ts` fails closed on holdout leak and `corpus_manifest.ts`
      pins the corpus, but the two mechanisms are independent; `ExperimentSpec`
      exists to join evaluator, corpus, task, baseline and fixtures into one
      hash. Wire it as the binding, not as a second pinning scheme.
      verify: `grep -rn experiment_freeze src` names at least one non-test
      importer, and a drift fixture makes `ExperimentDriftError` throw in a test
      that fails when the binding is removed.
- [x] **3.2 Prove the sensitivity, not just the pass.** Neutralise the binding,
      watch the test go red, restore it. A test never seen red has unknown
      sensitivity.
      verify: the roadmap records the observed red output verbatim.

> **Phase 3 landed 2026-09-03.** The binding is
> `src/scripts/_lib/experiment_binding.ts`, imported by
> `src/scripts/evolution_lab.ts:92-93` — the first non-test importer
> `experiment_freeze` has ever had. It joins the five elements out of identities
> the run already carries (`CASCADE_STAGES` in order, a content digest over the
> candidate record set, the sorted `PROMOTION_EVIDENCE_FIELDS`,
> `target_shape_hash()`, `WITH_SURFACES`) rather than inventing a second pinning
> scheme. `verbRun` freezes before the clone loop and asserts after it, and
> `guardAbort` maps `ExperimentDriftError` onto `EXIT_GUARD_ABORT` — the same
> throw-to-exit-code conversion the `guard-call-site-integration` blocker
> demanded of the budget and holdout guards.
>
> The window it closes is specific: the loop clones from one read of a record
> and then RE-READS the same file from disk to evaluate it, so a record
> rewritten in between yields a run that cloned one thing and scored another.
> Every guard already in that verb fires before the run starts and never looks
> again.
>
> **3.2 — the observed red, verbatim, both polarities.** Two independent
> neutralisations, each restored byte-exact afterwards (`diff -q` clean).
>
> Removing the `assertUnchanged` call site from `verbRun`:
>
> ```
>  FAIL  tests/scripts/experiment_binding.test.ts > the binding is wired into the runner > it freezes once and re-derives the spec for the assertion
> AssertionError: expected 1 to be greater than or equal to 2
>  FAIL  tests/scripts/experiment_binding.test.ts > the binding is wired into the runner > the freeze happens BEFORE the clone loop
> AssertionError: expected -1 to be greater than -1
>       Tests  2 failed | 7 passed (9)
> ```
>
> Making `recordSetDigest` ignore file content (`void bytes;` in place of the
> content hash), which leaves the wiring intact and kills only the detection:
>
> ```
>  FAIL  tests/scripts/experiment_binding.test.ts > the drift fixture > a record rewritten mid-run aborts, naming the corpus
> AssertionError: expected undefined to be an instance of ExperimentDriftError
> ```
>
> Restored: `Tests  9 passed (9)`. The two probes matter separately — the first
> proves the runner is really the consumer, the second proves the detection is
> really content-sensitive. A single probe would have left one of those unknown.

## Phase 4 — Close the count-messaging scope gap

- [x] **4.1 Add `src/rules/**` to `SURFACES` in
      `src/scripts/check_artefact_count_messaging.ts`.** The list at `:44-67`
      carries a written rationale per entry; add one for this class too — rules
      are the most-delivered surface this package has, and a wrong self-count
      there reaches every consumer session.
      verify: running the gate before the fix reports the two known hits; after
      4.2 it reports zero.
- [x] **4.2 Fix the two stale counts.** `src/rules/missing-skill-recovery.md`
      (297) and `src/rules/token-budget-discipline.md` (~290) against the actual
      299. Both edits are line-scoped; a whole-file sweep is a drive-by change.
      verify: `./scripts-run src/scripts/check_artefact_count_messaging` exits 0.

> **Phase 4 landed 2026-09-03, with one correction to this roadmap's own premise.**
>
> `SURFACES` at `src/scripts/check_artefact_count_messaging.ts:44-67` now carries
> `src/rules/**` as `RULE_SURFACE_DIR`, enumerated at run time rather than
> hand-listed — a list of 120 paths would go stale on the first rule added, which
> is the drift class this gate exists to catch. Rationale for the class, written
> beside the others: rules are the most-delivered surface this package ships, so
> a wrong self-count there reaches every consumer session. An empty walk is a
> hard failure, never a clean run.
>
> **Risk 3 measured rather than predicted.** 120 rule files entered a gate tuned
> on 16 curated docs. The widened gate reported exactly **two** hits — the two
> this roadmap named — and no phrasing the regex was never tuned against. Run
> before the fix, as 4.1 asks:
>
> ```
> ❌  Artefact-count messaging drift — 2 mismatch(es):
>     src/rules/missing-skill-recovery.md:34: skills says 297, expected 299
>     src/rules/token-budget-discipline.md:60: skills says 290, expected 299 (approximation "~" not allowed on flagship surfaces)
>     internal inconsistency — skills: {290, 297, 299}
> ```
>
> **The finding: only ONE of the two was a stale self-count.**
> `token-budget-discipline.md:60` was — `~290 skills` against a live 299, and its
> derived 15 % cap of `~43` was stale with it; both are corrected in one
> line-scoped edit (`299 skills`, cap `~44`).
> `missing-skill-recovery.md:34` was **not**. Its `297` is a figure from the
> dated measurement the same paragraph cites — the `legacy-all` row of
> `agents/evidence/analysis/scoped-projection-host-delivery.md`, measured
> 2026-08-16 — and rewriting it to 299 would have falsified recorded evidence to
> satisfy a gate. This roadmap's Context asserted both were stale; that half is
> wrong, and it is recorded here rather than quietly implemented.
>
> The gate's charter already excluded dated snapshots but could only express it
> by leaving a whole FILE out, which is useless when one paragraph of live rule
> prose carries one dated figure. So the exclusion became per line:
> `<!-- artefact-count: dated-measurement -->`, which silences that line only and
> keeps it out of the cross-surface inconsistency net as well. The rule's prose
> now names the date and the artefact, so the exemption is falsifiable rather
> than a mute button.
>
> **`src/rules/**` is deliberately NOT in the anchor-coverage pass**, and the
> reason is mechanical: satisfying it would make `update_counts` a writer into
> `src/rules/`, where the kernel rules sit behind `block_kernel_rule_writes`. A
> generator that must never touch part of its own target directory is one path
> move away from being disarmed. A stale rule count therefore fails on value and
> a human fixes it; the gate's failure advice says so instead of pointing at a
> generator that will not write there.
>
> **Both polarities observed.** Dropping the rule set back out of the scan makes
> a planted `271 skills` in a rule pass with exit 0 — the blindness as it stood.
> Removing the marker handling reds three tests including the live gate.
> Restored: gate exits 0, `Tests 18 passed (18)`.

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

- [x] AC-1 — `grep -rn 'hook_effect_doctor\|hook_effect_probe' src Taskfile.yml .github`
      names at least one caller that is not the two modules themselves.
- [x] AC-2 — `grep -rn experiment_freeze src` names at least one non-test importer.
- [ ] AC-3 — `grep -c context_fingerprint src/scripts/hooks/run_continuation_hook.ts` > 0,
      or Phase 2 stands `[~]` with the blocker unresolved and said so.
- [x] AC-4 — `./scripts-run src/scripts/check_artefact_count_messaging` exits 0
      with `src/rules/**` inside its scanned set.
- [x] AC-5 — the archived `road-to-delivered-cost-truth.md` no longer asserts an
      unqualified landing at `hooks_doctor.ts:88`.
