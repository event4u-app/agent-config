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

- [x] **1.1 Add `src/scripts/_lib/verification_evidence.ts` (new).** Pure
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
      <!-- closed 2026-09-29, `d63895955`. `src/scripts/_lib/verification_evidence.ts`;
      `tests/scripts/verification_evidence.test.ts` 43 green (36 at 1.1, 7 added by 1.3).
      Every fixture the verify line names exists and passes, `exit_code: null` and
      an absent field both included. TWO DESIGN CHOICES NOT IN THE PLAN, both
      recorded because a reader will ask: (a) exit 0 with NO parsable summary is a
      PASS — `tsc --noEmit`, `eslint` and `phpstan` print nothing on success, and a
      classifier demanding a summary would reclassify the most common green signal
      in this tree as invalid; (b) `not_a_verification_command` is decided by a
      BLOCK list of executables that assert nothing, not an allow list, because it
      is a REFUSING reason and an allow list would put every runner the module has
      never met — `bash scripts/test.sh`, an in-house wrapper — into it on day one.
      `INSTRUMENT_GAP_REASONS` splits the two reasons that describe the instrument
      from the five that describe the run, which is Risk 1's mitigation made
      readable by the consumer instead of re-derived from a comment.
      SABOTAGE: dropping the `canVerify` guard and turning a missing exit code
      into a pass failed exactly 5 of 36 and no others; restored from a copy. -->
- [x] **1.2 Extend the existing recorder, not the manifest.** In
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
      <!-- closed 2026-09-29, `99255cd9f`. No new concern id, no manifest edit, no
      change to the `post_tool_use` slot budget — the existing recorder grew the
      array. `tests/scripts/hooks/before_complete_hook.test.ts` 35 green, extended
      (31 pre-existing cases untouched).
      ONE FIELD BEYOND THE PLAN: `after_edits`, the recorder's edit counter as it
      stood when the command ran. The plan asks for "the post-tool ordinal (or
      `at`)"; an ordinal against the TURN's edit count is what a reader can compare
      without a clock, so the field is the counter rather than a sequence number,
      and `edits_this_turn` is written beside it. `EDIT_TOOLS` carries all twelve
      names the bound platforms use, not the gate's four: a missed edit name makes
      a run look LATER than it was, which is the one direction that could clear an
      unverified edit.
      SABOTAGE: hardcoding the exit code to 0 and neutering the edit counter failed
      exactly 4 of 35 and no others; restored from a copy. -->
- [x] **1.3 Detector C reads records, and keeps a replay mode.** In
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
      <!-- closed 2026-09-29, `dcb07e09b`. `turn_end_gate_hook.test.ts` 130 green;
      `turn_end_verify_allowlist.test.ts` 56 green and UNTOUCHED;
      `check_detector_corpus` reports 3 detectors x 3 classes, 22 fixtures, all
      behaving — `measure_turn_end_gate` calls `detectUnverifiedEdit(pendingCalls)`
      with no run state, so its corpus reading is unchanged BY CONSTRUCTION and not
      merely observed to be.
      Every fixture the verify line names exists: `:1427` rewritten to pin the
      transcript MODE alongside its unchanged assertion, `echo test` + edit +
      record → refused, and edit → pass → edit → refused on `after_edits` (1) being
      below the turn total (2).
      THE PLAN'S LIVENESS CONDITION IS TIGHTENED, and this is the one substantive
      deviation. It reads "when the state file has `verification_runs` for this
      turn" — taken literally that key is present in the recorder's EMPTY state, so
      a host binding no `post_tool_use` slot has a file carrying `[]` written by
      the prompt and stop events alone, and reading it as "the turn ran nothing"
      would refuse EVERY editing turn on that host whatever the operator ran. The
      predicate is therefore `edits_this_turn >= 1`, the one field only a post-tool
      event can raise. Ownership is checked as detector D checks `ci_last`: a
      foreign file's passing record would vouch for a run this session never made.
      An instrument gap falls back to the transcript rather than refusing, per
      Risk 1.
      SABOTAGE: making the record path yield to the regex unless the run FAILED,
      and removing the freshness clause, failed exactly 5 — the four record-mode
      refusals and the placement case — and no others; restored from copies. -->
- [ ] **1.4 Kill-switch table.** Add `## Kill switches` to
      `docs/contracts/hook-architecture-v1.md` listing every
      `AGENT_CONFIG_[A-Z_]+` the hooks read (bracket form —
      `run_continuation_hook.ts:1018`, `state_io.ts:42`, …), with owner class;
      resolve blocker `daemon-host-kill-switch` in the adversarial roadmap by
      pointing its `Resolved when` at the table.
      verify: `grep -rhoE "AGENT_CONFIG_[A-Z_]+" src/scripts/hooks src/scripts/_lib | grep -v __AGENT_CONFIG_BUNDLE__ | sort -u | wc -l`
      equals the table's row count.
      <!-- TABLE HALF DONE AND VERIFIED 2026-09-29, `b9e9d9e34`; STEP STAYS OPEN on
      its second half. `docs/contracts/hook-architecture-v1.md` § Kill switches
      carries 28 rows with an owner class each (`maintainer` / `harness` /
      `orphan`), and the published grep returns 28.
      THE PLAN'S VERIFY COMMAND DOES NOT REPRODUCE, and the corrected one is
      published above the number with its measurement unit. `grep -v
      __AGENT_CONFIG_BUNDLE__` cannot remove that token: `grep -o` emits the match
      without its leading underscores, so the `-v` literal never matches. The
      command also excludes nothing for `__AGENT_CONFIG_CLI_DELEGATE__`, its
      sibling. Both are esbuild `--define` identifiers, not environment variables,
      so neither is a switch; the corrected filter is anchored on the emitted
      token. Raw grep: 30. Unit-corrected: 28.
      TWO FURTHER FINDINGS, in the table rather than silently fixed.
      `AGENT_CONFIG_NO_EVENTS_LOG` is read only OUTSIDE both directories the unit
      covers (`ai_council/events_log.ts`, `ai_team/review_gate.ts`); its row says
      so. `AGENT_CONFIG_TRANSCRIPT_HOME` is read by NOTHING anywhere — the name
      survives in one comment recording a widening the switch used to cause. It
      keeps a row classed `orphan` so the count stays reproducible and nobody sets
      it expecting an effect.
      BLOCKER HALF REFUSED, and the refusal is the finding. The step instructs an
      agent to resolve `daemon-host-kill-switch` by pointing its `Resolved when` at
      this table. That blocker is `Class: 3 — human-only`, `Owner: maintainer`, and
      asks a maintainer to DECIDE the autonomy fallback for a host with no
      process-level stop; a table of environment switches does not answer it, and
      redirecting the condition at a document about a different subject would close
      it on invented evidence. The table is linked in the blocker as one INPUT,
      with that reasoning recorded there; `Status` and `Resolved when` are
      unchanged. Closing this step needs the owner's decision. -->

## Phase 2 — Q1 becomes a number (the contract's instrument, no second refusal)

- [ ] **2.1 Shadow read on the allow path.** Per
      `turn-end-detector-demotion.md:342-354`: on a retry (Layer 1 or Layer 2
      true), before returning `EXIT_ALLOW`, run the detectors once more and
      record `would_refuse_again: {detector, turnOrdinal}` into the session
      state. Verdict stays `EXIT_ALLOW`; latency budget: the extra transcript
      read happens only on retries (`hook-latency-budget.json` `any_hook_event.p95_ci: 250`).
      verify: fixture retry that still promises → allowed AND a
      `would_refuse_again` row; `bench_hook_latency --gate` green.
      <!-- OPEN, and deliberately not started 2026-09-29. Layer 1 returns
      `EXIT_ALLOW` before `workspaceRoot` is computed and before the transcript is
      read, so a shadow read there means either restructuring the gate's `main()`
      so every detector input is built ahead of both re-entrancy layers, or
      duplicating the detector-assembly — and the settle hook's own header states
      why the second is not an option ("a detector whose shadow measurement and
      live behaviour come from different code measures nothing").
      THE REASON FOR NOT DOING IT IN THIS PASS is that its only consumer cannot
      run. 2.2's verify is "report shows a non-null Q1 AFTER ONE WEEK of sessions"
      and 2.3 consumes 2.2's reading, so Phase 2 cannot close whatever 2.1 does.
      Restructuring the most safety-sensitive `main()` in the tree, and adding a
      per-retry transcript read this file's own Risk 2 ranks second, to feed a
      step that cannot be read for a week, belongs in its own reviewed change with
      its own latency measurement — not riding along in a pass that closed Phase
      1, 3.1-3.2 and 5.1. -->
- [ ] **2.2 Q1 in the detector report.** `measure_turn_end_gate.ts` prints
      Q1 = `would_refuse_again` rows / eligible initial refusals per detector;
      the contract's § Q1 loses the word "inert" and names the reader.
      verify: report shows a non-null Q1 after one week of sessions; contract
      diff in the same PR.
      <!-- OPEN — NOT AGENT-CLOSABLE. The verify demands an elapsed measurement
      window ("after one week of sessions") over rows 2.1 does not yet write. No
      amount of work inside one session produces it, and printing a Q1 whose
      numerator is structurally zero would put a number in the report that reads
      as measured and is not. Blocked on 2.1, then on a week. -->
- [ ] **2.3 Publish the reading** to `agents/evidence/analysis/turn-end-q1-<date>.md`
      and open programme blocker `d1-stop-ladder-after-reading`.
      verify: file exists; the blocker's `What to do` cites it.
      <!-- OPEN — blocked on 2.2. Publishing a reading before the reading exists is
      the failure the file would be evidence against. -->

## Phase 3 — The obligation ledger can refuse (carried)

- [x] **3.1 Reproduce the zero-shadow defect before fixing it.** Test: seed a
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
      <!-- closed 2026-09-29, `5c9415258`. `tests/hooks/obligation_settle.test.ts`
      27 green (21 pre-existing untouched, 6 added).
      RED FIRST, and the red is the defect and not a missing export: with the
      envelope on stdin and `CLAUDE_CODE_SESSION_ID` unset, four of the six new
      cases failed on "expected [] to have a length of 1 but got +0" — the hook ran
      to completion and wrote no shadow row.
      THE PLAN NAMES THE WRONG SIDE OF THE JOIN, recorded because step 3.2 repeats
      the error. The defect is entirely in the READER: `rule_inject_hook.ts`'s
      delivered-row write is byte-unchanged. The settle hook read
      `CLAUDE_CODE_SESSION_ID`, which the dispatcher never sets — it hands each
      concern the envelope on stdin and `AGENT_CONFIG_PACKAGE_ROOT` in the
      environment, nothing else — and returned allow when it was empty. So every
      dispatched stop event was a non-reading. The fix resolves envelope
      `session_id` / `sessionId`, then the nested payload's, then the environment
      as a last resort: the same order and both spellings the injector accepts.
      The env name gains no siblings, because a name the writer never keys on
      addresses a ledger that cannot exist. The ROOT moves with it as one join, not
      a second change: a ledger is addressed by root AND session, and the two
      disagree on hosts whose shim does not chdir.
      THE SECOND HALF OF THE VERIFY IS NOT DISCHARGED HERE. A live shadow row needs
      a dispatched stop event from a session running the INSTALLED hook bundle, not
      this worktree's source, so it cannot be produced inside the change that fixes
      it. The fixture proves the mechanism end to end through `main()`; the live row
      is AC-3's seven-day window.
      SABOTAGE: reversing the precedence so the environment wins failed exactly the
      FALLBACK-ordering case and nothing else; restored from a copy.
      FIGURE THAT DID NOT REPRODUCE — the source block's "80 delivered rows, 0
      shadow rows across 4 ledgers". UNIT: one JSON array element in `delivered[]`
      / `shadow[]` of each `agents/runtime/state/obligations/*.json`, measured
      2026-09-29 on this machine. READING: 187 delivered, 0 shadow, 8 ledgers. The
      zero-shadow half reproduces exactly and is the load-bearing half; the counts
      are a day of growth past the 2026-09-28 audit and nothing here carries them
      forward. -->
- [x] **3.2 Reset the bar window from 3.1's commit** — mandated by clause (2)
      of `docs/CLAIMS.md:1211` on any change to the delivered-row write path
      (the join is that path). Numbers unchanged (K7).
      verify: `check_claims` exits 0; `last_verified` names 3.1's commit.
      <!-- closed 2026-09-29, `ab59f866f`. `check_claims` exits 0 — 102 ledger
      entries, 61 backed, 33 unbacked inventory. `build_proof` re-run in the same
      change per the CLAIMS-edit obligation; it wrote no diff.
      Clause (9) on `obligation-settle-shadow-bar` records the reset at
      `5c9415258`. Numbers unchanged (K7): the bar, the sample floor, the window
      and the demotion condition are exactly as pre-registered 2026-09-13; what
      reset is QUALIFICATION, and every row written before that commit is out of
      the sample.
      THE STEP'S CITATION IS CORRECTED IN THE CLAIM RATHER THAN REPEATED. It
      mandates the reset "on any change to the delivered-row write path (the join
      is that path)". It is not that path, and none of the five surfaces clause (2)
      enumerates was touched either — so a reader checking the enumeration alone
      would find no trigger and conclude wrongly that qualification survived. The
      reset is owed on clause (2)'s LEADING phrase, "anything altering the
      detector's exposure": before `5c9415258` the reader could not produce a row
      at all, which is a larger exposure change than any of the five.
      `last_verified` is the DATE, `2026-09-29`, with the commit in the clause
      body. The step asks for the commit in that field; every other entry in the
      ledger carries a date there, and writing a sha into a date field to satisfy a
      verify line would corrupt the field for every reader of it. The commit is
      recorded, and traceable, one line away.
      CONSEQUENCE the clause also carries: clause (8)'s "179 delivered / 0 shadow"
      first reading is disarmed as a base rate — its zero-shadow half is now
      explained by this defect rather than by clean turns. -->
- [ ] **3.3 Carried verbatim — 6.1 Arm it only after the pre-registered bar
      holds.** Flip `obligation-settle` to `severity: blocking` only when the
      `CLAIMS.md` reading meets all four parts; the flip PR carries the
      reading and extends `BLOCKING_ALLOWLIST` in
      `tests/hooks/concern_severity.test.ts:42-47`. A human-authorised
      discharge is a `DischargeRow` with `by: ratification:<artifact-id>`
      (`_lib/ratification_artifact.ts`, `agents/evidence/ratifications/`) —
      one authorisation channel, never a second "override" object.
      verify: manifest diff, reading and allowlist change in one commit.
      <!-- OPEN — NOT AGENT-CLOSABLE, and further from closable than before this
      pass. The flip is conditional on the `docs/CLAIMS.md` reading meeting all
      four parts of the pre-registered bar, and step 3.2 RESET that window to
      `5c9415258` on 2026-09-29 — correctly, because until 3.1 the detector could
      not produce a row at all. Clause (3) requires >= 30 calendar days AND >= 50
      affected sessions, both, and clause (2) requires >= 100 shadow rows over >=
      50 sessions. The sample is empty as of the reset. Earliest possible arming
      is 2026-10-29, and only if the rows accumulate and the false-positive rate
      holds at <= 5 %. Clause (4) fixes the alternative now: above 5 %, or a floor
      unmet, the detector is NOT armed and the result is filed `resolved-null`. -->
- [ ] **3.4 Carried — AC-6 of the parent:** the armed detector refuses a turn
      that wrote files under an undischarged obligation and allows one that
      discharged it, on this repository's own sessions.
      verify: two fixture sessions; `report_obligation_settle` (existing reader
      of the ledger, or `measure_turn_end_gate` if it is the reader) shows one
      refusal and one allow; deleting the referenced `DischargeRow` in the
      allowed fixture reopens settlement and the detector refuses.
      <!-- OPEN — blocked on 3.3. "Once armed" is the step's own precondition and
      nothing is armed; a fixture asserting a refusal the concern cannot emit would
      be asserting the fixture. The discharge-deletion half is testable today and
      is deliberately NOT split out ahead of the arming, because a green test named
      for an armed detector is exactly the artifact a later reader would mistake
      for the arming evidence. -->

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
      <!-- OPEN — gated, by its own first clause, on programme blocker
      `d1-stop-ladder-after-reading`, which 2.3 opens and 2.2 feeds. Not started.
      The record half its ladder needs now exists (steps 1.1-1.3), so when D1 is
      answered "yes" the work is the ladder and the contract amendment, not the
      evidence source. -->

## Phase 5 — Test-first as evidence

- [x] **5.1 `RED_THEN_GREEN` in the record, checked at the stop.** Two
      `verification_runs` entries for the same test file — the earlier
      `FAIL_EVIDENCE` naming a test the later `PASS_EVIDENCE_OK` names as
      passing — classify `RED_THEN_GREEN`. Detector F ("completion claim over
      production code no test accompanies", `:757`) accepts a new test file
      only with that pair present. `check_test_delta.ts` is **not** extended:
      its header (`:9-13`) states it cannot see order and CI cannot reach
      gitignored session state.
      verify: fixture pair red→green allowed; green→green with a new test file
      refused with `no_red_evidence`.
      <!-- closed 2026-09-29, `04bb5ea4a`. `turn_end_gate_hook.test.ts` 130 green;
      both fixtures the verify line names exist — a red→green pair over one target
      is allowed, and green→green with a new test file is refused with
      `no_red_evidence` in the reason.
      THREE CASES BEYOND THE VERIFY, because each is a way the pair could be
      claimed without being observed: a green that PREDATES the last edit, a red
      and a green over DIFFERENT targets, and a whole-suite red pairing with a
      whole-suite green (allowed — it is a legitimate sequence, and pairing it with
      a single-file run would claim one nobody saw).
      `check_test_delta.ts` is NOT extended, per the step. Its header states it
      cannot see order and CI cannot reach gitignored session state; both still
      hold.
      SCOPE NARROWED FROM THE STEP'S WORDING. It asks for "the earlier
      FAIL_EVIDENCE naming a test the later PASS_EVIDENCE_OK names as passing" —
      i.e. matching an individual test NAME across two outputs. The unit here is
      the test FILE the command names (`testTargetKey`), because cross-output
      name matching is fragile in a way that would produce `no_red_evidence` on
      honest work — a refusing verdict — whenever a runner's formatting differs
      from the parser's expectation. File-level is the coarser and safer read of
      the same sequence.
      Without records the escape is UNCHANGED, and an instrument gap is not a
      missing red: a transcript cannot see an exit code, so refusing on a
      transcript-only host would refuse every honest turn there.
      SABOTAGE: letting any pass satisfy the pair — dropping both the target match
      and the placement — failed exactly 3 (green→green, stale green, mismatched
      targets) and no others; restored from a copy. -->

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-09-29 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | Parser misses a consumer's runner and refuses honest work | implementation | A passing run classifies `INVALID_RUN` | Only absence of any record or `FAIL_EVIDENCE` refuses; every `INVALID_RUN` reason is logged as a finding, never refused on | Phase 1 — Verification is a record, not a regex |
| 2 | Shadow read on retries breaks the stop-slot budget | implementation | Extra transcript read per retry | Retries only; `bench_hook_latency --gate` in the PR | Phase 2 — Q1 becomes a number (the contract's instrument, no second refusal) |
| 3 | The join fix changes the delivered-row semantics the bar was registered on | product | Window must restart | Clause (2) of the claim mandates exactly that; 3.2 does it | Phase 3 — The obligation ledger can refuse (carried) |

**Disposition after the 2026-09-29 pass**, re-reviewed against the steps that
closed rather than left standing:

- **Risk 1 — MITIGATED as designed, and the mitigation is readable rather than
  asserted.** `INSTRUMENT_GAP_REASONS` in `_lib/verification_evidence.ts` is an
  exported set the consumer reads, so "an instrument gap is never refused on" is
  a branch two detectors take (C and F both fall back on it) instead of a rule a
  comment states. Still live for the OTHER half the row names: a passing run
  whose runner no parser has met classifies `PASS_EVIDENCE_OK` on its exit code
  alone — see step 1.1's note on why exit 0 with no summary is a pass — so the
  refusing direction of this risk is closed and the reporting direction is not.
- **Risk 2 — NOT YET INCURRED.** Step 2.1 is not started, so no retry carries an
  extra transcript read and `bench_hook_latency` was not consulted because there
  was nothing to measure. The risk transfers unchanged to whoever does 2.1, and
  that step's own note records why it was left.
- **Risk 3 — DISCHARGED.** Step 3.2 did exactly what the row's mitigation names:
  clause (9) of `obligation-settle-shadow-bar` resets qualification at
  `5c9415258` with the numbers unchanged. The row's premise turned out to be
  imprecise in the same way the step was — the semantics that changed were the
  READER's, not the delivered-row write's — which strengthens rather than
  weakens the case for the reset, and is recorded in the claim.

## Acceptance Criteria

- [x] AC-1 — A turn that edits a non-doc file with `echo test` as its only
      verification is refused at its first stop naming the missing record; the
      same turn with a `PASS_EVIDENCE_OK` entry ends normally.
      <!-- closed 2026-09-29. Both halves are fixtures in
      `tests/scripts/turn_end_gate_hook.test.ts` § "record mode — step 1.3":
      "refuses `echo test` — the record path reads the run, not the word" asserts
      the refusal AND asserts that the same tool calls WITHOUT a record are
      allowed, which is the before/after in one case; "is silent when a PASSING
      record sits after the last edit" is the second half. The refusal names the
      verdict — `not_a_verification_command` — rather than restating the rule. -->
- [ ] AC-2 — `measure_turn_end_gate` prints a non-null Q1 per detector and the
      contract no longer calls Q1 inert.
      <!-- OPEN — blocked on 2.1 then on 2.2's one-week window. -->
- [ ] AC-3 — The obligation ledger in this repository's own sessions gains
      shadow rows within seven days of 3.1.
      <!-- OPEN — 3.1 landed 2026-09-29 at `5c9415258`; the seven days start
      there. The mechanism is proven through `main()` by fixture, and a live row
      additionally needs a dispatched stop event from a session running the
      INSTALLED hook bundle rather than this worktree's source. Earliest reading:
      2026-10-06. -->
- [ ] AC-4 — (carried AC-6) once armed, the detector refuses an undischarged
      write and allows a discharged one.
      <!-- OPEN — blocked on 3.3's arming, whose window resets to 2026-09-29. -->
- [x] AC-5 — The kill-switch table's row count equals the grep count.
      <!-- closed 2026-09-29. 28 == 28, with the measurement unit published above
      the number in `docs/contracts/hook-architecture-v1.md` § Kill switches and
      the plan's own grep corrected there — it could not remove the token it
      named. See step 1.4's evidence for the three findings. AC-5 is about the
      COUNT and is closed; step 1.4 stays open on its blocker half. -->

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
