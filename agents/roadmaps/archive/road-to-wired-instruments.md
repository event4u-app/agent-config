---
complexity: lightweight
status: ready
execution:
  mode: phase-checkpoints
relates:
  - slug: archive/road-to-delivered-cost-truth
    relation: extends
    note: "Phase 1 finishes the hook-liveness wiring that roadmap RECORDED as landed at hooks_doctor.ts:88 and never made, and appends the dated correction beside the original claim"
  - slug: stubs/road-to-runtime-orchestration-substrate
    relation: disjoint
    note: "adjacent vocabulary (run supervision, orchestration) and no shared mechanism -- every track there is a resident Class-B process gated on the governance-flip ADR, while this roadmap wires in-process instruments that already exist and adds no resident process"
  - slug: later/road-to-experience-loop-owner-decisions
    relation: disjoint
    note: "that file carries 7.6 (incremental card updates, decision E8) and 9.6 (the Class-C question); this roadmap touches neither -- its only overlap in that family is with the PARENT road-to-experience-loop-broadening step 1.3, whose registry revisit-if Phase 2.3 fires, and the parent is not this file"
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

- [x] **2.1 Read `context_fingerprint` in the continuation ladder.** The
      fingerprint is built by `roadmap_context.ts` from `origin/main` plus open
      PR heads and stored by `run_checkpoint.ts`; `verifyCheckpoint` already
      returns per-field agreement. The ladder in
      `src/scripts/hooks/run_continuation_hook.ts:487` never consults it.
      verify: `grep -c context_fingerprint src/scripts/hooks/run_continuation_hook.ts` > 0,
      and a unit test drives `ladder()` with a disagreeing fingerprint.
- [x] **2.2 Place the rung before the iteration cap.** A run whose plan premise
      moved should terminate under its own word, not as `exhausted` — the two
      are different findings and the current vocabulary cannot tell them apart.
      verify: the test from 2.1 asserts the new terminal state, not `exhausted`.
- [x] **2.3 Add the terminal state to the closed vocabulary.**
      `RUN_TERMINAL_STATES` in `src/scripts/_lib/outcome_vocabularies.ts` holds
      six values and is re-exported as `TerminalState` through
      `outcome_envelope.ts`, which `runtime_journal.test.ts` pins with an
      anti-fork assertion. Extend the one declaration; never add a second.
      verify: `task test` green, including `runtime_journal.test.ts`.

> **Phase 2 landed 2026-09-03, and it found a second dead instrument on the way
> in.** The rung is `halt-premise-invalidated` in
> `src/scripts/_lib/continuation_ladder.ts:148`, and it reports the run terminal
> state `premise-invalidated` through `terminalStateFor` at `:103`.
>
> **The premise this step was written on was half wrong, and the half that was
> wrong is the important one.** The Context table says `context_fingerprint` is
> "written by `run_checkpoint.ts`" and merely not read by the ladder. It is
> written by nothing: `session_eol_hook.ts:384` at `origin/main` was the only production caller of
> `buildCheckpoint`, it passed no options, and the field is therefore `null` in
> every checkpoint this package has ever written. Consuming it in the ladder
> would have wired one instrument to another instrument that was itself wired to
> nothing — the roadmap's own defect class, reproduced inside its fix. So Phase 2
> built the missing producer first.
>
> **The producer** is `src/scripts/_lib/context_observation.ts`, written by
> `roadmap_context.ts:762` — the one thing in the tree that can actually OBSERVE
> the world, because the fingerprint costs a `gh` call. It records to a single
> repository-wide file, not a per-roadmap one: `contextFingerprint(base_sha,
> open_prs)` takes no roadmap argument, so keying it per roadmap would key a
> repository-wide fact on something it does not depend on and would miss every
> unscoped probe. Only a `network: 'live'` reading is recorded — offline the
> digest is a statement about the network, and recording it would make every
> dropped connection look like a moved premise.
>
> **The two consumers** are now both real: `session_eol_hook.ts:393` passes the
> observation into the checkpoint, so `context_fingerprint` stops being
> structurally null; and `run_continuation_hook.ts:1386` compares the fingerprint
> the run ENGAGED under (recorded once, at `:1464`) against the newest
> observation, and feeds the verdict to the ladder.
>
> **Risk 1 is answered by construction, not by tuning.** The rung cannot fire on
> `origin/main` moving: nothing is observed unless the run itself re-probes, and
> `premiseMoved` returns false whenever either side is unknown. Three negative
> cases are pinned through the live dispatcher — unchanged observation, no
> observation at all, and every unknown-side combination — because a rung that
> halted healthy runs would be switched off within a day and the positive case
> alone cannot tell the two apart.
>
> **2.2's ordering claim is tested in isolation from the rung's existence.** The
> rung sits above the counter rungs and below the zero-open rungs: finished work
> cannot be un-finished by a stale premise, and everything below it is a BUDGET,
> which is the wrong word for staleness.
>
> **The phase paid for its own lines.** `run_continuation_hook.ts` sat at 1,539
> lines against `check_source_size_budget`'s 1,500-line ratchet, where every line
> is a violation. Rather than raise a baseline, the ladder — the surface actually
> under change — moved to `_lib/continuation_ladder.ts` (under the cap, so free)
> and is re-exported, so every existing import path is unchanged. Net: 1,539 →
> 1,530, nine lines BELOW where the phase started.
>
> **Sensitivity, both polarities, five probes; each restored byte-exact
> afterwards (`diff -q` clean).**
>
> 1. The rung deleted from the ladder (`void premiseInvalidated;`):
>
> ```
>  FAIL  ladder — the premise rung > a disagreeing fingerprint halts under its OWN word
> AssertionError: expected 'engage' to be 'halt-premise-invalidated'
> ```
>
> 2. The rung KEPT but moved below the iteration cap — 2.2's claim on its own,
>    with the rung intact:
>
> ```
>  FAIL  ladder — the premise rung > it fires BEFORE the iteration cap, so a stale plan is never reported as exhausted
> AssertionError: expected 'halt-max-iterations' to be 'halt-premise-invalidated'
>  FAIL  ladder — the premise rung > and before the wall clock and the stall rungs, for the same reason
> AssertionError: expected 'halt-wall-clock' to be 'halt-premise-invalidated'
> ```
>
> 3. The hook stops passing the verdict (`premiseInvalidated,` → `false,`) —
>    everything still built, nothing consumed, which is this roadmap's subject:
>
> ```
>  FAIL  run-continuation — the premise rung, through the live dispatcher > an observation that MOVED after the run engaged halts it under the premise rung
> AssertionError: expected 2 to be +0
> ```
>
> 4. The tolerant journal read reverted to the blind cast:
>
> ```
>  FAIL  terminal_state — a widened value domain > a row written by a NEWER vocabulary reads as not-recorded, never as a crash
> AssertionError: expected 'from-the-future' to be null
> ```
>
> 5. The forward-tolerance branch dropped from `parseHaltStamp`:
>
> ```
> AssertionError: expected null to be 'halt-from-a-future-version'
> ```

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
> `<!-- count: dated -->`, which silences that line only and keeps it out of the
> cross-surface inconsistency net as well. The paragraph directly above the marked
> line already names the date and the evidence artefact, so the exemption is
> falsifiable rather than a mute button — and the marker is terse for a measured
> reason, not a stylistic one (see the payload note below).
>
> **A second regression this phase caught, on the payload budget.** `main`
> measures **exactly** 138,273 tokens of per-spawn preamble against a grace
> ceiling of 138,273 — zero headroom, and that ceiling may never move up by its
> own contract. The first version of these two rule edits was +48, which reds
> `check_preamble_payload_budget`. Verified pre-existing-vs-mine by restoring
> both `dist/agent-src/rules/` files to `origin/main` and re-measuring: base
> 138,273 exactly. The edits were then tightened until the net was negative —
> the citation prose was dropped because the paragraph above it already carries
> the date and the artefact path, and the marker was shortened from
> `artefact-count: dated-measurement` to `count: dated`. Final: **138,272**,
> one token below the ceiling and one below `main`. A rule edit in this tree
> now has to pay for itself.
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
- **Status:** resolved
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
- **Decision:** **(a)**, unanimous. AI council 2026-09-03, members
  `anthropic/claude-sonnet-4-5` and `openai/codex-default`, three rounds, blind
  chairman, standing in for maintainer sign-off under the standing drain
  mandate. Verdict as recorded: *extend `RUN_TERMINAL_STATES` with a seventh
  value. Premise invalidation is operationally distinct from budget exhaustion
  and from being blocked; conflating it via a reason field defeats the purpose,
  losing both aggregation by state and type-enforced exhaustive handling. It is
  distinct enough to aggregate and route independently from ordinary blocking.*
  This agrees with the recommendation above, which is why the recommendation is
  left standing rather than rewritten.

  Both seats independently attached the SAME prerequisite set, and the seats
  treated them as part of the decision rather than as optional hardening — one
  wrote *"MUST ship with: schema versioning, unknown-value handling, downgrade
  mapping to `blocked`, rollback trigger for compatibility failures"*, the other
  *"emit it only after schema versioning, exhaustive-consumer inventory,
  unknown-value tolerance, and a downgrade mapping to `blocked` are in place"*.
  Each one, and how it was discharged:

  1. **Exhaustive-consumer inventory — BUILT, and it found the two persisted
     domains.** Every consumer of `RUN_TERMINAL_STATES` / `TerminalState`, from
     `grep -rn` over `src` and `tests`:
     · `_lib/repeated_failure.ts:30-66` — throws at module load on any
       unclassified state, so the new value had to be classified (it is
       EXCLUDED, beside `approval-required`: a premise invalidation is the drift
       detector working, and its base rate is set by other people's pushes, so
       counting it as a failure would make the repeated-failure rate track
       repository traffic — Risk 1 arriving through the metric).
     · `_lib/outcome_envelope.ts:37` — `NON_SUCCESS_STATES`; the value is in it,
       so an envelope in that state must carry a next action.
     · `_lib/runtime_journal.ts` — **persists** it in SQLite (`:756` column,
       `:1017` write guard, `:1108` read). The one consumer whose data outlives
       its code.
     · `_lib/ignored_blocker.ts:51,96` — reuses the type verbatim, no switch.
     · `tests/contracts/outcome_vocabularies.test.ts`,
       `tests/scripts/runtime_journal.test.ts`,
       `tests/scripts/envelope_consumption.test.ts` — the last of these carries
       an explicit arity guard that fired as designed and was updated by
       enumerating the new value, never by widening the assertion.
     · `src/agent-src/contexts/execution/terminal-states.md` — the contract,
       bound by test rather than by import.
     The inventory also surfaced a **second** widened domain the blocker did not
     name: `LadderAction`, persisted as `RunState.halted` in the run-state file.
     It is treated on the same terms below.

  2. **Schema versioning — BUILT.** `RUN_TERMINAL_VOCABULARY_VERSION = 2` plus
     `RUN_TERMINAL_STATE_SINCE` in `_lib/outcome_vocabularies.ts`. Deliberately
     NOT a bump of `JOURNAL_SCHEMA_VERSION`: that number covers tables and
     columns and a mismatch DISCARDS the store, so bumping it for a widened
     value domain would throw away every unrelated row to no purpose. The
     reasoning is recorded at the export site, not only here. The run-continuation
     ledger line now carries `terminal_vocabulary_version` beside its
     `terminal_state`, so a persisted shape names the vocabulary it was written
     against.

  3. **Unknown-value tolerance — BUILT on both persisted domains, and the two
     landed on different answers for a stated reason.** For the terminal state,
     `readRunTerminalState` at the journal read boundary returns `null` for a
     value this build cannot place, which is the state every downstream consumer
     already handles as "not recorded"; the previous code blind-cast the column
     and handed consumers a typed value outside the type. For the ladder stamp,
     `parseHaltStamp` PRESERVES an unrecognised `halt-`prefixed value instead of
     dropping it — the old reader did not crash, it downgraded a newer build's
     halt to no halt at all, which re-engages a run that was deliberately ended.
     Fail-open in the one direction a budget must not fail open. The old
     docblock's claim that such a value "would become an action no branch below
     handles" was checked against every branch and is false for a halt-prefixed
     one; it is corrected at the source rather than carried forward.

  4. **Downgrade mapping to `blocked` — BUILT, and generalised.**
     `RUN_TERMINAL_STATE_DOWNGRADE` declares `premise-invalidated → blocked`, and
     `downgradeRunTerminalState(state, toVersion)` is what a consumer pinned at
     an older version calls. A contract test asserts that EVERY post-v1 member
     has a downgrade to a v1 member, so an eighth value cannot ship
     undowngradable. An unrecognised string downgrades to `null`, never to
     `blocked`: `blocked` is what a reader reports for a value it knows is newer,
     while a value it cannot place at all is an absence, and reporting `blocked`
     there would manufacture a measurement.

  5. **Rollback trigger — STATED, and deliberately not instrumented.** Recorded
     in `_lib/outcome_vocabularies.ts`: withdraw the value — remove it from
     `RUN_TERMINAL_STATES` and let the ladder rung report its declared downgrade
     `blocked` — on EITHER (1) any consumer observed failing on encountering it,
     or (2) `readRunTerminalState` returning `null` for a persisted value in
     normal operation, which would mean a writer emitted something the registry
     does not know. Single-occurrence triggers rather than rates, because the
     downgrade mapping already exists and withdrawal costs one commit and no
     migration, so there is no reason to tolerate a budget of failures first. No
     telemetry is built for this and none is claimed: (1) surfaces as a failing
     run and (2) as a null where a value was written.

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
- [x] AC-3 — `grep -c context_fingerprint src/scripts/hooks/run_continuation_hook.ts` > 0,
      or Phase 2 stands `[~]` with the blocker unresolved and said so.
- [x] AC-4 — `./scripts-run src/scripts/check_artefact_count_messaging` exits 0
      with `src/rules/**` inside its scanned set.
- [x] AC-5 — the archived `road-to-delivered-cost-truth.md` no longer asserts an
      unqualified landing at `hooks_doctor.ts:88`.
