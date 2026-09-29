---
complexity: lightweight
status: ready
parent_roadmap: road-to-a-ledger-that-closes-the-loop
execution:
  mode: phase-checkpoints
estate_offset_exempt: "Supersedes road-to-a-ledger-that-closes-the-loop, but does not dispose of it: that file is active and ready, and archiving it executes the supersession rather than declaring it. Disposing of it in the same diff that merely adds the plan would retire live work on an inbox round's authority."
relates:
  - slug: road-to-a-ledger-that-closes-the-loop
    relation: supersedes
    note: "carries its 6.1 and AC-6 verbatim (§ Phase 3) under a deferred-resolution annotation; archiving the ledger file is this roadmap's own work, not done in the diff that adds this file"
  - slug: road-to-adversarial-verification-and-long-runs
    relation: extends
    note: "its open blocker daemon-host-kill-switch receives the kill-switch table of step 1.4"
depends: [road-to-a-kernel-that-guards-its-plumbing]
---
# Road to a stop that holds

> **Source:** ten-package code audit (2026-09-28), rows Episode closure 3,
> Mission persistence 3, Obligation ledger 3, Decision closure 4, Test-first 4
> against S9 at 6/6/6/6/8. Tree facts at `8de8a4c`, re-verified in the second
> pass: Layer 1 allows on `stop_hook_active` (`turn_end_gate_hook.ts:1199`),
> Layer 2 on `alreadyRefusedTurn` (`:1297`, reads `refused_turn === turnOrdinal`,
> `:909-925`); Detector C `detectUnverifiedEdit` (`:731-754`) scans
> `toolCalls` after the last edit against `_VERIFY_RE` (`:709`); the
> PostToolUse recorder `before_complete_hook.ts:387-450` persists
> `last_verification {command, tool, at, vacuous, counted}` and `ci_last` but
> no exit code and no output; `obligation_settle_hook.ts` allows on every path
> and its reading shows **80 delivered rows, 0 shadow rows** across 4 ledgers
> (`road-to-a-ledger-that-closes-the-loop.md:205-216`).

## Context

Carried from `agents/roadmaps/archive/road-to-a-ledger-that-closes-the-loop.md`
(template rule 17): its step 6.1 "Arm it only after the pre-registered bar
holds" and AC-6 are reproduced verbatim in § Phase 3, with the emitter defect
that kept its bar at zero fixed first.

> **corrected-from-reproduction (2026-09-29, /analyze:inbox t06).** The supplied
> file was reproduced against `main` read-only. Every `file:line` in its Source
> block resolved. ONE correction applied: the Risk Register `Risk type` column
> used values outside the enum `lint_plan_risk_register` enforces (`product` |
> `implementation`), which `status: draft` exempts and which reds the file the
> moment it flips to `ready`. The column is normalised; nothing else changed.

## Goal

A turn that changed production code cannot end on a verification the code
did not see pass: the stop gate reads a persisted run record with a command,
an exit code and a parsed test summary, classified by a pure module; the
contract's own Q1 instrument (shadow read on the allow path) makes the
re-refusal share a number; and the obligation ledger's shadow rows exist so
its pre-registered bar can be read — armed only by that reading.

## Prerequisites

- `road-to-a-kernel-that-guards-its-plumbing` Phase 1 landed (the gate's files
  are covered by the ratified-edit path).
- `tests/scripts/turn_end_gate_hook.test.ts`, `turn_end_verify_allowlist.test.ts`,
  `tests/scripts/hooks/before_complete_*.test.ts` green at the start ref.
- Every fixture in this lane is either red at the start ref or marked
  `already_fixed` with a code citation; none is invented to keep a step
  relevant. Sabotage-first: each guard's test is shown red with the guard
  neutralised before the fix lands; a source-string assertion never
  satisfies a primary `verify:` line.

## Phase 1 — Verification is a record, not a regex

- [ ] **1.1 Add `src/scripts/_lib/verification_evidence.ts` (new).** Pure
      classifier over a run record `{command, exit_code: number|null,
      stdout_tail, stderr_tail, runner}` → one of
      `PASS_EVIDENCE_OK | FAIL_EVIDENCE | INVALID_RUN(reason)` with reasons
      `zero_tests_discovered | nonzero_exit_without_test_failure |
      fixture_or_load_failure | unreadable_record | not_a_verification_command |
      exit_code_unavailable | timeout_or_killed`. Parsers: vitest/jest summary line, TAP, pytest
      `-q` tail, phpunit/pest summary. `exit_code: null` (a host that omits it)
      → `exit_code_unavailable`, never a pass. No fs, no spawn, no clock.
      verify: `tests/scripts/verification_evidence.test.ts` (new) — one
      fixture per verdict and runner; `echo test` → `not_a_verification_command`;
      0 tests → `zero_tests_discovered`; `exit_code: null` → `exit_code_unavailable`;
      `npm test && exit 1` → `FAIL_EVIDENCE`; `ls build` →
      `not_a_verification_command`; a killed vitest (`exit_code: 137|143`, no
      summary) → `timeout_or_killed`, never a pass.
- [ ] **1.2 Extend the existing recorder, not the manifest.** In
      `before_complete_hook.ts` (`verify-before-complete`,
      `hook_manifest.yaml:118-123`, `needs_payload_bodies: [input, result]`,
      already bound on every host's `post_tool_use`): read `exit_code` and the
      last 4 KB of `tool_response|toolResponse|output|stdout|result`
      (`:324-335` already resolves the field) and append a per-turn
      `verification_runs[]` entry beside `last_verification` in the existing
      state file (`statePathFor`, `:128`; digest convention `state_io.ts:675`).
      Each entry carries the post-tool ordinal (or `at`) so a record can be
      placed against the turn's edit sequence without a transcript read.
      No new concern id (K16); the `post_tool_use` slot budget is untouched.
      verify: after `npx vitest run tests/scripts/verification_evidence.test.ts`
      in a session, the state file carries one `verification_runs` entry with
      `exit_code: 0` and `runner: vitest`; `tests/scripts/hooks/before_complete_hook.test.ts`
      extended, not rewritten.
- [ ] **1.3 Detector C reads records, and keeps a replay mode.** In
      `turn_end_gate_hook.ts` `detectUnverifiedEdit`: when the state file has
      `verification_runs` for this turn, fire iff none classifies
      `PASS_EVIDENCE_OK` **with an ordinal after the turn's last edit** (the
      regex path already scans only after the last edit, `:718-725`; the record
      path must keep that or it regresses); when the file has none (transcript replay through
      `measure_turn_end_gate.ts` / `check_detector_corpus.ts`), fall back to
      the `toolCalls` scan so the false-positive corpus stays replayable. The
      fallback is logged as `mode: transcript`.
      verify: `turn_end_gate_hook.test.ts:1427` ("is silent when a verification
      run follows the edit") rewritten to the record form; a new case:
      `echo test` + edit + no record → refused; edit → pass → edit → refused
      (proof predates the final mutation); `turn_end_verify_allowlist.test.ts`
      unchanged (it pins the selector, which still exists);
      `measure_turn_end_gate` reproduces its last committed corpus reading.
- [ ] **1.4 Kill-switch table.** Add `## Kill switches` to
      `docs/contracts/hook-architecture-v1.md` listing every
      `AGENT_CONFIG_[A-Z_]+` the hooks read (bracket form —
      `run_continuation_hook.ts:1018`, `state_io.ts:42`, …), with owner class;
      resolve blocker `daemon-host-kill-switch` in the adversarial roadmap by
      pointing its `Resolved when` at the table.
      verify: `grep -rhoE "AGENT_CONFIG_[A-Z_]+" src/scripts/hooks src/scripts/_lib | grep -v __AGENT_CONFIG_BUNDLE__ | sort -u | wc -l`
      equals the table's row count.

## Phase 2 — Q1 becomes a number (the contract's instrument, no second refusal)

- [ ] **2.1 Shadow read on the allow path.** Per
      `turn-end-detector-demotion.md:342-354`: on a retry (Layer 1 or Layer 2
      true), before returning `EXIT_ALLOW`, run the detectors once more and
      record `would_refuse_again: {detector, turnOrdinal}` into the session
      state. Verdict stays `EXIT_ALLOW`; latency budget: the extra transcript
      read happens only on retries (`hook-latency-budget.json` `any_hook_event.p95_ci: 250`).
      verify: fixture retry that still promises → allowed AND a
      `would_refuse_again` row; `bench_hook_latency --gate` green.
- [ ] **2.2 Q1 in the detector report.** `measure_turn_end_gate.ts` prints
      Q1 = `would_refuse_again` rows / eligible initial refusals per detector;
      the contract's § Q1 loses the word "inert" and names the reader.
      verify: report shows a non-null Q1 after one week of sessions; contract
      diff in the same PR.
- [ ] **2.3 Publish the reading** to `agents/evidence/analysis/turn-end-q1-<date>.md`
      and open programme blocker `d1-stop-ladder-after-reading`.
      verify: file exists; the blocker's `What to do` cites it.

## Phase 3 — The obligation ledger can refuse (carried)

- [ ] **3.1 Reproduce the zero-shadow defect before fixing it.** Test: seed a
      ledger with delivered rows (as `rule_inject_hook.ts:281` writes them,
      keyed on the envelope `session_id`, `:390`), run `obligation_settle_hook`
      with `CLAUDE_CODE_SESSION_ID` unset (the dispatcher sets none,
      `dispatch_hook.ts:728`) → expect the early return at `:148` and zero
      shadow rows. Then fix the join: the settle hook resolves the session
      the same way the injector does (envelope, then env fallback). Both
      arrays live in one `agents/runtime/state/obligations/<digest>.json`
      (`_lib/obligations.ts:57-62`); no path change.
      verify: the reproducing test fails before and passes after; a session in
      this repository that edits code without discharging gains a `shadow`
      row.
- [ ] **3.2 Reset the bar window from 3.1's commit** — mandated by clause (2)
      of `docs/CLAIMS.md:1211` on any change to the delivered-row write path
      (the join is that path). Numbers unchanged (K7).
      verify: `check_claims` exits 0; `last_verified` names 3.1's commit.
- [ ] **3.3 Carried verbatim — 6.1 Arm it only after the pre-registered bar
      holds.** Flip `obligation-settle` to `severity: blocking` only when the
      `CLAIMS.md` reading meets all four parts; the flip PR carries the
      reading and extends `BLOCKING_ALLOWLIST` in
      `tests/hooks/concern_severity.test.ts:42-47`. A human-authorised
      discharge is a `DischargeRow` with `by: ratification:<artifact-id>`
      (`_lib/ratification_artifact.ts`, `agents/evidence/ratifications/`) —
      one authorisation channel, never a second "override" object.
      verify: manifest diff, reading and allowlist change in one commit.
- [ ] **3.4 Carried — AC-6 of the parent:** the armed detector refuses a turn
      that wrote files under an undischarged obligation and allows one that
      discharged it, on this repository's own sessions.
      verify: two fixture sessions; `report_obligation_settle` (existing reader
      of the ledger, or `measure_turn_end_gate` if it is the reader) shows one
      refusal and one allow; deleting the referenced `DischargeRow` in the
      allowed fixture reopens settlement and the detector refuses.

## Phase 4 — A refusing ladder (gated on programme blocker d1)

- [ ] **4.1 Only if D1 is "yes":** replace Layer 2's boolean with the
      contract's ladder — refuse a retry that still carries no
      `PASS_EVIDENCE_OK` record, allow unconditionally at the third
      consecutive refusal (`turn-end-detector-demotion.md:330-336`), write a
      `third_strike` row. Replace the pinned test
      `turn_end_gate_hook.test.ts:962` ("LAYER 2 … stops a second refusal")
      with the ladder cases, naming this step in the test title; amend the
      contract section in the same PR.
      verify: second stop without record refused; third allowed with row;
      second stop with record allowed.

## Phase 5 — Test-first as evidence

- [ ] **5.1 `RED_THEN_GREEN` in the record, checked at the stop.** Two
      `verification_runs` entries for the same test file — the earlier
      `FAIL_EVIDENCE` naming a test the later `PASS_EVIDENCE_OK` names as
      passing — classify `RED_THEN_GREEN`. Detector F ("completion claim over
      production code no test accompanies", `:757`) accepts a new test file
      only with that pair present. `check_test_delta.ts` is **not** extended:
      its header (`:9-13`) states it cannot see order and CI cannot reach
      gitignored session state.
      verify: fixture pair red→green allowed; green→green with a new test file
      refused with `no_red_evidence`.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-09-28 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | Parser misses a consumer's runner and refuses honest work | implementation | A passing run classifies `INVALID_RUN` | Only absence of any record or `FAIL_EVIDENCE` refuses; every `INVALID_RUN` reason is logged as a finding, never refused on | Phase 1 — Verification is a record, not a regex |
| 2 | Shadow read on retries breaks the stop-slot budget | implementation | Extra transcript read per retry | Retries only; `bench_hook_latency --gate` in the PR | Phase 2 — Q1 becomes a number (the contract's instrument, no second refusal) |
| 3 | The join fix changes the delivered-row semantics the bar was registered on | product | Window must restart | Clause (2) of the claim mandates exactly that; 3.2 does it | Phase 3 — The obligation ledger can refuse (carried) |

## Acceptance Criteria

- [ ] AC-1 — A turn that edits a non-doc file with `echo test` as its only
      verification is refused at its first stop naming the missing record; the
      same turn with a `PASS_EVIDENCE_OK` entry ends normally.
- [ ] AC-2 — `measure_turn_end_gate` prints a non-null Q1 per detector and the
      contract no longer calls Q1 inert.
- [ ] AC-3 — The obligation ledger in this repository's own sessions gains
      shadow rows within seven days of 3.1.
- [ ] AC-4 — (carried AC-6) once armed, the detector refuses an undischarged
      write and allows a discharged one.
- [ ] AC-5 — The kill-switch table's row count equals the grep count.

## Provenance

Source-derived (template rule 19). Pre-council draft; council notes are
inlined before promotion.

| Descriptor | Token | Drawn in, per defect |
|---|---|---|
| S9 — phase-loop reference | `ENC1:<mint>` | RED-evidence verdict vocabulary (`zero_tests_discovered`, `fixture_or_load_failure`, `nonzero_exit_without_test_failure`) for the defect "Detector C reads command text" |
| S3 — prose-corpus reference | `ENC1:<mint>` | negative control: deny-once keyed on a command hash — the shape 4.1's ladder is not |

Gap-table: KEEP 1.1, 1.3, 1.4, 2.1–2.3, 3.1–3.2, 5.1; FOLD 1.2 (into the
existing recorder), 3.3–3.4 (carried from the parent); CUT "new
verification-record concern" (recorder exists), "retire
verify-before-complete" (feeds Detector D), "native delivery writer" (80
delivered rows exist — wrong root cause). From the parallel proposal
`road-to-observed-completion-kernel` (consolidated by the programme): ADOPTED
`timeout_or_killed`, the record ordinal, the edit→pass→edit fixture, the
delete-discharge fixture, the ratification-backed discharge and the
`already_fixed`/sabotage-first disciplines; CUT its `ToolObservation` record
and completion state machine (second vocabularies beside `RUN_TERMINAL_STATES`
and `JournalEvent.terminal_state|verification_ref`), its
HARD/EVIDENCE_REQUIRED/ADVISORY classes (second taxonomy beside
`REFUSABLE_CLASSES`, `obligation_frequency.ts:185-215`), its "denied for
every N" test (asserts the wedge `turn-end-detector-demotion.md:86-87,333-336`
forbids), and its HEAD-digest freshness (adds a git spawn to the stop slot).
